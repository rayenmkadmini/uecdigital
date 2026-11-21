# UEC ESPACE DIGITAL — RLS POLICY BEFORE & AFTER
## Detailed Policy Definition Comparison & Column Scoping Analysis

**Supabase Target:** `aigsdarfiplwmzqtqlxh` (PostgreSQL 17.12)  
**Document Ref:** Phase 2.2 Schema Hardening  
**Status:** READY FOR EXPLICIT APPROVAL

---

### 1. `public.projects` — `projects_select`

#### Live Catalog Definition (BEFORE)
```sql
-- Stored in pg_policies.qual:
(
  private.is_super_admin(auth.uid()) OR 
  private.is_coordinator_of(department_id, auth.uid()) OR 
  (EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE ((pm.project_id = pm.id) AND (pm.user_id = auth.uid()))
  ))
)
```

#### Exact Flaw
In `WHERE pm.project_id = id`, PostgreSQL resolves `id` as `pm.id` (primary key of `project_members`).
Because `pm.project_id` and `pm.id` are separate UUIDs, `pm.project_id = pm.id` is false.
**Impact:** A member assigned to a project in `project_members` cannot read the project via direct PostgREST SELECT queries.

#### Corrected Definition (AFTER)
```sql
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
```

---

### 2. `public.tasks` — `tasks_select`

#### Live Catalog Definition (BEFORE)
```sql
-- Stored in pg_policies.qual:
(
  private.is_super_admin(auth.uid()) OR 
  private.is_coordinator_of(department_id, auth.uid()) OR 
  (EXISTS (
    SELECT 1 FROM task_assignees ta 
    WHERE ((ta.task_id = ta.id) AND (ta.user_id = auth.uid()))
  ))
)
```

#### Exact Flaw
`ta.task_id = id` resolves as `ta.task_id = ta.id`.
**Impact:** Assigned members cannot view their own tasks via direct PostgREST SELECT queries.

#### Corrected Definition (AFTER)
```sql
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
```

---

### 3. `public.tasks` — `tasks_update` & Column-Level Security

#### Live Catalog Definition (BEFORE)
```sql
-- Stored in pg_policies.qual & with_check:
(
  private.is_super_admin(auth.uid()) OR 
  private.is_coordinator_of(department_id, auth.uid()) OR 
  (EXISTS (
    SELECT 1 FROM task_assignees ta 
    WHERE ((ta.task_id = ta.id) AND (ta.user_id = auth.uid()))
  ))
)
```

#### Exact Flaw
`ta.task_id = id` resolves as `ta.task_id = ta.id`.
**Impact:** Assigned members cannot update task status (e.g. `TODO` -> `IN_PROGRESS`) via direct PostgREST UPDATE queries.

#### Corrected Definition (AFTER)
```sql
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
```

#### Column-Level Security Evaluation
- PostgreSQL RLS policies evaluate row access, not column modifications.
- At application level, Server Action `updateTaskStatusAction` (`app/actions/tasks.ts`) restricts members strictly to `{ status: 'TODO' | 'IN_PROGRESS' }` and rejects updates if the task is in any review or locked state.
- For defense-in-depth against direct REST API tampering, a PostgreSQL `BEFORE UPDATE` trigger (`private.enforce_task_member_immutability`) is proposed to make `department_id`, `project_id`, `created_by`, `coordinator_id`, and `priority` immutable for non-coordinators/non-admins.

---

### 4. `public.task_submissions` — `submissions_insert`

#### Live Catalog Definition (BEFORE)
```sql
-- Stored in pg_policies.with_check:
(
  (submitted_by = auth.uid()) AND 
  (EXISTS (
    SELECT 1 FROM task_assignees ta 
    WHERE ((ta.task_id = ta.task_id) AND (ta.user_id = auth.uid()))
  ))
)
```

#### Exact Flaw
`ta.task_id = task_id` resolves as `ta.task_id = ta.task_id`.
Because `ta.task_id = ta.task_id` is always true, the check only asks: *"Does `auth.uid()` have any task assigned anywhere in the database?"*
**Security Vulnerability:** A member in Department A assigned to Task 1 can insert a fake or unauthorized submission into Task 99 in Department B!

#### Corrected & Narrowed Definition (AFTER)
```sql
DROP POLICY IF EXISTS "submissions_insert" ON public.task_submissions;
CREATE POLICY "submissions_insert" ON public.task_submissions
FOR INSERT TO authenticated
WITH CHECK (
  submitted_by = auth.uid() AND (
    EXISTS (
      SELECT 1 FROM public.task_assignees ta
      WHERE ta.task_id = task_submissions.task_id AND ta.user_id = auth.uid()
    ) OR
    private.is_super_admin(auth.uid())
  )
);
```

#### Business Rule Validation
1. **Assigned Members Only:** A member can ONLY submit deliverables for tasks where an explicit assignment exists in `task_assignees` for `task_submissions.task_id`.
2. **Coordinators Excluded From Submitting On Behalf of Members:** Coordinators cannot submit deliverables for a task unless they themselves are an assigned member (`task_assignees`) or Super Admin.
3. **No Impersonation:** `submitted_by = auth.uid()` is strictly mandatory.
4. **Super Admin Parity:** Super Admins can submit or ingest deliverables system-wide.

---

### 5. `public.meetings` — `meetings_select`

#### Live Catalog Definition (BEFORE)
```sql
-- Stored in pg_policies.qual:
(
  private.is_super_admin(auth.uid()) OR 
  (created_by = auth.uid()) OR 
  ((department_id IS NOT NULL) AND private.is_member_of_department(department_id, auth.uid())) OR 
  (EXISTS (
    SELECT 1 FROM meeting_attendees ma 
    WHERE ((ma.meeting_id = ma.id) AND (ma.user_id = auth.uid()))
  ))
)
```

#### Exact Flaw
`ma.meeting_id = id` resolves as `ma.meeting_id = ma.id`.
**Impact:** Cross-department meeting invitees who are listed in `meeting_attendees` cannot view the meeting record via direct PostgREST SELECT queries.

#### Corrected Definition (AFTER)
```sql
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
```
