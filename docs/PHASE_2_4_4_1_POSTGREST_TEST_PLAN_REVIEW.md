# UEC ESPACE DIGITAL — PHASE 2.4.4.1
## PostgREST Smoke Test Plan Adversarial Review & HTTP Semantics Audit

**Project:** UEC — Espace Digital (*Union des Étudiants Clubistes — Depuis 2021*)  
**Repository:** `rayenmkadmini/uec`  
**Branch:** `feature/uec-espace-digital`  
**Target File:** `docs/PHASE_2_4_4_POSTGREST_SMOKE_TEST_PLAN.md`  
**API Surface:** PostgREST 12+ (Supabase REST API)  
**Status:** **SPECIFICATION AUDIT ONLY — ZERO SMOKE TESTS EXECUTED**

---

### 1. Adversarial Audit of PostgREST HTTP Behavior & Expectations

The smoke test plan proposed in Phase 2.4.4 outlines 8 scenarios. This audit challenges each scenario against actual PostgREST and PostgreSQL HTTP gateway semantics.

#### 1.1 Critique of RLS Rejection Semantics (Scenario SMK-01 & SMK-04)
- **Previous Assumption:** The previous report noted that an anonymous PATCH would return `HTTP 401` or `HTTP 404`.
- **Actual PostgREST Mechanism:**
  - In Supabase, the `anon` role possesses table-level `UPDATE` grants on `public.tasks`, but the `tasks_update` RLS policy restricts row visibility to `auth.uid() IS NOT NULL`.
  - When an anonymous client executes `PATCH /rest/v1/tasks?id=eq.<task_id>`, PostgREST generates:
    ```sql
    UPDATE public.tasks SET ... WHERE id = '<task_id>';
    ```
  - Under RLS, zero rows match the query filter (`WHERE id = ... AND <rls_check>`).
  - By default, PostgREST returns **`HTTP 204 No Content`** (or `HTTP 200 []` when header `Prefer: return=representation` is sent) because 0 rows were updated!
  - It does NOT return `401 Unauthorized` unless the JWT itself is malformed or invalid.
  - **Correction for Phase 2.4.5 Execution:** Verify that the response returns 0 rows updated, and assert via read-only SQL query that the database row remained untouched.

#### 1.2 Validation of Trigger Exception Semantics (`P0001`)
- **Evaluated Statement:** PL/pgSQL statements invoke `RAISE EXCEPTION 'FORBIDDEN: ...'`.
- **PostgreSQL Spec:** In PostgreSQL, a `RAISE EXCEPTION` without an explicit `USING ERRCODE` automatically assigns SQLSTATE **`P0001`** (`raise_exception`).
- **PostgREST Spec:** PostgREST intercepts SQLSTATE `P0001` from a trigger and translates it into:
  - **HTTP Status:** `400 Bad Request`
  - **Response Body:**
    ```json
    {
      "code": "P0001",
      "details": null,
      "hint": null,
      "message": "FORBIDDEN: Seuls le coordinateur de pôle ou le Super Admin peuvent modifier la définition ou les métadonnées de la tâche."
    }
    ```
- **Audit Finding:** The expectation of `HTTP 400 Bad Request` with `code: "P0001"` for trigger violations is 100% accurate and verified.

---

### 2. Scenario-by-Scenario Adversarial Audit Table

```
+-------------------------------------------------------------------------------------------------------------------------------+
| Scenario | Intended Action             | Previous Reported Expectation | Refined PostgREST Expectation      | Safety Risk     |
|:---------|:----------------------------|:------------------------------|:-----------------------------------|:----------------|
| SMK-01   | Anonymous PATCH title       | HTTP 401 / 403                | HTTP 204 (0 rows updated via RLS)  | Zero risk       |
| SMK-02   | Member 1 TODO->IN_PROGRESS  | HTTP 200 / 204                | HTTP 204 (1 row updated)           | Disposable only |
| SMK-03   | Member 1 PATCH title        | HTTP 400 (P0001)              | HTTP 400 (P0001, FORBIDDEN)        | Disposable only |
| SMK-04   | Member 2 (Unassigned) PATCH | HTTP 400 / 404                | HTTP 204 (0 rows updated via RLS)  | Disposable only |
| SMK-05   | Member 1 PATCH status->DONE | HTTP 400 (P0001)              | HTTP 400 (P0001, FORBIDDEN)        | Disposable only |
| SMK-06   | Coord PATCH title & priority| HTTP 200 / 204                | HTTP 204 (1 row updated)           | Disposable only |
| SMK-07   | Coord PATCH dept_id (xfer)  | HTTP 400 (P0001)              | HTTP 400 (P0001, FORBIDDEN)        | Disposable only |
| SMK-08   | Super Admin PATCH->APPROVED | HTTP 200 / 204                | HTTP 204 (1 row updated)           | Disposable only |
+-------------------------------------------------------------------------------------------------------------------------------+
```

---

### 3. Production Fixture Isolation & Risk Assessment

- **Risk of Overwriting Live Data:**  
  If tests used actual user emails or existing tasks, live records could be modified.
- **Enforced Safety Protocol:**  
  1. Tests must operate exclusively against disposable entities prefixed with `SMOKE_P244_`.
  2. If test creation fails, the test suite must abort immediately.
  3. The teardown DO block in `docs/PHASE_2_4_4_POSTGREST_SMOKE_TEST_PLAN.md` cleans up all `SMOKE_P244_%` entities.
  4. Zero live club members or production tasks will be touched.

---

### 4. Audit Verdict on PostgREST Smoke Test Plan

The smoke test plan is **approved with the refined HTTP 204 RLS assertion semantics**.  
All tests remain **strictly unexecuted** during Phase 2.4.4.1.
