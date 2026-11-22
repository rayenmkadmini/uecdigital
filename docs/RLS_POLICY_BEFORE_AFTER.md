# UEC ESPACE DIGITAL — RLS POLICY BEFORE & AFTER
## Detailed Policy Definition Comparison & Live Catalog Verification

**Supabase Target:** `aigsdarfiplwmzqtqlxh` (PostgreSQL 17.12, region `eu-west-1`)  
**Execution Timestamp:** `2026-11-21T11:32:46Z` (`12:32:46+01:00`)  
**Document Ref:** Phase 2.2 Schema Hardening  
**Status:** **APPLIED & VERIFIED IN LIVE CATALOG**

---

### 1. `public.projects` — `projects_select`

#### Live Catalog Definition (BEFORE)
```sql
-- Stored in pg_policies.qual (BEFORE):
(
  private.is_super_admin(auth.uid()) OR 
  private.is_coordinator_of(department_id, auth.uid()) OR 
  (EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE ((pm.project_id = pm.id) AND (pm.user_id = auth.uid()))
  ))
)
```
*Exact Flaw:* `pm.project_id = pm.id` was comparing foreign key to primary key of the same subquery table, blocking assigned members from reading their projects.

#### Live Catalog Definition (AFTER — VERIFIED)
```sql
-- Stored in pg_policies.qual (LIVE):
(
  private.is_super_admin(( SELECT auth.uid() AS uid)) OR 
  private.is_coordinator_of(department_id, ( SELECT auth.uid() AS uid)) OR 
  (EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE ((pm.project_id = projects.id) AND (pm.user_id = ( SELECT auth.uid() AS uid)))
  ))
)
```
*Resolution:* Qualified outer-table reference `pm.project_id = projects.id` restores member read access. Replaced bare `auth.uid()` with `(select auth.uid())` per Supabase initPlan optimization.

---

### 2. `public.tasks` — `tasks_select`

#### Live Catalog Definition (BEFORE)
```sql
-- Stored in pg_policies.qual (BEFORE):
(
  private.is_super_admin(auth.uid()) OR 
  private.is_coordinator_of(department_id, auth.uid()) OR 
  (EXISTS (
    SELECT 1 FROM task_assignees ta 
    WHERE ((ta.task_id = ta.id) AND (ta.user_id = auth.uid()))
  ))
)
```
*Exact Flaw:* `ta.task_id = ta.id` blocked assigned members from viewing their assigned tasks.

#### Live Catalog Definition (AFTER — VERIFIED)
```sql
-- Stored in pg_policies.qual (LIVE):
(
  private.is_super_admin(( SELECT auth.uid() AS uid)) OR 
  private.is_coordinator_of(department_id, ( SELECT auth.uid() AS uid)) OR 
  (EXISTS (
    SELECT 1 FROM task_assignees ta 
    WHERE ((ta.task_id = tasks.id) AND (ta.user_id = ( SELECT auth.uid() AS uid)))
  ))
)
```
*Resolution:* Qualified outer-table reference `ta.task_id = tasks.id` restores member task visibility.

---

### 3. `public.tasks` — `tasks_update`

#### Live Catalog Definition (BEFORE)
```sql
-- Stored in pg_policies.qual & with_check (BEFORE):
(
  private.is_super_admin(auth.uid()) OR 
  private.is_coordinator_of(department_id, auth.uid()) OR 
  (EXISTS (
    SELECT 1 FROM task_assignees ta 
    WHERE ((ta.task_id = ta.id) AND (ta.user_id = auth.uid()))
  ))
)
```
*Exact Flaw:* `ta.task_id = ta.id` prevented members from updating task status (e.g. `TODO` -> `IN_PROGRESS`).

#### Live Catalog Definition (AFTER — VERIFIED)
```sql
-- Stored in pg_policies.qual & with_check (LIVE):
(
  private.is_super_admin(( SELECT auth.uid() AS uid)) OR 
  private.is_coordinator_of(department_id, ( SELECT auth.uid() AS uid)) OR 
  (EXISTS (
    SELECT 1 FROM task_assignees ta 
    WHERE ((ta.task_id = tasks.id) AND (ta.user_id = ( SELECT auth.uid() AS uid)))
  ))
)
```
*Resolution:* Qualified outer-table reference `ta.task_id = tasks.id` in both `USING` and `WITH CHECK`.

---

### 4. `public.task_submissions` — `submissions_insert`

#### Live Catalog Definition (BEFORE)
```sql
-- Stored in pg_policies.with_check (BEFORE):
(
  (submitted_by = auth.uid()) AND 
  (EXISTS (
    SELECT 1 FROM task_assignees ta 
    WHERE ((ta.task_id = ta.task_id) AND (ta.user_id = auth.uid()))
  ))
)
```
*Exact Flaw:* `ta.task_id = ta.task_id` was a tautology, allowing any user with any assigned task to insert submissions into any task system-wide.

#### Live Catalog Definition (AFTER — VERIFIED)
```sql
-- Stored in pg_policies.with_check (LIVE):
(
  (submitted_by = ( SELECT auth.uid() AS uid)) AND 
  (
    (EXISTS (
      SELECT 1 FROM task_assignees ta 
      WHERE ((ta.task_id = task_submissions.task_id) AND (ta.user_id = ( SELECT auth.uid() AS uid)))
    )) OR 
    private.is_super_admin(( SELECT auth.uid() AS uid))
  )
)
```
*Resolution:* Outer-table correlation `ta.task_id = task_submissions.task_id` eliminates the tautology. Narrowed to assigned members and Super Admin only, preventing coordinators from submitting on behalf of members.

---

### 5. `public.meetings` — `meetings_select`

#### Live Catalog Definition (BEFORE)
```sql
-- Stored in pg_policies.qual (BEFORE):
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
*Exact Flaw:* `ma.meeting_id = ma.id` prevented attendees from viewing cross-department meetings.

#### Live Catalog Definition (AFTER — VERIFIED)
```sql
-- Stored in pg_policies.qual (LIVE):
(
  private.is_super_admin(( SELECT auth.uid() AS uid)) OR 
  (created_by = ( SELECT auth.uid() AS uid)) OR 
  ((department_id IS NOT NULL) AND private.is_member_of_department(department_id, ( SELECT auth.uid() AS uid))) OR 
  (EXISTS (
    SELECT 1 FROM meeting_attendees ma 
    WHERE ((ma.meeting_id = meetings.id) AND (ma.user_id = ( SELECT auth.uid() AS uid)))
  ))
)
```
*Resolution:* Qualified outer-table reference `ma.meeting_id = meetings.id` restores attendee visibility.
