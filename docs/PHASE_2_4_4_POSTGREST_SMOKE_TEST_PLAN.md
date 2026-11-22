# UEC ESPACE DIGITAL — PHASE 2.4.4
## PostgREST Gateway Smoke Test Plan & Boundary Validation Specification

**Project:** UEC — Espace Digital (*Union des Étudiants Clubistes — Depuis 2021*)  
**Repository:** `rayenmkadmini/uec`  
**Branch:** `feature/uec-espace-digital`  
**Target Supabase Project:** `aigsdarfiplwmzqtqlxh`  
**API Gateway:** PostgREST 12+ (Supabase REST API)  
**Status:** **SPECIFICATION ONLY — ZERO MUTATIONS EXECUTED**

---

### 1. Scope & Gateway Boundary Context

The automated tests in Phase 2.4.2 validated the proposed trigger inside `@electric-sql/pglite` (a local Wasm-compiled PostgreSQL engine). While PGlite validated PL/pgSQL logic, it does not evaluate the network layer or the Haskell PostgREST gateway.

In Supabase production:
1. Inbound client HTTP requests hit the PostgREST gateway.
2. PostgREST validates the JWT using `PGRST_JWT_SECRET`.
3. PostgREST connects to PostgreSQL as `authenticator` and executes:
   ```sql
   SET LOCAL ROLE authenticated;
   SET LOCAL "request.jwt.claim.sub" = '<uid>';
   SET LOCAL "request.jwt.claim.role" = 'authenticated';
   ```
4. PostgREST executes the requested SQL query (e.g. `UPDATE public.tasks ...`).
5. PostgreSQL triggers execute within this transactional context.

To bridge this verification gap safely, this document defines a **readiness verification test plan** to be executed **only after** production deployment authorization is granted.

> [!IMPORTANT]
> **Zero Production Mutations During Phase 2.4.4:**  
> In strict compliance with Phase 2.4.4 instructions, no test records have been created or modified in production. The test matrix below defines the exact requests, headers, expected status codes, database state checks, and cleanup procedures for post-deployment execution.

---

### 2. Disposable Test Fixture Specification

Smoke testing must never touch live club members, active projects, or production tasks. Instead, all post-deployment tests will operate strictly against dedicated disposable fixtures tagged with a distinct prefix `SMOKE_P244_`.

#### Dedicated Test Entities:
- **Disposable Department:** `SMOKE_P244_DEP` (Code: `SMK4`)
- **Disposable Super Admin:** `smoke.admin@uec-test.tn`
- **Disposable Coordinator:** `smoke.coord@uec-test.tn`
- **Disposable Member 1 (Assigned):** `smoke.dev1@uec-test.tn`
- **Disposable Member 2 (Unassigned):** `smoke.dev2@uec-test.tn`
- **Disposable Task 1:** `SMOKE_P244_TASK_1` (Belongs to `SMOKE_P244_DEP`, assigned to Dev 1)

---

### 3. Post-Deployment Smoke Test Scenarios

The smoke test suite consists of 8 targeted tests covering all security roles and critical boundaries:

```
+---------------------------------------------------------------------------------------------------+
| ID       | Role              | Target Action                  | Expected PostgREST | Expected DB  |
|----------|-------------------|--------------------------------|--------------------|--------------|
| SMK-01   | Anonymous         | PATCH task title               | HTTP 401 / 403     | No Change    |
| SMK-02   | Member 1 (Assign) | PATCH status TODO->IN_PROGRESS | HTTP 200 / 204     | Updated      |
| SMK-03   | Member 1 (Assign) | PATCH title / priority         | HTTP 400 (P0001)   | Rollback     |
| SMK-04   | Member 2 (Unasgn) | PATCH status TODO->IN_PROGRESS | HTTP 400 / 404     | No Change    |
| SMK-05   | Member 1 (Assign) | PATCH status -> DONE           | HTTP 400 (P0001)   | Rollback     |
| SMK-06   | Coordinator       | PATCH title & priority         | HTTP 200 / 204     | Updated      |
| SMK-07   | Coordinator       | PATCH department_id (transfer) | HTTP 400 (P0001)   | Rollback     |
| SMK-08   | Super Admin       | PATCH status -> APPROVED       | HTTP 200 / 204     | Updated      |
+---------------------------------------------------------------------------------------------------+
```

#### Detailed Test Specifications:

##### Scenario SMK-01: Anonymous Access Attempt
- **Method:** `PATCH /rest/v1/tasks?id=eq.<task1_id>`
- **Headers:** `apikey: <anon_key>` (No Bearer token)
- **Body:** `{"title": "Hacked Title"}`
- **Expected Status:** `401 Unauthorized` or `404 Not Found` (RLS blocks row visibility).
- **Verification Query:** `SELECT title FROM public.tasks WHERE id = '<task1_id>'` (Must match initial title).

##### Scenario SMK-02: Assigned Member Permitted State Transition
- **Method:** `PATCH /rest/v1/tasks?id=eq.<task1_id>`
- **Headers:** `apikey: <anon_key>`, `Authorization: Bearer <member1_jwt>`
- **Body:** `{"status": "IN_PROGRESS"}`
- **Expected Status:** `200 OK` or `204 No Content`.
- **Verification Query:** `SELECT status, updated_at FROM public.tasks WHERE id = '<task1_id>'` (status = `'IN_PROGRESS'`, `updated_at` updated by `trg_set_updated_at`).

##### Scenario SMK-03: Assigned Member Structural Mutation Attack (SEC-V01 Remediation)
- **Method:** `PATCH /rest/v1/tasks?id=eq.<task1_id>`
- **Headers:** `apikey: <anon_key>`, `Authorization: Bearer <member1_jwt>`
- **Body:** `{"title": "Compromised Title", "priority": "CRITICAL"}`
- **Expected Status:** `400 Bad Request` (PostgreSQL error code `P0001` - `raise_exception`).
- **Expected Error Message:** `FORBIDDEN: Seuls le coordinateur de pôle ou le Super Admin peuvent modifier la définition ou les métadonnées de la tâche.`
- **Verification Query:** Confirm `title` and `priority` remain completely unchanged.

##### Scenario SMK-04: Unassigned Member Direct Mutation Attack
- **Method:** `PATCH /rest/v1/tasks?id=eq.<task1_id>`
- **Headers:** `apikey: <anon_key>`, `Authorization: Bearer <member2_jwt>`
- **Body:** `{"status": "IN_PROGRESS"}`
- **Expected Status:** `400 Bad Request` (or `404 Not Found` via RLS).
- **Expected Error Message:** `FORBIDDEN: Vous n'êtes pas assigné à cette tâche.`

##### Scenario SMK-05: Assigned Member Approval Bypass Attack
- **Method:** `PATCH /rest/v1/tasks?id=eq.<task1_id>`
- **Headers:** `apikey: <anon_key>`, `Authorization: Bearer <member1_jwt>`
- **Body:** `{"status": "DONE"}`
- **Expected Status:** `400 Bad Request` (`P0001`).
- **Expected Error Message:** `FORBIDDEN: Les membres ne peuvent pas positionner ce statut (statut demandé: DONE). Les livrables doivent être soumis via le workflow de dépôt.`

##### Scenario SMK-06: Department Coordinator Legitimate Update
- **Method:** `PATCH /rest/v1/tasks?id=eq.<task1_id>`
- **Headers:** `apikey: <anon_key>`, `Authorization: Bearer <coord_jwt>`
- **Body:** `{"title": "Updated by Coordinator", "priority": "HIGH"}`
- **Expected Status:** `200 OK` or `204 No Content`.
- **Verification Query:** Verify that title is updated to `"Updated by Coordinator"`.

##### Scenario SMK-07: Department Coordinator Cross-Department Transfer Attack
- **Method:** `PATCH /rest/v1/tasks?id=eq.<task1_id>`
- **Headers:** `apikey: <anon_key>`, `Authorization: Bearer <coord_jwt>`
- **Body:** `{"department_id": "<other_dept_id>"}`
- **Expected Status:** `400 Bad Request` (`P0001`).
- **Expected Error Message:** `FORBIDDEN: Un coordinateur ne peut pas transférer une tâche vers un autre département.`

##### Scenario SMK-08: Super Admin Task Approval
- **Method:** `PATCH /rest/v1/tasks?id=eq.<task1_id>`
- **Headers:** `apikey: <anon_key>`, `Authorization: Bearer <superadmin_jwt>`
- **Body:** `{"status": "APPROVED"}`
- **Expected Status:** `200 OK` or `204 No Content`.
- **Verification Query:** Verify that status is updated to `'APPROVED'`.

---

### 4. Post-Test Teardown & Cleanup Protocol

Immediately upon completing the smoke test sequence, the following cleanup script must be executed via direct service-role/postgres connection:

```sql
DO $$
BEGIN
  -- 1. Delete disposable task submissions
  DELETE FROM public.task_submissions 
  WHERE task_id IN (SELECT id FROM public.tasks WHERE title LIKE 'SMOKE_P244_%');

  -- 2. Delete disposable task assignees
  DELETE FROM public.task_assignees 
  WHERE task_id IN (SELECT id FROM public.tasks WHERE title LIKE 'SMOKE_P244_%');

  -- 3. Delete disposable tasks
  DELETE FROM public.tasks 
  WHERE title LIKE 'SMOKE_P244_%';

  -- 4. Delete disposable departments
  DELETE FROM public.departments 
  WHERE name LIKE 'SMOKE_P244_%';

  -- 5. Delete disposable user profiles
  DELETE FROM public.profiles 
  WHERE email LIKE 'smoke.%@uec-test.tn';

  RAISE NOTICE 'SMOKE_TEARDOWN_COMPLETE: All disposable smoke fixtures purged cleanly.';
END;
$$;
```

---

### 5. Automated Rollback Trigger Criteria

If any of the following events occur during smoke testing, testing must halt immediately and `docs/sql/PHASE_2_4_4_PRODUCTION_ROLLBACK.sql` must be executed:

1. **HTTP 500 Internal Server Error** returned by PostgREST on any endpoint.
2. Legitimate member `TODO -> IN_PROGRESS` transition fails (SMK-02).
3. Legitimate coordinator task editing fails (SMK-06).
4. Unexpected schema locking or concurrency deadlocks on `public.tasks`.
5. Post-deployment catalog check shows missing pre-existing triggers.
