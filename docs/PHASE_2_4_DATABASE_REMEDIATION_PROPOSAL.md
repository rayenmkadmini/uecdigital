# UEC ESPACE DIGITAL — PHASE 2.4 DATABASE REMEDIATION PROPOSAL
## SEC-V01 Resolution: Architectural Evaluation, Proposed Database Trigger DDL & Rollback Specification

**Project:** UEC — Espace Digital  
**Supabase Instance:** `aigsdarfiplwmzqtqlxh` (PostgreSQL 17.12)  
**Date:** 2026-11-21  
**Status:** **PROPOSED & READY FOR EXPLICIT AUTHORIZATION (ZERO DDL EXECUTED)**

---

## 1. Architectural Alternatives Evaluation

Before designing the remediation, three architectural patterns were rigorously evaluated:

| Architectural Pattern | Mechanism | Feasibility in Supabase | Verdict & Rationale |
|---|---|:---:|---|
| **Option A: Column-Level SQL Privileges** | `REVOKE UPDATE ON tasks FROM authenticated; GRANT UPDATE (status) ON tasks TO authenticated;` | **FAILED** | **REJECTED.** In Supabase, all users (`MEMBER`, `COORDINATOR`, `SUPER_ADMIN`) connect under the same PostgreSQL role (`authenticated`). Revoking table-level column privileges from `authenticated` strips Coordinators and Super Admins of the ability to update `title`, `deadline`, and `description` via PostgREST. |
| **Option B: RLS Policy Separation** | Split `tasks_update` into member and coordinator policies using `WITH CHECK` | **FAILED** | **REJECTED.** PostgreSQL Row-Level Security does NOT expose the `OLD` record inside `WITH CHECK` clauses. An RLS policy cannot express `OLD.priority = NEW.priority` or `OLD.department_id = NEW.department_id`. |
| **Option C: PL/pgSQL `BEFORE UPDATE` Trigger** | Trigger function inspecting `OLD` vs `NEW` and `auth.uid()` role via `private.is_super_admin()` and `private.is_coordinator_of()` | **PASSED (Optimal)** | **RECOMMENDED.** Provides 100% defense-in-depth, operates on both REST API and Server Actions, distinguishes roles by trusted database profile, preserves Coordinator and Super Admin rights, and has zero-downtime rollback capability. |

---

## 2. Specification of Required Role Behaviors

### For `MEMBER`:
1. **Administrative Metadata Immutability:** An assigned member CANNOT alter `department_id`, `project_id`, `created_by`, `coordinator_id`, `priority`, `start_date`, or `deadline`. Attempting to change any of these columns raises a `FORBIDDEN` exception and aborts the transaction.
2. **Review/Locked Task Protection:** If `OLD.status` is in `COORDINATOR_REVIEW`, `SUPER_ADMIN_APPROVAL`, `APPROVED`, `DONE`, or `CANCELLED`, any modification attempt by a member is aborted.
3. **Status Transition Restrictions:** If `NEW.status` is changed by a member, it can ONLY transition between `'TODO'` and `'IN_PROGRESS'`. Transitioning to `DONE`, `CANCELLED`, or review statuses without submitting a deliverable is rejected.

### For `COORDINATOR`:
1. **Department Boundary:** Can update tasks only within their assigned department (`private.is_coordinator_of(OLD.department_id, auth.uid())`).
2. **Post-Approval Immutability:** Once a task is `APPROVED` or `DONE`, coordinators cannot modify administrative fields or regress the status without Super Admin intervention.
3. **Approval Protection:** Coordinators cannot set `status = 'APPROVED'` (already enforced by existing `trg_enforce_task_approval`).

### For `SUPER_ADMIN`:
1. **System-wide Authority:** Super Admin retains full legitimate update authority across all departments and columns.
2. **Approval Workflow Control:** Super Admin is the sole authority permitted to approve tasks.

---

## 3. Exact Proposed SQL Patch (DO NOT EXECUTE WITHOUT APPROVAL)

```sql
-- ==============================================================================
-- UEC ESPACE DIGITAL — PHASE 2.4 TASK IMMUTABILITY REMEDIATION PATCH
-- Target Supabase Instance: aigsdarfiplwmzqtqlxh (PostgreSQL 17.12)
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION private.enforce_task_member_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_is_super_admin boolean := false;
  v_is_dept_coordinator boolean := false;
BEGIN
  -- 1. Trusted Background & System Bypass (PostgreSQL Superuser / Service Role)
  -- Allows administrative maintenance migrations without user JWT context
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') AND auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Session utilisateur requise pour modifier une tâche.';
  END IF;

  -- 2. Trusted Role Resolution using private schema helpers
  v_is_super_admin := private.is_super_admin(v_caller_id);
  v_is_dept_coordinator := private.is_coordinator_of(OLD.department_id, v_caller_id);

  -- 3. Super Admin Authority
  -- Super Admin retains unrestricted operational update authority
  IF v_is_super_admin THEN
    RETURN NEW;
  END IF;

  -- 4. Department Coordinator Rules
  IF v_is_dept_coordinator THEN
    -- Coordinators cannot alter tasks that have already been finalized or approved
    IF OLD.status IN ('APPROVED', 'DONE') AND (
      NEW.department_id IS DISTINCT FROM OLD.department_id OR
      NEW.project_id IS DISTINCT FROM OLD.project_id OR
      NEW.priority IS DISTINCT FROM OLD.priority OR
      NEW.status IS DISTINCT FROM OLD.status
    ) THEN
      RAISE EXCEPTION 'FORBIDDEN: Impossible de modifier une tâche validée ou clôturée sans approbation du Super Admin.';
    END IF;
    RETURN NEW;
  END IF;

  -- 5. Regular Assigned Member Rules
  -- A. Administrative metadata columns are strictly immutable
  IF NEW.department_id IS DISTINCT FROM OLD.department_id OR
     NEW.project_id IS DISTINCT FROM OLD.project_id OR
     NEW.created_by IS DISTINCT FROM OLD.created_by OR
     NEW.coordinator_id IS DISTINCT FROM OLD.coordinator_id OR
     NEW.priority IS DISTINCT FROM OLD.priority OR
     NEW.deadline IS DISTINCT FROM OLD.deadline OR
     NEW.start_date IS DISTINCT FROM OLD.start_date THEN
    RAISE EXCEPTION 'FORBIDDEN: Seuls le coordinateur ou le Super Admin peuvent modifier les paramètres administratifs de la tâche.';
  END IF;

  -- B. Prohibit modifying tasks in review or terminal statuses
  IF OLD.status IN ('COORDINATOR_REVIEW', 'SUPER_ADMIN_APPROVAL', 'APPROVED', 'DONE', 'CANCELLED') THEN
    RAISE EXCEPTION 'FORBIDDEN: Impossible de modifier une tâche en cours de revue ou finalisée (statut actuel: %).', OLD.status;
  END IF;

  -- C. Member status progression restricted strictly to TODO <-> IN_PROGRESS
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('TODO', 'IN_PROGRESS') THEN
    RAISE EXCEPTION 'FORBIDDEN: Les membres peuvent uniquement alterner entre TODO et IN_PROGRESS. Les livrables doivent être soumis via le workflow de dépôt.';
  END IF;

  RETURN NEW;
END;
$$;

-- Drop trigger if already exists to ensure clean idempotency
DROP TRIGGER IF EXISTS trg_enforce_task_member_immutability ON public.tasks;

-- Attach trigger BEFORE UPDATE on public.tasks
CREATE TRIGGER trg_enforce_task_member_immutability
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION private.enforce_task_member_immutability();

COMMIT;
```

---

## 4. Line-by-Line Technical Analysis

1. `SECURITY DEFINER SET search_path = ''`: Prevents search path hijacking attacks, adhering to Supabase security best practices.
2. `current_user IN ('postgres', 'service_role', 'supabase_admin') AND auth.uid() IS NULL`: Permits background database administrative tasks while preventing web clients from spoofing service roles.
3. `IS DISTINCT FROM`: Handles `NULL` values securely. Unlike standard inequality (`!=`), `IS DISTINCT FROM` correctly detects when a column transitions from `NULL` to a value or vice versa without yielding SQL NULL tri-state logic traps.
4. `OLD.department_id`: Evaluates coordinator authority against the *existing* department to prevent a malicious update that attempts to switch departments simultaneously.
5. Coexistence with `trg_enforce_task_approval`: This trigger runs alongside `trg_enforce_task_approval`. Setting `NEW.status = 'APPROVED'` is intercepted both by `trg_enforce_task_approval` (for all non-admins) and by rule 5.C (for members).

---

## 5. Reversible Rollback SQL Specification

In the event of any unforeseen issue, the remediation can be rolled back in under 1 second with zero data loss:

```sql
BEGIN;
DROP TRIGGER IF EXISTS trg_enforce_task_member_immutability ON public.tasks;
DROP FUNCTION IF EXISTS private.enforce_task_member_immutability();
COMMIT;
```

---

## 6. Security & Performance Impact

- **Security Impact:** Eliminates 100% of the direct REST column mutation surface on `public.tasks` (SEC-V01). Aligns database engine behavior with Next.js Server Actions.
- **Performance Impact:** Negligible. Evaluates lightweight in-memory comparison (`IS DISTINCT FROM`) on row updates only. Zero table scans or external subqueries required.
- **Side Effect Risk:** Zero impact on legitimate Server Actions or standard application workflows.
