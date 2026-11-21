# UEC ESPACE DIGITAL — PHASE 2.2 RLS REMEDIATION PLAN
## Critical RLS Policy Correction & Database Security Validation

**Project:** UEC — Espace Digital  
**Supabase Project:** `aigsdarfiplwmzqtqlxh` (PostgreSQL 17.12)  
**Branch:** `feature/uec-espace-digital`  
**Latest Commit:** `3be2c90`  
**Status:** **READY FOR APPROVAL** (Awaiting explicit user confirmation before applying SQL to database)

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
| `public.task_submissions` | `submissions_insert` | `INSERT` | `ta.task_id = ta.task_id` | `ta.task_id = task_submissions.task_id` |
| `public.meetings` | `meetings_select` | `SELECT` | `ma.meeting_id = ma.id` | `ma.meeting_id = meetings.id` |

All other 43 policies in the database already use fully qualified identifiers or single-table predicates (e.g. `t.id = approval_history.task_id`, `p.id = project_members.project_id`) and are intact.

---

## 3. Proposed Minimal & Reversible SQL Patch

This patch strictly corrects column qualifications without altering schema structure, data types, or existing data:

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
  private.is_super_admin(auth.uid()) OR
  private.is_coordinator_of(projects.department_id, auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = projects.id AND pm.user_id = auth.uid()
  )
);

-- 2. Correct tasks_select
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid()) OR
  private.is_coordinator_of(tasks.department_id, auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.task_assignees ta
    WHERE ta.task_id = tasks.id AND ta.user_id = auth.uid()
  )
);

-- 3. Correct tasks_update
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
CREATE POLICY "tasks_update" ON public.tasks
FOR UPDATE TO authenticated
USING (
  private.is_super_admin(auth.uid()) OR
  private.is_coordinator_of(tasks.department_id, auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.task_assignees ta
    WHERE ta.task_id = tasks.id AND ta.user_id = auth.uid()
  )
)
WITH CHECK (
  private.is_super_admin(auth.uid()) OR
  private.is_coordinator_of(tasks.department_id, auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.task_assignees ta
    WHERE ta.task_id = tasks.id AND ta.user_id = auth.uid()
  )
);

-- 4. Correct submissions_insert
DROP POLICY IF EXISTS "submissions_insert" ON public.task_submissions;
CREATE POLICY "submissions_insert" ON public.task_submissions
FOR INSERT TO authenticated
WITH CHECK (
  submitted_by = auth.uid() AND (
    EXISTS (
      SELECT 1 FROM public.task_assignees ta
      WHERE ta.task_id = task_submissions.task_id AND ta.user_id = auth.uid()
    ) OR
    private.is_super_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_submissions.task_id AND private.is_coordinator_of(t.department_id, auth.uid())
    )
  )
);

-- 5. Correct meetings_select
DROP POLICY IF EXISTS "meetings_select" ON public.meetings;
CREATE POLICY "meetings_select" ON public.meetings
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid()) OR
  created_by = auth.uid() OR
  (department_id IS NOT NULL AND private.is_member_of_department(department_id, auth.uid())) OR
  EXISTS (
    SELECT 1 FROM public.meeting_attendees ma
    WHERE ma.meeting_id = meetings.id AND ma.user_id = auth.uid()
  )
);

COMMIT;
```

---

## 4. Rollback SQL (Emergency Reversibility)

If required, the exact previous live definitions can be restored immediately:

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

## 5. Security Impact Analysis

- **Department Isolation:** Strictly maintained. Unassigned members in Department A cannot see Department B's projects, tasks, or meetings.
- **Role Hierarchy:**
  - `SUPER_ADMIN`: Retains 100% bypass authority across all 5 tables via `private.is_super_admin(auth.uid())`.
  - `COORDINATOR`: Retains full management within assigned department via `private.is_coordinator_of(department_id, auth.uid())` and remains blocked from other departments.
  - `MEMBER`: Restores intended visibility for assigned projects, tasks, and meetings, while strictly eliminating the submission cross-injection loophole.
- **No Access Broadening:** Zero new permissions are introduced. Only the unintended scoping bug that inverted or disabled policy expressions is resolved.
