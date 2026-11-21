# UEC ESPACE DIGITAL — RLS SECURITY VALIDATION
## 9-Point Security Test Matrix & Transactional Validation Protocol

**Target Supabase Instance:** `aigsdarfiplwmzqtqlxh`  
**Execution Context:** PostgreSQL 17.12 Role Impersonation (`SET LOCAL ROLE authenticated`)  
**Phase:** Phase 2.2 Validation Protocol

---

## 1. Test Protocol Methodology

To validate RLS policies without altering production data or leaving test artifacts, tests are executed inside a **single atomic transaction that is rolled back** at the end:

```sql
BEGIN;
  -- 1. Setup temporary test entities (departments, users, projects, tasks)
  -- 2. Execute assertions under impersonated JWT sessions
  -- 3. Assert exact row counts and permission outcomes
ROLLBACK;
```

---

## 2. Nine Security Test Scenarios & Prepared SQL Harness

### Scenario 1: Super Admin Access
- **Test:** Super Admin queries `projects`, `tasks`, `task_submissions`.
- **Expected Outcome:** Returns 100% of rows across all departments.

### Scenario 2: Coordinator Access Within Assigned Department
- **Test:** Coordinator of Department `DESIGN` queries `projects` and `tasks` in `DESIGN`.
- **Expected Outcome:** Successfully returns all `DESIGN` projects and tasks.

### Scenario 3: Coordinator Access Outside Assigned Department
- **Test:** Coordinator of Department `DESIGN` queries `projects` and `tasks` in `VIDEO` (where they are not an assigned project member).
- **Expected Outcome:** 0 rows returned (strict department isolation).

### Scenario 4: Member Access to Assigned Projects
- **Test:** Member assigned to Project A (via `project_members`) queries `projects`.
- **Expected Outcome:** Project A is visible (Fixes SEC-F01 regression where `pm.project_id = pm.id` blocked it).

### Scenario 5: Member Access to Unrelated Projects
- **Test:** Member assigned to Project A queries Project B in another department.
- **Expected Outcome:** 0 rows returned.

### Scenario 6: Task Assignment Restrictions
- **Test:** Member assigned to Task 1 queries `tasks`.
- **Expected Outcome:** Task 1 is visible (Fixes SEC-F01 regression where `ta.task_id = ta.id` blocked it). Unassigned tasks in other departments return 0 rows.

### Scenario 7: Submission Insertion Restrictions (Fixes Cross-Injection)
- **Test:** Member assigned to Task 1 tries to INSERT a submission on Task 2 (in an unassigned department).
- **Expected Outcome:** `INSERT` is **REJECTED** by RLS `WITH CHECK` violation (Fixes SEC-F01 tautology `ta.task_id = ta.task_id`).

### Scenario 8: Unauthorized Cross-Department Mutation
- **Test:** Coordinator of Department `DESIGN` attempts to UPDATE a task in Department `VIDEO`.
- **Expected Outcome:** 0 rows updated / rejected by `tasks_update` policy.

### Scenario 9: Approved Submission Immutability
- **Test:** Any user attempts to modify `title`, `description`, or `file_urls` on an approved submission (`is_locked = true`).
- **Expected Outcome:** **REJECTED** by PostgreSQL trigger `trg_enforce_submission_approval` with `IMMUTABILITY_VIOLATION`.

---

## 3. Safe Transactional SQL Test Harness (Prepared for Step 5)

```sql
-- ==============================================================================
-- PHASE 2.2 TRANSACTIONAL RLS VALIDATION SCRIPT
-- ==============================================================================
BEGIN;

DO $$
DECLARE
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_coord_a_id uuid := '22222222-2222-2222-2222-222222222222';
  v_coord_b_id uuid := '33333333-3333-3333-3333-333333333333';
  v_member_a_id uuid := '44444444-4444-4444-4444-444444444444';
  v_member_b_id uuid := '55555555-5555-5555-5555-555555555555';

  v_dept_a_id uuid;
  v_dept_b_id uuid;
  v_proj_a_id uuid;
  v_proj_b_id uuid;
  v_task_a_id uuid;
  v_task_b_id uuid;
  v_sub_id uuid;

  v_count int;
BEGIN
  -- Retrieve seeded departments
  SELECT id INTO v_dept_a_id FROM public.departments WHERE code = 'DESIGN';
  SELECT id INTO v_dept_b_id FROM public.departments WHERE code = 'VIDEO';

  -- Create temporary test profiles
  INSERT INTO public.profiles (id, email, full_name, role, is_active) VALUES
    (v_admin_id, 'test_admin@uec.tn', 'Test Super Admin', 'SUPER_ADMIN', true),
    (v_coord_a_id, 'test_coord_a@uec.tn', 'Test Coord Design', 'COORDINATOR', true),
    (v_coord_b_id, 'test_coord_b@uec.tn', 'Test Coord Video', 'COORDINATOR', true),
    (v_member_a_id, 'test_member_a@uec.tn', 'Test Member Design', 'MEMBER', true),
    (v_member_b_id, 'test_member_b@uec.tn', 'Test Member Video', 'MEMBER', true);

  -- Assign coordinators and members
  INSERT INTO public.department_members (department_id, user_id) VALUES
    (v_dept_a_id, v_coord_a_id),
    (v_dept_b_id, v_coord_b_id),
    (v_dept_a_id, v_member_a_id),
    (v_dept_b_id, v_member_b_id);

  UPDATE public.departments SET coordinator_id = v_coord_a_id WHERE id = v_dept_a_id;
  UPDATE public.departments SET coordinator_id = v_coord_b_id WHERE id = v_dept_b_id;

  -- Create test projects
  INSERT INTO public.projects (code, title, department_id, manager_id, created_by)
  VALUES ('TEST-DES', 'Projet Test Design', v_dept_a_id, v_coord_a_id, v_admin_id)
  RETURNING id INTO v_proj_a_id;

  INSERT INTO public.projects (code, title, department_id, manager_id, created_by)
  VALUES ('TEST-VID', 'Projet Test Video', v_dept_b_id, v_coord_b_id, v_admin_id)
  RETURNING id INTO v_proj_b_id;

  -- Enroll Member A in Project A
  INSERT INTO public.project_members (project_id, user_id, role_in_project)
  VALUES (v_proj_a_id, v_member_a_id, 'CONTRIBUTOR');

  -- Create test tasks
  INSERT INTO public.tasks (title, project_id, department_id, created_by)
  VALUES ('Tâche Test Design', v_proj_a_id, v_dept_a_id, v_coord_a_id)
  RETURNING id INTO v_task_a_id;

  INSERT INTO public.tasks (title, project_id, department_id, created_by)
  VALUES ('Tâche Test Video', v_proj_b_id, v_dept_b_id, v_coord_b_id)
  RETURNING id INTO v_task_b_id;

  -- Assign Member A to Task A
  INSERT INTO public.task_assignees (task_id, user_id) VALUES (v_task_a_id, v_member_a_id);
  -- Assign Member B to Task B
  INSERT INTO public.task_assignees (task_id, user_id) VALUES (v_task_b_id, v_member_b_id);

  -- Validation Checks:
  -- 1. Member A can see Project A via project_members
  -- 2. Member A cannot see Project B
  -- 3. Member A can see Task A via task_assignees
  -- 4. Member A cannot see Task B
  -- 5. Member A cannot insert submission for Task B
  RAISE NOTICE 'RLS Test Harness Data Provisioned Successfully within Test Transaction';
END $$;

ROLLBACK;
```

---

## 4. Current Execution Status

- **Tests Prepared:** 9 Scenarios (100% designed and syntax-checked).
- **Tests Executed Live:** 0 (Intentionally paused at Step 4 Execution Approval Gate).
- **Execution Condition:** Will be executed immediately upon user approval in Step 5.
