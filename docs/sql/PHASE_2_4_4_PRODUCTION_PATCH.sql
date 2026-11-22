-- ==============================================================================
-- UEC ESPACE DIGITAL — PRODUCTION SQL REMEDIATION PATCH
-- Phase: 2.4.4 Production Execution Package
-- Target Project: aigsdarfiplwmzqtqlxh
-- Engine: PostgreSQL 17.12 (Supabase)
-- Remediation: SEC-V01 — Direct REST Column-Level Mutation Surface on public.tasks
-- ==============================================================================
--
-- IMPORTANT SAFETY NOTICE:
-- This script MUST NOT be executed without explicit user authorization.
-- This script is strictly idempotent, non-destructive, and transactional.
-- It introduces ZERO alterations to existing tables, columns, data, or existing triggers.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. PRECONDITION CHECKS & PROJECT SAFEGUARD
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_version integer;
  v_has_tasks boolean;
  v_has_subadmin_helper boolean;
  v_has_coord_helper boolean;
  v_has_existing_approval_trg boolean;
  v_has_existing_updated_trg boolean;
BEGIN
  -- 1.1 Verify PostgreSQL Engine (Minimum 17.0)
  v_version := current_setting('server_version_num')::integer;
  IF v_version < 170000 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Target database is not PostgreSQL 17+ (current_setting: %)', current_setting('server_version');
  END IF;

  -- 1.2 Verify Table public.tasks with required columns
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'tasks' 
      AND column_name = 'acceptance_criteria'
  ) INTO v_has_tasks;

  IF NOT v_has_tasks THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: public.tasks does not exist or lacks expected column acceptance_criteria';
  END IF;

  -- 1.3 Verify Schema private and required security helper functions
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'private' AND p.proname = 'is_super_admin'
  ) INTO v_has_subadmin_helper;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'private' AND p.proname = 'is_coordinator_of'
  ) INTO v_has_coord_helper;

  IF NOT (v_has_subadmin_helper AND v_has_coord_helper) THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Required security helpers private.is_super_admin or private.is_coordinator_of missing';
  END IF;

  -- 1.4 Verify Pre-existing Triggers on public.tasks are intact
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'tasks' AND t.tgname = 'trg_enforce_task_approval' AND NOT t.tgisinternal
  ) INTO v_has_existing_approval_trg;

  SELECT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'tasks' AND t.tgname = 'trg_set_updated_at' AND NOT t.tgisinternal
  ) INTO v_has_existing_updated_trg;

  IF NOT (v_has_existing_approval_trg AND v_has_existing_updated_trg) THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Pre-existing triggers trg_enforce_task_approval or trg_set_updated_at are missing or altered';
  END IF;

  RAISE NOTICE 'PRECONDITIONS_PASSED: Project aigsdarfiplwmzqtqlxh catalog verified for Phase 2.4.4 deployment.';
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. CREATE IMMUTABILITY ENFORCEMENT FUNCTION
-- ------------------------------------------------------------------------------
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
  -- 1. Trusted System Superuser Bypass (maintenance sessions via postgres/supabase_admin)
  IF session_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL AND auth.role() IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2. Trusted Service-Role Bypass (server-side workers / backend cron jobs)
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- 3. Enforce Verified User Session
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Session utilisateur valide requise pour modifier une tâche.';
  END IF;

  -- 4. Universal Immutability (Primary Key and Creation Timestamp)
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'FORBIDDEN: Les champs identifiant (id) et date de création (created_at) sont strictement immuables.';
  END IF;

  -- 5. Resolve Trusted Profile Roles
  v_is_super_admin := private.is_super_admin(v_caller_id);
  v_is_dept_coordinator := private.is_coordinator_of(OLD.department_id, v_caller_id);

  -- 6. Super Admin Authority (Full operational control)
  IF v_is_super_admin THEN
    RETURN NEW;
  END IF;

  -- 7. Department Coordinator Governance Rules
  IF v_is_dept_coordinator THEN
    -- A. Cross-department transfer blocked
    IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
      RAISE EXCEPTION 'FORBIDDEN: Un coordinateur ne peut pas transférer une tâche vers un autre département.';
    END IF;

    -- B. Author immutability
    IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'FORBIDDEN: L''auteur initial de la tâche (created_by) est immuable.';
    END IF;

    -- C. Immutability during/after Super Admin governance
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

    -- D. Direct terminal approval bypass blocked
    IF NEW.status IN ('APPROVED', 'DONE') AND (OLD.status IS NULL OR OLD.status NOT IN ('APPROVED', 'DONE')) THEN
      RAISE EXCEPTION 'APPROVAL_VIOLATION: Seul le Super Admin est habilité à approuver ou clôturer définitivement une tâche (statut demandé: %).', NEW.status;
    END IF;

    RETURN NEW;
  END IF;

  -- 8. Regular Assigned Member Rules
  -- A. Enforce assignment: User must be an assigned member of this task
  IF NOT EXISTS (
    SELECT 1 
    FROM public.task_assignees 
    WHERE task_id = OLD.id 
      AND user_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: Vous n''êtes pas assigné à cette tâche.';
  END IF;

  -- B. Strict Column-Level Immutability:
  -- Members are forbidden from modifying structural fields and task definitions
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

  -- C. Status Transition Lockouts:
  -- Member cannot modify tasks that are in review or terminal states
  IF OLD.status IN ('COORDINATOR_REVIEW', 'SUPER_ADMIN_APPROVAL', 'APPROVED', 'DONE', 'CANCELLED') THEN
    RAISE EXCEPTION 'FORBIDDEN: Impossible de modifier une tâche en cours de revue ou finalisée (statut actuel: %).', OLD.status;
  END IF;

  -- D. Permitted Status Transitions:
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Allowed working transitions
    IF NEW.status IN ('TODO', 'IN_PROGRESS') THEN
      RETURN NEW;
    END IF;

    -- Transition to review requires an active deliverable submission
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

    RAISE EXCEPTION 'FORBIDDEN: Les membres ne peuvent pas positionner ce statut (statut demandé: %). Les livrables doivent être soumis via le workflow de dépôt.', NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. CONFIGURE FUNCTION PRIVILEGES & OWNERSHIP
-- ------------------------------------------------------------------------------
ALTER FUNCTION private.enforce_task_member_immutability() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.enforce_task_member_immutability() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.enforce_task_member_immutability() TO postgres, service_role, authenticated;

-- ------------------------------------------------------------------------------
-- 4. CREATE IMMUTABILITY TRIGGER ON public.tasks
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_enforce_task_member_immutability ON public.tasks;

CREATE TRIGGER trg_enforce_task_member_immutability
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION private.enforce_task_member_immutability();

COMMIT;

-- ==============================================================================
-- 5. POST-DEPLOYMENT VERIFICATION QUERIES (READ-ONLY)
-- ==============================================================================
-- Run these queries immediately after execution to confirm catalog state:

-- 5.1 Verify Trigger Installation & Ordering
SELECT 
    t.tgname AS trigger_name,
    p.proname AS function_name,
    n.nspname AS schema_name,
    t.tgtype,
    pg_get_triggerdef(t.oid) AS trigger_def
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE c.relname = 'tasks' AND NOT t.tgisinternal
ORDER BY t.tgname;

-- 5.2 Verify Function Security Attributes (SECURITY DEFINER, empty search_path, owner postgres)
SELECT 
    p.proname,
    p.prosecdef AS is_security_definer,
    r.rolname AS owner,
    p.proconfig AS search_path_config
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_roles r ON p.proowner = r.oid
WHERE n.nspname = 'private' AND p.proname = 'enforce_task_member_immutability';

-- 5.3 Verify Execution Privileges
SELECT 
    routine_name, 
    grantee, 
    privilege_type 
FROM information_schema.routine_privileges 
WHERE specific_schema = 'private' AND routine_name = 'enforce_task_member_immutability'
ORDER BY grantee;
