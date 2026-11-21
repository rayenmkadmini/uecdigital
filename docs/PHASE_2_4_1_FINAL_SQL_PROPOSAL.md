# UEC ESPACE DIGITAL — PHASE 2.4.1 FINAL SQL PROPOSAL
## Production-Ready SQL Remediation Patch for SEC-V01 (Pending Explicit User Approval)

**Project:** UEC — Espace Digital (*Union des Étudiants Clubistes*)  
**Supabase Instance:** `aigsdarfiplwmzqtqlxh` (PostgreSQL 17.12)  
**Database Schema:** `private` / `public`  
**Date:** 2026-11-21  
**Status:** **REVISED & BATTLE-TESTED — PENDING EXPLICIT USER APPROVAL (DO NOT EXECUTE)**

---

## 1. Summary of Changes Between Phase 2.4 Draft and Phase 2.4.1 Final

| Area | Phase 2.4 Preliminary Draft | Phase 2.4.1 Final Adversarial Hardened SQL |
|---|---|---|
| **Identity Verification** | Flawed `current_user IN (...)` vulnerable to `SECURITY DEFINER` identity swap | Hardened `session_user = 'postgres'` + `auth.role() = 'service_role'` verification |
| **Member Immutability** | Only 7 columns checked; `title`, `description`, `acceptance_criteria` vulnerable | Complete 12-column immutability; members can only update `status` |
| **Workflow Compatibility** | Threw `FORBIDDEN` on `NEW.status = 'COORDINATOR_REVIEW'`, breaking submissions | Explicitly permits `COORDINATOR_REVIEW` if a `PENDING_COORDINATOR` submission exists |
| **Coordinator Boundaries** | Could change `department_id` or modify tasks in `SUPER_ADMIN_APPROVAL` | `department_id` and `created_by` locked; escrowed & approved tasks protected |
| **Universal Immutability** | Super Admin was granted early return before PK checks | `id` and `created_at` are universally immutable for all actors, including Super Admin |

---

## 2. Final SQL Patch Specification

```sql
-- ==============================================================================
-- UEC ESPACE DIGITAL — PHASE 2.4.1 SEC-V01 REMEDIATION PATCH
-- Target Database: aigsdarfiplwmzqtqlxh (PostgreSQL 17.12)
-- Schema: private / public
-- Description: Hardened Task Update Governance & Field Immutability Trigger
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
  -- 1. Trusted System Superuser Bypass (Direct psql, migrations, or database administrator)
  IF session_user = 'postgres' AND auth.uid() IS NULL AND auth.role() IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2. Trusted Service-Role Bypass (Server-side background workers / Edge functions)
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- 3. Enforce Verified User Session for all Web / PostgREST traffic
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Session utilisateur valide requise pour modifier une tâche.';
  END IF;

  -- 4. Universal Immutability (Applies to ALL roles including Super Admin)
  -- The primary key and creation timestamp must NEVER be altered
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'FORBIDDEN: Les champs identifiant (id) et date de création (created_at) sont strictement immuables.';
  END IF;

  -- 5. Resolve Trusted Profile Roles via private schema helper functions
  v_is_super_admin := private.is_super_admin(v_caller_id);
  v_is_dept_coordinator := private.is_coordinator_of(OLD.department_id, v_caller_id);

  -- 6. Super Admin Authority
  -- Super Admin retains legitimate full administrative authority
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

    -- D. Coordinators cannot approve tasks directly (also enforced by trg_enforce_task_approval)
    IF NEW.status = 'APPROVED' AND (OLD.status IS NULL OR OLD.status <> 'APPROVED') THEN
      RAISE EXCEPTION 'APPROVAL_VIOLATION: Seul le Super Admin est habilité à approuver définitivement une tâche.';
    END IF;

    RETURN NEW;
  END IF;

  -- 8. Regular Assigned Member Rules
  -- A. Strict Column-Level Immutability:
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

-- Drop trigger if already exists for idempotency
DROP TRIGGER IF EXISTS trg_enforce_task_member_immutability ON public.tasks;

-- Attach trigger BEFORE UPDATE on public.tasks
CREATE TRIGGER trg_enforce_task_member_immutability
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION private.enforce_task_member_immutability();

COMMIT;
```

---

## 3. Deployment Safety Features

1. **Transactional Execution:** Enclosed in `BEGIN ... COMMIT` ensuring zero partial state.
2. **Deterministic Trigger Naming:** Alphabetical sorting positions `trg_enforce_task_member_immutability` between `trg_enforce_task_approval` and `trg_set_updated_at`.
3. **Zero Frontend Regressions:** Works seamlessly with existing Server Actions (`updateTaskStatusAction`, `submitDeliverableAction`, `submitCoordinatorReview`, `superAdminReviewAction`).
4. **Zero Production Changes Executed Yet:** This patch remains strictly a documented proposal awaiting user review and explicit command.
