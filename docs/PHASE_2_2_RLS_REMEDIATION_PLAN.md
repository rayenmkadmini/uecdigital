# UEC ESPACE DIGITAL — PHASE 2.2 RLS REMEDIATION PLAN & EXECUTION REPORT
## Critical RLS Policy Correction & Database Security Validation

**Project:** UEC — Espace Digital  
**Supabase Project Ref:** `aigsdarfiplwmzqtqlxh` (PostgreSQL 17.12, region `eu-west-1`)  
**Branch:** `feature/uec-espace-digital`  
**Execution Timestamp:** `2026-11-21T11:32:46Z` (`12:32:46+01:00`)  
**Remediation Status:** **APPLIED & VERIFIED IN LIVE CATALOG**

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
2. **Authorization Bypass in Submission Insert (Security Vulnerability):** In `submissions_insert`, `ta.task_id = ta.task_id` was a tautology (always evaluated to true). Any user assigned to *at least one task anywhere in the system* could insert a submission for *any other task*, including confidential tasks in other departments.

---

## 2. Remediated Policies & Final Status

| Table | Policy Name | Command | Defective Clause in Live Catalog | Remediated Clause (Applied Live) | Status |
|---|---|---|---|---|---|
| `public.projects` | `projects_select` | `SELECT` | `pm.project_id = pm.id` | `pm.project_id = projects.id` + initPlan | **APPLIED & VERIFIED** |
| `public.tasks` | `tasks_select` | `SELECT` | `ta.task_id = ta.id` | `ta.task_id = tasks.id` + initPlan | **APPLIED & VERIFIED** |
| `public.tasks` | `tasks_update` | `UPDATE` | `ta.task_id = ta.id` | `ta.task_id = tasks.id` (USING + WITH CHECK) + initPlan | **APPLIED & VERIFIED** |
| `public.task_submissions` | `submissions_insert` | `INSERT` | `ta.task_id = ta.task_id` | `ta.task_id = task_submissions.task_id` (Narrowed) + initPlan | **APPLIED & VERIFIED** |
| `public.meetings` | `meetings_select` | `SELECT` | `ma.meeting_id = ma.id` | `ma.meeting_id = meetings.id` + initPlan | **APPLIED & VERIFIED** |

All other 50 policies in the database remain intact.

---

## 3. Applied Live SQL Patch

The following DDL statements were executed against `aigsdarfiplwmzqtqlxh`:

```sql
-- Executed on aigsdarfiplwmzqtqlxh at 2026-11-21 11:32:46 UTC

-- 1. projects_select
ALTER POLICY "projects_select" ON public.projects
USING (
  private.is_super_admin((select auth.uid())) OR
  private.is_coordinator_of(projects.department_id, (select auth.uid())) OR
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = projects.id AND pm.user_id = (select auth.uid())
  )
);

-- 2. tasks_select
ALTER POLICY "tasks_select" ON public.tasks
USING (
  private.is_super_admin((select auth.uid())) OR
  private.is_coordinator_of(tasks.department_id, (select auth.uid())) OR
  EXISTS (
    SELECT 1 FROM public.task_assignees ta
    WHERE ta.task_id = tasks.id AND ta.user_id = (select auth.uid())
  )
);

-- 3. tasks_update
ALTER POLICY "tasks_update" ON public.tasks
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

-- 4. submissions_insert (Narrowed: Assigned members + Super Admin only)
ALTER POLICY "submissions_insert" ON public.task_submissions
WITH CHECK (
  submitted_by = (select auth.uid()) AND (
    EXISTS (
      SELECT 1 FROM public.task_assignees ta
      WHERE ta.task_id = task_submissions.task_id AND ta.user_id = (select auth.uid())
    ) OR
    private.is_super_admin((select auth.uid()))
  )
);

-- 5. meetings_select
ALTER POLICY "meetings_select" ON public.meetings
USING (
  private.is_super_admin((select auth.uid())) OR
  created_by = (select auth.uid()) OR
  (department_id IS NOT NULL AND private.is_member_of_department(department_id, (select auth.uid()))) OR
  EXISTS (
    SELECT 1 FROM public.meeting_attendees ma
    WHERE ma.meeting_id = meetings.id AND ma.user_id = (select auth.uid())
  )
);
```

---

## 4. Live Catalog Verification Results

A query on `pg_policies` immediately following commit confirms:

1. **`meetings_select`**:
   - `qual`: `(private.is_super_admin(( SELECT auth.uid() AS uid)) OR (created_by = ( SELECT auth.uid() AS uid)) OR ((department_id IS NOT NULL) AND private.is_member_of_department(department_id, ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1 FROM meeting_attendees ma WHERE ((ma.meeting_id = meetings.id) AND (ma.user_id = ( SELECT auth.uid() AS uid))))))`
   - Outer-table reference `meetings.id` confirmed.

2. **`projects_select`**:
   - `qual`: `(private.is_super_admin(( SELECT auth.uid() AS uid)) OR private.is_coordinator_of(department_id, ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1 FROM project_members pm WHERE ((pm.project_id = projects.id) AND (pm.user_id = ( SELECT auth.uid() AS uid))))))`
   - Outer-table reference `projects.id` confirmed.

3. **`submissions_insert`**:
   - `with_check`: `((submitted_by = ( SELECT auth.uid() AS uid)) AND ((EXISTS ( SELECT 1 FROM task_assignees ta WHERE ((ta.task_id = task_submissions.task_id) AND (ta.user_id = ( SELECT auth.uid() AS uid))))) OR private.is_super_admin(( SELECT auth.uid() AS uid))))`
   - Outer-table reference `task_submissions.task_id` confirmed; tautology eliminated; coordinator impersonation blocked.

4. **`tasks_select`**:
   - `qual`: `(private.is_super_admin(( SELECT auth.uid() AS uid)) OR private.is_coordinator_of(department_id, ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1 FROM task_assignees ta WHERE ((ta.task_id = tasks.id) AND (ta.user_id = ( SELECT auth.uid() AS uid))))))`
   - Outer-table reference `tasks.id` confirmed.

5. **`tasks_update`**:
   - Both `qual` and `with_check` confirmed with `ta.task_id = tasks.id` and `( SELECT auth.uid() AS uid)`.

---

## 5. Rollback SQL (Emergency Reversibility)

If an emergency restoration to the pre-remediation baseline is ever required:

```sql
BEGIN;

ALTER POLICY "projects_select" ON public.projects
USING (
  private.is_super_admin(auth.uid()) OR 
  private.is_coordinator_of(department_id, auth.uid()) OR 
  (EXISTS (SELECT 1 FROM project_members pm WHERE ((pm.project_id = pm.id) AND (pm.user_id = auth.uid()))))
);

ALTER POLICY "tasks_select" ON public.tasks
USING (
  private.is_super_admin(auth.uid()) OR 
  private.is_coordinator_of(department_id, auth.uid()) OR 
  (EXISTS (SELECT 1 FROM task_assignees ta WHERE ((ta.task_id = ta.id) AND (ta.user_id = auth.uid()))))
);

ALTER POLICY "tasks_update" ON public.tasks
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

ALTER POLICY "submissions_insert" ON public.task_submissions
WITH CHECK (
  ((submitted_by = auth.uid()) AND (EXISTS (SELECT 1 FROM task_assignees ta WHERE ((ta.task_id = ta.task_id) AND (ta.user_id = auth.uid())))))
);

ALTER POLICY "meetings_select" ON public.meetings
USING (
  private.is_super_admin(auth.uid()) OR 
  (created_by = auth.uid()) OR 
  ((department_id IS NOT NULL) AND private.is_member_of_department(department_id, auth.uid())) OR 
  (EXISTS (SELECT 1 FROM meeting_attendees ma WHERE ((ma.meeting_id = ma.id) AND (ma.user_id = auth.uid()))))
);

COMMIT;
```

---

## 6. Security Impact Analysis

- **Department Isolation:** Strictly maintained. Unassigned members in Department A cannot see Department B's projects, tasks, or meetings.
- **Role Hierarchy:**
  - `SUPER_ADMIN`: Retains 100% bypass authority across all 5 tables via `private.is_super_admin((select auth.uid()))`.
  - `COORDINATOR`: Retains full management within assigned department via `private.is_coordinator_of(department_id, (select auth.uid()))` and remains blocked from other departments.
  - `MEMBER`: Restores intended visibility for assigned projects, tasks, and meetings, while strictly eliminating the submission cross-injection loophole.
- **No Impersonation:** `submissions_insert` requires `submitted_by = (select auth.uid())`. Coordinators cannot submit deliverables pretending to be assigned members.
- **Performance:** Evaluates `auth.uid()` via initPlan once per query instead of per row.
- **Scope Compliance:** Zero additional triggers created; zero table/column/data changes executed.
