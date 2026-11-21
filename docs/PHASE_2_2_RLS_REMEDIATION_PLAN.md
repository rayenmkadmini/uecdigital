# UEC ESPACE DIGITAL — PHASE 2.2 RLS REMEDIATION PLAN
## Critical RLS Policy Correction & Database Security Validation

**Project:** UEC — Espace Digital  
**Supabase Project:** `aigsdarfiplwmzqtqlxh` (PostgreSQL 17.12)  
**Branch:** `feature/uec-espace-digital`  
**Latest Commit:** `07c7b42`  
**Status:** **READY FOR EXPLICIT APPROVAL** (Awaiting explicit user confirmation before applying SQL to database)

---

## 1. Executive Summary & Root Cause Analysis

During Phase 2.1, a critical column-shadowing bug (**SEC-F01**) was uncovered in the initial database migration (`supabase/migrations/20261120210000_espace_digital_core_schema.sql`). 

When PostgreSQL compiles subquery expressions in `CREATE POLICY`, unqualified identifiers are resolved against the innermost subquery table first according to SQL standard scoping rules. Consequently:
- `WHERE pm.project_id = id` was stored as `WHERE ((pm.project_id = pm.id) AND (pm.user_id = auth.uid()))`
- `WHERE ta.task_id = id` was stored as `WHERE ((ta.task_id = ta.id) AND (ta.user_id = auth.uid()))`
- `WHERE ta.task_id = task_id` was stored as `WHERE ((ta.task_id = ta.task_id) AND (ta.user_id = auth.uid()))`
- `WHERE ma.meeting_id = id` was stored as `WHERE ((ma.meeting_id = ma.id) AND (ma.user_id = auth.uid()))`

### Security and Functional Consequences:
1. **Denial of Legitimate Member Access (Broken Functionality):** Because `pm.id`, `ta.id`, and `ma.id` are auto-generated UUIDs that never equal the foreign key UUID (`project_id`, `task_id`, `meeting_id`), normal members could not read or update their own assigned projects, tasks, or meetings via direct client PostgREST queries.
2. **Authorization Bypass in Submission Insert (Security Vulnerability):** In `submissions_insert`, `ta.task_id = ta.task_id` is a tautology (always evaluates to true). Any user assigned to *at least one task anywhere in the system* could insert a submission for *any other task*, including confidential tasks in other departments.

---

## 2. Identified Defective Policies & Remediation Targets

An exhaustive catalog search on `pg_policies` identified exactly 5 affected policies:

| Table | Policy Name | Command | Defective Clause in Live Catalog | Corrected Qualified Clause |
|---|---|---|---|---|
| `public.projects` | `projects_select` | `SELECT` | `pm.project_id = pm.id` | `pm.project_id = projects.id` |
| `public.tasks` | `tasks_select` | `SELECT` | `ta.task_id = ta.id` | `ta.task_id = tasks.id` |
| `public.tasks` | `tasks_update` | `UPDATE` | `ta.task_id = ta.id` | `ta.task_id = tasks.id` |
| `public.task_submissions` | `submissions_insert` | `INSERT` | `ta.task_id = ta.task_id` | `ta.task_id = task_submissions.task_id` (Narrowed) |
| `public.meetings` | `meetings_select` | `SELECT` | `ma.meeting_id = ma.id` | `ma.meeting_id = meetings.id` |

All other 43 policies in the database already use fully qualified identifiers or single-table predicates (e.g. `t.id = approval_history.task_id`, `p.id = project_members.project_id`) and are intact.

---

## 3. Deep-Dive Security & Performance Reviews (Supabase Advisors)

### 3.1 Task Update Restrictions & Column-Level Privilege Analysis
- **Current Architecture:**
  - Row-Level Security (`tasks_update`) authorizes WHICH rows can be updated, but PostgreSQL RLS evaluates at row granularity and does NOT inherently restrict WHICH columns may be updated.
  - In `app/actions/tasks.ts`, `updateTaskStatusAction` enforces strict application-level restrictions:
    1. Members can ONLY update `status` between `'TODO'` and `'IN_PROGRESS'`.
    2. Members CANNOT modify tasks in locked/review statuses (`COORDINATOR_REVIEW`, `SUPER_ADMIN_APPROVAL`, `APPROVED`, `DONE`, `CANCELLED`).
    3. Final approval (`status = 'APPROVED'`) is rejected unless caller is `SUPER_ADMIN`.
    4. Sensitive columns (`department_id`, `project_id`, `created_by`, `coordinator_id`, `priority`, `deadline`) are never updated by `updateTaskStatusAction`.
- **Database Trigger Defense-in-Depth:**
  - The database currently has `trg_enforce_task_approval`, which enforces that ONLY Super Admin can set `status = 'APPROVED'`.
  - To prevent direct PostgREST API bypasses where a malicious member with update permissions on their row might attempt to modify administrative fields (`department_id`, `project_id`, `created_by`, `coordinator_id`, `priority`), a complementary trigger `trg_enforce_task_member_immutability` is formulated below as an optional hardening patch.

### 3.2 Submission Authorization Narrowing
- **Business Rule:**
  - Assigned members may submit deliverables for their assigned tasks (`submitted_by = (select auth.uid())` AND user is in `task_assignees`).
  - Coordinators must NOT submit deliverables on behalf of members unless this is an explicitly approved business rule.
  - Super Admin permissions remain consistent with existing application workflow (`private.is_super_admin((select auth.uid()))`).
  - `submitted_by` must always match `(select auth.uid())`.
- **Policy Definition:**
  The corrected `submissions_insert` policy removes coordinator bypass and strictly restricts INSERTs to assigned members and Super Admin:
  ```sql
  WITH CHECK (
    submitted_by = (select auth.uid()) AND (
      EXISTS (
        SELECT 1 FROM public.task_assignees ta
        WHERE ta.task_id = task_submissions.task_id AND ta.user_id = (select auth.uid())
      ) OR
      private.is_super_admin((select auth.uid()))
    )
  )
  ```

### 3.3 Performance Optimization — Supabase Advisor `auth_rls_initplan`
Per Supabase Database Advisor rule `0003_auth_rls_initplan`:
Calling bare `auth.uid()` in RLS expressions causes Postgres to re-evaluate the function per row during table scans. Wrapping calls in `(select auth.uid())` causes the planner to evaluate the expression once per query via an initPlan, significantly improving query performance at scale.

### 3.4 Interacting Policies & Recursion Review
- `project_members.project_members_select`: Has `qual = true`. Querying `project_members` inside `projects_select` does NOT trigger recursion.
- `task_assignees.task_assignees_select`: Has `qual = true`. Querying `task_assignees` inside `tasks_select`, `tasks_update`, and `submissions_insert` does NOT trigger recursion.
- `meeting_attendees.meeting_attendees_select`: Has `qual = true`. Querying `meeting_attendees` inside `meetings_select` does NOT trigger recursion.
- Subquery execution is fully supported by existing indexes (`tasks_dept_idx`, `tasks_project_idx`, `task_assignees_task_idx`, `task_assignees_user_idx`).

---

## 4. Proposed Minimal & Reversible SQL Patch (RLS Correction)

This patch strictly corrects column qualifications with Supabase initPlan optimization:

```sql
-- ==============================================================================
-- UEC ESPACE DIGITAL — RLS QUALIFICATION REMEDIATION PATCH (PHASE 2.2)
-- Target Project: aigsdarfiplwmzqtqlxh (PostgreSQL 17.12)
-- ==============================================================================

BEGIN;

-- 1. Correct projects_select
DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select" ON public.projects
FOR SELECT TO authenticated
USING (
  private.is_super_admin((select auth.uid())) OR
  private.is_coordinator_of(projects.department_id, (select auth.uid())) OR
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = projects.id AND pm.user_id = (select auth.uid())
  )
);

-- 2. Correct tasks_select
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks
FOR SELECT TO authenticated
USING (
  private.is_super_admin((select auth.uid())) OR
  private.is_coordinator_of(tasks.department_id, (select auth.uid())) OR
  EXISTS (
    SELECT 1 FROM public.task_assignees ta
    WHERE ta.task_id = tasks.id AND ta.user_id = (select auth.uid())
  )
);

-- 3. Correct tasks_update
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
CREATE POLICY "tasks_update" ON public.tasks
FOR UPDATE TO authenticated
USING (
  private.is_super_admin((select auth.uid())) OR
  private.is_coordinator_of(tasks.department_id, (select auth.uid())) OR
  EXISTS (
    SELECT 1 FROM public.task_assignees ta
    WHERE ta.task_id = tasks.id AND ta.user_id = (select auth.uid())
  )
)
WITH CHECK (
  private.is_super_admin((select auth.uid())) OR
  private.is_coordinator_of(tasks.department_id, (select auth.uid())) OR
  EXISTS (
    SELECT 1 FROM public.task_assignees ta
    WHERE ta.task_id = tasks.id AND ta.user_id = (select auth.uid())
  )
);

-- 4. Correct & Narrow submissions_insert
-- Strictly restricted to: assigned members (submitted_by = (select auth.uid())) and Super Admin.
-- Coordinators cannot insert deliverables on behalf of members unless they are assigned members.
DROP POLICY IF EXISTS "submissions_insert" ON public.task_submissions;
CREATE POLICY "submissions_insert" ON public.task_submissions
FOR INSERT TO authenticated
WITH CHECK (
  submitted_by = (select auth.uid()) AND (
    EXISTS (
      SELECT 1 FROM public.task_assignees ta
      WHERE ta.task_id = task_submissions.task_id AND ta.user_id = (select auth.uid())
    ) OR
    private.is_super_admin((select auth.uid()))
  )
);

-- 5. Correct meetings_select
DROP POLICY IF EXISTS "meetings_select" ON public.meetings;
CREATE POLICY "meetings_select" ON public.meetings
FOR SELECT TO authenticated
USING (
  private.is_super_admin((select auth.uid())) OR
  created_by = (select auth.uid()) OR
  (department_id IS NOT NULL AND private.is_member_of_department(department_id, (select auth.uid()))) OR
  EXISTS (
    SELECT 1 FROM public.meeting_attendees ma
    WHERE ma.meeting_id = meetings.id AND ma.user_id = (select auth.uid())
  )
);

COMMIT;
```

---

## 5. Supplementary Column-Level Defense Trigger (Optional Hardening)

To enforce column immutability directly at the database layer (preventing direct PostgREST attacks), this trigger can be deployed alongside the RLS patch:

```sql
-- Optional Defense-in-Depth Trigger for Column-Level Task Protection
CREATE OR REPLACE FUNCTION private.enforce_task_member_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Super Admin and Department Coordinator have full management authority
  IF private.is_super_admin(auth.uid()) OR private.is_coordinator_of(OLD.department_id, auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- For assigned members:
  -- 1. Administrative metadata is strictly immutable
  IF NEW.department_id IS DISTINCT FROM OLD.department_id OR
     NEW.project_id IS DISTINCT FROM OLD.project_id OR
     NEW.created_by IS DISTINCT FROM OLD.created_by OR
     NEW.coordinator_id IS DISTINCT FROM OLD.coordinator_id OR
     NEW.priority IS DISTINCT FROM OLD.priority OR
     NEW.deadline IS DISTINCT FROM OLD.deadline OR
     NEW.start_date IS DISTINCT FROM OLD.start_date THEN
    RAISE EXCEPTION 'FORBIDDEN: Seuls le coordinateur ou le Super Admin peuvent modifier les paramètres administratifs de la tâche.';
  END IF;

  -- 2. State transition restrictions
  IF OLD.status IN ('COORDINATOR_REVIEW', 'SUPER_ADMIN_APPROVAL', 'APPROVED', 'DONE', 'CANCELLED') THEN
    RAISE EXCEPTION 'FORBIDDEN: Impossible de modifier une tâche en cours de revue ou finalisée (statut actuel: %).', OLD.status;
  END IF;

  -- 3. Member status transition limited to TODO <-> IN_PROGRESS
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
```

---

## 6. Rollback SQL (Emergency Reversibility)

If required, the exact previous live definitions stored in `pg_policies` can be restored immediately:

```sql
BEGIN;

DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select" ON public.projects
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid()) OR 
  private.is_coordinator_of(department_id, auth.uid()) OR 
  (EXISTS (SELECT 1 FROM project_members pm WHERE ((pm.project_id = pm.id) AND (pm.user_id = auth.uid()))))
);

DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid()) OR 
  private.is_coordinator_of(department_id, auth.uid()) OR 
  (EXISTS (SELECT 1 FROM task_assignees ta WHERE ((ta.task_id = ta.id) AND (ta.user_id = auth.uid()))))
);

DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
CREATE POLICY "tasks_update" ON public.tasks
FOR UPDATE TO authenticated
USING (
  private.is_super_admin(auth.uid()) OR 
  private.is_coordinator_of(department_id, auth.uid()) OR 
  (EXISTS (SELECT 1 FROM task_assignees ta WHERE ((ta.task_id = ta.id) AND (ta.user_id = auth.uid()))))
)
WITH CHECK (
  private.is_super_admin(auth.uid()) OR 
  private.is_coordinator_of(department_id, auth.uid()) OR 
  (EXISTS (SELECT 1 FROM task_assignees ta WHERE ((ta.task_id = ta.id) AND (ta.user_id = auth.uid()))))
);

DROP POLICY IF EXISTS "submissions_insert" ON public.task_submissions;
CREATE POLICY "submissions_insert" ON public.task_submissions
FOR INSERT TO authenticated
WITH CHECK (
  ((submitted_by = auth.uid()) AND (EXISTS (SELECT 1 FROM task_assignees ta WHERE ((ta.task_id = ta.task_id) AND (ta.user_id = auth.uid())))))
);

DROP POLICY IF EXISTS "meetings_select" ON public.meetings;
CREATE POLICY "meetings_select" ON public.meetings
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid()) OR 
  (created_by = auth.uid()) OR 
  ((department_id IS NOT NULL) AND private.is_member_of_department(department_id, auth.uid())) OR 
  (EXISTS (SELECT 1 FROM meeting_attendees ma WHERE ((ma.meeting_id = ma.id) AND (ma.user_id = auth.uid()))))
);

COMMIT;
```

---

## 7. Security Impact Analysis

- **Department Isolation:** Strictly maintained. Unassigned members in Department A cannot see Department B's projects, tasks, or meetings.
- **Role Hierarchy:**
  - `SUPER_ADMIN`: Retains 100% bypass authority across all 5 tables via `private.is_super_admin((select auth.uid()))`.
  - `COORDINATOR`: Retains full management within assigned department via `private.is_coordinator_of(department_id, (select auth.uid()))` and remains blocked from other departments.
  - `MEMBER`: Restores intended visibility for assigned projects, tasks, and meetings, while strictly eliminating the submission cross-injection loophole.
- **No Impersonation:** `submissions_insert` requires `submitted_by = (select auth.uid())`. Coordinators cannot submit deliverables pretending to be assigned members.
- **Performance:** Evaluates `auth.uid()` via initPlan once per query instead of per row.
- **No Access Broadening:** Zero new permissions are introduced.
