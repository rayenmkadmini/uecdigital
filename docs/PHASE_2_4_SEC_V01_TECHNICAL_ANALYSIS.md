# UEC ESPACE DIGITAL — PHASE 2.4 SEC-V01 DEEP TECHNICAL ANALYSIS
## Direct PostgREST Column-Level Mutation Surface on `public.tasks`

**Finding ID:** `SEC-V01`  
**Classification:** **CONFIRMED VULNERABILITY (Direct PostgREST API Surface) / MITIGATED (Application UI & Server Actions)**  
**Severity:** **MEDIUM**  
**Target Table:** `public.tasks`  
**Target Policy:** `tasks_update` (`UPDATE ON public.tasks FOR authenticated`)  
**Database:** PostgreSQL 17.12 on Supabase (`aigsdarfiplwmzqtqlxh`)  
**Date:** 2026-11-21  

---

## 1. Technical Executive Summary

In Supabase, client applications interact with the database through two primary avenues:
1. **Next.js Server Actions:** Node.js server-side code executing with authenticated Supabase sessions.
2. **Direct PostgREST REST API (`/rest/v1/...`):** Direct HTTP endpoints exposed to any client holding a valid Supabase JWT and publishable key.

During Phase 2.3, an architectural disparity was identified:
- **At the Application Layer (Server Actions):** Server Action `updateTaskStatusAction` (`app/actions/tasks.ts`) is strictly locked down. It only updates the `status` column, strictly restricts members to `{ status: 'TODO' | 'IN_PROGRESS' }`, and prevents editing locked/review tasks.
- **At the Database Engine Layer (PostgreSQL RLS):** The RLS policy `tasks_update` operates at **row granularity**. PostgreSQL table-level `UPDATE` grants allow the role `authenticated` to update any column of a row that satisfies the `USING` and `WITH CHECK` predicates.
- Because an assigned member satisfies the `USING` and `WITH CHECK` clauses for their assigned task row, an authenticated member issuing a direct HTTP `PATCH /rest/v1/tasks?id=eq.<task_id>` can modify sensitive administrative columns (`priority`, `deadline`, `department_id`, etc.) that are disallowed by the application UI.

---

## 2. Answers to the Eight Mandatory Technical Questions

### Question 1: Can an assigned MEMBER update a task through direct PostgREST?
- **Answer:** **YES (Confirmed Vulnerability).**
- **Technical Proof:**  
  The live catalog policy `tasks_update` on `public.tasks` is defined as:
  ```sql
  CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    private.is_super_admin(( SELECT auth.uid() AS uid)) OR 
    private.is_coordinator_of(department_id, ( SELECT auth.uid() AS uid)) OR 
    (EXISTS (
      SELECT 1 FROM task_assignees ta 
      WHERE ((ta.task_id = tasks.id) AND (ta.user_id = ( SELECT auth.uid() AS uid)))
    ))
  )
  WITH CHECK (
    private.is_super_admin(( SELECT auth.uid() AS uid)) OR 
    private.is_coordinator_of(department_id, ( SELECT auth.uid() AS uid)) OR 
    (EXISTS (
      SELECT 1 FROM task_assignees ta 
      WHERE ((ta.task_id = tasks.id) AND (ta.user_id = ( SELECT auth.uid() AS uid)))
    ))
  );
  ```
  When an assigned member sends `PATCH /rest/v1/tasks?id=eq.<task_id>`, PostgreSQL checks the `USING` clause. Because `ta.task_id = tasks.id AND ta.user_id = auth.uid()` is TRUE, the row is authorized for update. When writing the updated row, PostgreSQL checks `WITH CHECK`, which also evaluates to TRUE because the assignment record still exists. The update succeeds with HTTP 200.

---

### Question 2: Which columns can the MEMBER potentially modify?
- **Answer:** **Every column of `public.tasks` except setting `status = 'APPROVED'`.**
- **Technical Proof:**  
  Querying `information_schema.column_privileges` confirms that role `authenticated` holds `UPDATE` privileges across all 14 columns of `public.tasks`:
  - `id`
  - `project_id`
  - `department_id`
  - `title`
  - `description`
  - `acceptance_criteria`
  - `priority`
  - `status`
  - `start_date`
  - `deadline`
  - `created_by`
  - `coordinator_id`
  - `created_at`
  - `updated_at`
  The database trigger `trg_enforce_task_approval` only intercepts updates where `NEW.status = 'APPROVED'`. All other 13 columns are unconstrained by database triggers.

---

### Question 3: Can a MEMBER modify `title`, `description`, `priority`, `deadline`, `department_id`, `project_id`, `coordinator_id`, or `created_by`?
- **Via Official Application (Server Actions):** **NO.** `updateTaskStatusAction` only submits `{ status: newStatus }` and throws `AuthorizationError` if any other modification is attempted.
- **Via Direct PostgREST API:** **YES (Confirmed Vulnerability).** An attacker with a member JWT can construct an HTTP PATCH payload containing:
  ```json
  {
    "priority": "CRITICAL",
    "department_id": "<unauthorized_department_uuid>",
    "project_id": "<unauthorized_project_uuid>",
    "coordinator_id": "<arbitrary_user_uuid>",
    "created_by": "<arbitrary_user_uuid>",
    "deadline": "2099-12-31T23:59:59Z"
  }
  ```
  Because the row is assigned to the member in `task_assignees`, PostgREST executes the update directly.

---

### Question 4: Can a MEMBER change the task status to an unauthorized state?
- **Via Official Application:** **NO.** `updateTaskStatusAction` strictly requires `newStatus === 'TODO' || newStatus === 'IN_PROGRESS'`.
- **Via Direct PostgREST API:** **YES (except 'APPROVED').**
  - Setting `status = 'APPROVED'` is blocked by trigger `trg_enforce_task_approval` (raises `APPROVAL_VIOLATION`).
  - However, setting `status = 'DONE'`, `'CANCELLED'`, `'COORDINATOR_REVIEW'`, `'SUPER_ADMIN_APPROVAL'`, `'BACKLOG'`, or `'REVISION_REQUIRED'` would succeed via direct REST, bypassing the required coordinator review and submission workflow!

---

### Question 5: Can a Coordinator update tasks outside their department?
- **Answer:** **NO (Verified Protected).**
- **Technical Proof:**  
  The policy `tasks_update` enforces:
  `private.is_coordinator_of(department_id, (SELECT auth.uid())) OR EXISTS (SELECT 1 FROM task_assignees ...)`
  If Coordinator of Department A attempts to update a task in Department B (and is not an assigned task member), both conditions evaluate to FALSE. PostgREST rejects the request or returns 0 rows updated.

---

### Question 6: Can a Coordinator modify a task after submission?
- **Via Official Application:** **Controlled.** `app/actions/approvals.ts` only permits `submitCoordinatorReview`, which moves the task to `SUPER_ADMIN_APPROVAL` or `REVISION_REQUIRED`. If the task is locked (`is_locked = true`), review is blocked.
- **Via Direct PostgREST API:** **YES (Theoretical Attack Path).** Currently, `tasks_update` grants unconditional update permissions to the department coordinator. There is no trigger checking whether `OLD.status` is in a review or locked state for coordinators.

---

### Question 7: Can a Super Admin perform all intended operations?
- **Answer:** **YES (Verified Authorized).**
- **Technical Proof:**  
  `private.is_super_admin((SELECT auth.uid()))` evaluates to TRUE for Super Admin across all policies, and `trg_enforce_task_approval` explicitly permits Super Admin to set `status = 'APPROVED'`.

---

### Question 8: Are existing Server Actions consistent with database-level permissions?
- **Answer:** **NO — Server Actions are strictly more restrictive than database RLS.**
  - Server Actions enforce principle of least privilege, column filtering, and workflow state machines.
  - Database RLS permits row-wide column updates for any row the member is assigned to.
  - To achieve true enterprise defense-in-depth, database-level enforcement must match application-level rules.

---

## 3. Threat Classification Matrix

| Threat Scenario | Vector | Status | Defense Layer |
|---|---|:---:|---|
| Member updates status to `DONE` via web UI | Browser UI | **PREVENTED** | Server Action `updateTaskStatusAction` |
| Member modifies `department_id` via web UI | Browser UI | **PREVENTED** | Server Action rejects input |
| Member sets `status = 'APPROVED'` via direct REST | Direct PostgREST | **PREVENTED** | Database trigger `trg_enforce_task_approval` |
| Coordinator updates other department task via direct REST | Direct PostgREST | **PREVENTED** | Database RLS policy `tasks_update` |
| Member modifies `priority` or `deadline` via direct REST | Direct PostgREST | **CONFIRMED EXPOSURE** | Requires Phase 2.4 Database Trigger Remediation |
| Member sets `status = 'DONE'` or `'CANCELLED'` via direct REST | Direct PostgREST | **CONFIRMED EXPOSURE** | Requires Phase 2.4 Database Trigger Remediation |
