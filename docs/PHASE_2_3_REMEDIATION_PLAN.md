# UEC ESPACE DIGITAL — PHASE 2.3 SECURITY REMEDIATION PLAN
## Proposed Enhancements, Defense-in-Depth Strategies & Authorization Governance

**Project:** UEC — Espace Digital  
**Supabase Target:** `aigsdarfiplwmzqtqlxh` (PostgreSQL 17.12)  
**Date:** 2026-11-21  
**Status:** **PROPOSED & AWAITING SEPARATE AUTHORIZATION (ZERO PRODUCTION CHANGES EXECUTED)**

---

## 1. Remediation Status Overview

| Finding ID | Title | Severity | Remediation Category | Current Phase 2.3 Status |
|---|---|:---:|---|---|
| **SEC-V02** | Open Redirect Defense in OAuth Callback | **LOW** | Local Code Hardening | **COMPLETED & VERIFIED** (In commit `ead6720`) |
| **SEC-V01** | Direct REST Column-Level Mutation on `tasks` | **MEDIUM** | Database Trigger Defense | **PROPOSED BELOW (Pending explicit authorization)** |
| **SEC-V03** | 43 Remaining `auth_rls_initplan` Warnings | **INFO** | Performance Optimization | **SCHEDULED FOR FUTURE BATCH MAINTENANCE** |
| **SEC-V04** | Multiple Permissive Policies on 9 Tables | **INFO** | Policy Consolidation | **ACCEPTED ARCHITECTURAL DESIGN** |

---

## 2. Deep-Dive Proposal for SEC-V01: Column-Level Immutability Trigger

### 2.1 Problem Statement & Architectural Analysis
While Next.js Server Actions enforce 100% of column restrictions at the application boundary, PostgreSQL Row-Level Security (`tasks_update`) operates solely at row granularity. A user with direct PostgREST API access could attempt to modify administrative task attributes (`department_id`, `project_id`, `priority`, etc.).

To achieve enterprise-grade **defense-in-depth**, the database engine must independently enforce that non-coordinators and non-admins cannot mutate administrative columns.

### 2.2 Proposed Database DDL (NOT YET APPLIED)

```sql
-- ==============================================================================
-- PROPOSED HARDENING PATCH: COLUMN-LEVEL TASK IMMUTABILITY TRIGGER
-- Requires separate explicit user authorization before execution.
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION private.enforce_task_member_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- 1. Service role and administrative background bypass
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') AND auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2. Super Admin and Department Coordinator have full management authority
  IF private.is_super_admin(auth.uid()) OR private.is_coordinator_of(OLD.department_id, auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- 3. For assigned members:
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

DROP TRIGGER IF EXISTS trg_enforce_task_member_immutability ON public.tasks;
CREATE TRIGGER trg_enforce_task_member_immutability
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION private.enforce_task_member_immutability();

COMMIT;
```

### 2.3 Emergency Rollback SQL for Proposed Trigger

```sql
BEGIN;
DROP TRIGGER IF EXISTS trg_enforce_task_member_immutability ON public.tasks;
DROP FUNCTION IF EXISTS private.enforce_task_member_immutability();
COMMIT;
```

---

## 3. Plan for Secondary Performance Optimizations (SEC-V03)

The 43 policies flagged by `auth_rls_initplan` can be grouped and updated in subsequent domain-specific feature releases:
- Phase 3 (Media & Content Calendar): 8 policies
- Phase 4 (Equipment & Requests): 12 policies
- Phase 5 (Governance & Meetings): 11 policies
- General Maintenance: 12 policies

Zero production changes for SEC-V01, SEC-V03, or SEC-V04 have been executed during Phase 2.3.
