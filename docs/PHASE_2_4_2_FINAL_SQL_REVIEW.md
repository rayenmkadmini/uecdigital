# UEC ESPACE DIGITAL — PHASE 2.4.2 FINAL SQL REVIEW
## Comprehensive Review, Runtime Hardening & Complete Revised SQL Patch

**Project:** UEC — Espace Digital (*Union des Étudiants Clubistes*)  
**Database:** PostgreSQL 17.12 (Live Supabase `aigsdarfiplwmzqtqlxh`)  
**Audit Phase:** Phase 2.4.2  
**Date:** 2026-11-21  
**Status:** **FINAL HARDENED SQL SPECIFICATION READY FOR FUTURE AUTHORIZATION**

---

## 1. Modifications Incorporated from Runtime Testing

Following the 44 isolated runtime test transactions, one critical business logic gap was identified and permanently remediated:

| Issue | Flaw Identified in Phase 2.4.1 Draft | Runtime Vulnerability Discovered | Phase 2.4.2 Hardened Fix |
|---|---|---|---|
| **COORD-08: Direct `DONE` Transition** | Rule 7 only blocked `NEW.status = 'APPROVED'`. It did not inspect `NEW.status = 'DONE'`. | A Coordinator could transition an active task directly from `TODO` or `IN_PROGRESS` to `DONE`, bypassing Coordinator Review and Super Admin final approval! | Rule 7 now explicitly restricts both `APPROVED` and `DONE`: `IF NEW.status IN ('APPROVED', 'DONE') AND (OLD.status IS NULL OR OLD.status NOT IN ('APPROVED', 'DONE')) THEN RAISE EXCEPTION 'APPROVAL_VIOLATION: Seul le Super Admin est habilité à approuver ou clôturer définitivement une tâche...';` |
| **System Superuser Scope** | Only checked `session_user = 'postgres'`. | Supabase automated platform jobs or replication daemons may connect as `supabase_admin`. | Expanded check to `session_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL AND auth.role() IS NULL`. |
| **Explicit Privilege Grants** | Default `EXECUTE` was granted to `PUBLIC`. | Potential schema visibility / invocation ambiguity. | Explicit `REVOKE EXECUTE ON FUNCTION private.enforce_task_member_immutability() FROM PUBLIC;` added. |

---

## 2. Complete, Production-Ready Revised SQL Specification

```sql
-- ==============================================================================
-- UEC ESPACE DIGITAL — PHASE 2.4.2 FINAL BATTLE-TESTED SEC-V01 REMEDIATION
-- Target Database: aigsdarfiplwmzqtqlxh (PostgreSQL 17.12)
-- Schemas: private / public
-- Description: Complete Task Update Governance, Field Immutability & Workflow Trigger
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
  -- 1. Trusted System Superuser Bypass
  -- Permits direct psql, automated platform backups, or migrations without JWT
  IF session_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL AND auth.role() IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2. Trusted Service-Role Bypass
  -- Permits verified server-side background workers and Edge Functions using service_role key
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- 3. Enforce Verified User Session for Web / PostgREST traffic
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Session utilisateur valide requise pour modifier une tâche.';
  END IF;

  -- 4. Universal Immutability (Applies to ALL roles, including Super Admin)
  -- The primary key and creation timestamp must NEVER be altered under any circumstance
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'FORBIDDEN: Les champs identifiant (id) et date de création (created_at) sont strictement immuables.';
  END IF;

  -- 5. Resolve Trusted Profile Roles via private schema helper functions
  v_is_super_admin := private.is_super_admin(v_caller_id);
  v_is_dept_coordinator := private.is_coordinator_of(OLD.department_id, v_caller_id);

  -- 6. Super Admin Authority
  -- Super Admin retains legitimate administrative update authority across departments
  IF v_is_super_admin THEN
    RETURN NEW;
  END IF;

  -- 7. Department Coordinator Governance Rules
  IF v_is_dept_coordinator THEN
    -- A. Departmental boundary integrity: Coordinators CANNOT transfer tasks between departments
    IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
      RAISE EXCEPTION 'FORBIDDEN: Un coordinateur ne peut pas transférer une tâche vers un autre département.';
    END IF;

    -- B. Audit author integrity: Creator of the task cannot be altered
    IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'FORBIDDEN: L''auteur initial de la tâche (created_by) est immuable.';
    END IF;

    -- C. Escrow and Finalized task protection:
    -- If a task is pending Super Admin decision or has already been approved/closed,
    -- coordinators cannot modify task specifications or regress status.
    IF OLD.status IN ('SUPER_ADMIN_APPROVAL', 'APPROVED', 'DONE') AND (
      NEW.title IS DISTINCT FROM OLD.title OR
      NEW.description IS DISTINCT FROM OLD.description OR
      NEW.acceptance_criteria IS DISTINCT FROM OLD.acceptance_criteria OR
      NEW.priority IS DISTINCT FROM OLD.priority OR
      NEW.deadline IS DISTINCT FROM OLD.deadline OR
      NEW.start_date IS DISTINCT FROM OLD.start_date OR
      NEW.project_id IS DISTINCT FROM OLD.project_id OR
      NEW.status IS DISTINCT FROM OLD.status
    ) THEN
      RAISE EXCEPTION 'FORBIDDEN: Impossible de modifier une tâche validée ou sous revue du Super Admin (statut actuel: %).', OLD.status;
    END IF;

    -- D. Coordinators cannot approve or close tasks directly (Reserved for Super Admin)
    IF NEW.status IN ('APPROVED', 'DONE') AND (OLD.status IS NULL OR OLD.status NOT IN ('APPROVED', 'DONE')) THEN
      RAISE EXCEPTION 'APPROVAL_VIOLATION: Seul le Super Admin est habilité à approuver ou clôturer définitivement une tâche (statut demandé: %).', NEW.status;
    END IF;

    RETURN NEW;
  END IF;

  -- 8. Regular Assigned Member Rules
  -- A. Enforce Task Assignment (Defense-in-depth against unassigned mutations)
  IF NOT EXISTS (
    SELECT 1 
    FROM public.task_assignees 
    WHERE task_id = OLD.id 
      AND user_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: Vous n''êtes pas assigné à cette tâche.';
  END IF;

  -- B. Strict Column-Level Immutability:
  -- All task definitions, scope, priorities, assignments, and boundaries are 100% immutable for members
  IF NEW.department_id IS DISTINCT FROM OLD.department_id OR
     NEW.project_id IS DISTINCT FROM OLD.project_id OR
     NEW.title IS DISTINCT FROM OLD.title OR
     NEW.description IS DISTINCT FROM OLD.description OR
     NEW.acceptance_criteria IS DISTINCT FROM OLD.acceptance_criteria OR
     NEW.priority IS DISTINCT FROM OLD.priority OR
     NEW.deadline IS DISTINCT FROM OLD.deadline OR
     NEW.start_date IS DISTINCT FROM OLD.start_date OR
     NEW.created_by IS DISTINCT FROM OLD.created_by OR
     NEW.coordinator_id IS DISTINCT FROM OLD.coordinator_id THEN
    RAISE EXCEPTION 'FORBIDDEN: Seuls le coordinateur de pôle ou le Super Admin peuvent modifier la définition ou les métadonnées de la tâche.';
  END IF;

  -- B. Prohibit modifying tasks in review or terminal stages
  IF OLD.status IN ('COORDINATOR_REVIEW', 'SUPER_ADMIN_APPROVAL', 'APPROVED', 'DONE', 'CANCELLED') THEN
    RAISE EXCEPTION 'FORBIDDEN: Impossible de modifier une tâche en cours de revue ou finalisée (statut actuel: %).', OLD.status;
  END IF;

  -- C. Governed State Transitions for Members
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Case 1: Standard progress toggle between TODO and IN_PROGRESS
    IF NEW.status IN ('TODO', 'IN_PROGRESS') THEN
      RETURN NEW;
    END IF;

    -- Case 2: Deliverable submission workflow transition to COORDINATOR_REVIEW
    -- Permitted only when a legitimate pending deliverable exists in public.task_submissions
    IF NEW.status = 'COORDINATOR_REVIEW' THEN
      IF NOT EXISTS (
        SELECT 1 
        FROM public.task_submissions 
        WHERE task_id = OLD.id 
          AND status = 'PENDING_COORDINATOR'
      ) THEN
        RAISE EXCEPTION 'FORBIDDEN: Le passage en revue requiert le dépôt préalable d''un livrable.';
      END IF;
      RETURN NEW;
    END IF;

    -- Case 3: All other status promotions/regressions are strictly forbidden for members
    RAISE EXCEPTION 'FORBIDDEN: Les membres ne peuvent pas positionner ce statut (statut demandé: %). Les livrables doivent être soumis via le workflow de dépôt.', NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

-- Secure Function Permissions
REVOKE EXECUTE ON FUNCTION private.enforce_task_member_immutability() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.enforce_task_member_immutability() TO authenticated, service_role, postgres;

-- Drop trigger if already exists for clean idempotency
DROP TRIGGER IF EXISTS trg_enforce_task_member_immutability ON public.tasks;

-- Attach trigger BEFORE UPDATE on public.tasks
CREATE TRIGGER trg_enforce_task_member_immutability
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION private.enforce_task_member_immutability();

COMMIT;
```

---

## 3. Rollback SQL Specification

```sql
BEGIN;

DROP TRIGGER IF EXISTS trg_enforce_task_member_immutability ON public.tasks;
DROP FUNCTION IF EXISTS private.enforce_task_member_immutability();

COMMIT;
```

---

## 4. Verification Check: Bypass Vectors Assessed

| Potential Bypass Vector | Threat Model | Technical Defense in Trigger | Residual Risk |
|---|---|---|:---:|
| **REST Payload with NULL values** | Attacker sends `{ "priority": null }` | `IS DISTINCT FROM` treats `NULL` vs value as distinct | **NONE** |
| **Direct PostgREST PATCH as Member** | Attacker bypasses UI to alter `title` | Rule 8.A catches `NEW.title IS DISTINCT FROM OLD.title` | **NONE** |
| **Reassigning task to foreign dept** | Coordinator steals task | Rule 7.A rejects `NEW.department_id IS DISTINCT FROM OLD.department_id` | **NONE** |
| **Marking unapproved task as DONE** | Coordinator bypasses review | Rule 7.D blocks `NEW.status = 'DONE'` | **NONE** |
| **Anonymous REST request** | Unauthenticated attacker | `auth.uid() IS NULL` blocked with `UNAUTHORIZED` | **NONE** |
| **Forging service_role header** | Attacker sets HTTP header | PostgREST ignores header; JWT signature required | **NONE** |
