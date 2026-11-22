# UEC ESPACE DIGITAL — PHASE 2.4.3 TEST COVERAGE MATRIX
## Mapping Security Requirements to SQL Logic, Runtime Tests & Evidence

**Project:** UEC — Espace Digital (*Union des Étudiants Clubistes — Depuis 2021*)  
**Test Suite:** `scripts/test-phase242-isolated.mjs` (54 Tests)  
**Audit Phase:** Phase 2.4.3  
**Date:** 2026-11-21  
**Status:** **100% TRACEABILITY VERIFIED**

---

## 1. Traceability Matrix

| # | Security Requirement | SQL Implementation Location | Test ID | Test Description | Evidence / Result |
|---|---|---|:---:|---|---|
| 1 | Superuser direct bypass | `Rule 1: session_user IN ('postgres', 'supabase_admin')` | **`ID-01`** | Direct psql / migration session | ✅ SUCCESS (`RETURN NEW`) |
| 2 | Service-role worker bypass | `Rule 2: auth.role() = 'service_role'` | **`ID-02`** | Trusted background API worker | ✅ SUCCESS (`RETURN NEW`) |
| 3 | Anonymous mutation blocked | `Rule 3: v_caller_id IS NULL` | **`ID-03`** | Anonymous REST request | 🚫 REJECTED (`UNAUTHORIZED`) |
| 4 | Client spoofing blocked | PostgREST JWT trust + `auth.role()` | **`ID-04`** | Authenticated spoofing attempt | 🚫 REJECTED (`FORBIDDEN`) |
| 5 | Member status `TODO` → `IN_PROGRESS` | `Rule 8.D: NEW.status IN ('TODO', 'IN_PROGRESS')` | **`MEM-01`** | Member starts execution | ✅ SUCCESS |
| 6 | Member status `IN_PROGRESS` → `TODO` | `Rule 8.D: NEW.status IN ('TODO', 'IN_PROGRESS')` | **`MEM-02`** | Member pauses execution | ✅ SUCCESS |
| 7 | Member `title` immutability | `Rule 8.B: NEW.title IS DISTINCT FROM OLD.title` | **`MEM-03`** | Member attempts altering title | 🚫 REJECTED (`FORBIDDEN`) |
| 8 | Member `description` immutability | `Rule 8.B: NEW.description IS DISTINCT FROM OLD.description` | **`MEM-04`** | Member attempts altering description | 🚫 REJECTED (`FORBIDDEN`) |
| 9 | Member `acceptance_criteria` immutability | `Rule 8.B: NEW.acceptance_criteria IS DISTINCT FROM ...` | **`MEM-05`** | Member attempts altering criteria | 🚫 REJECTED (`FORBIDDEN`) |
| 10 | Member `priority` immutability | `Rule 8.B: NEW.priority IS DISTINCT FROM OLD.priority` | **`MEM-06`** | Member attempts altering priority | 🚫 REJECTED (`FORBIDDEN`) |
| 11 | Member `deadline` immutability | `Rule 8.B: NEW.deadline IS DISTINCT FROM OLD.deadline` | **`MEM-07`** | Member attempts altering deadline | 🚫 REJECTED (`FORBIDDEN`) |
| 12 | Member `department_id` immutability | `Rule 8.B: NEW.department_id IS DISTINCT FROM ...` | **`MEM-08`** | Member attempts altering department | 🚫 REJECTED (`FORBIDDEN`) |
| 13 | Member `project_id` immutability | `Rule 8.B: NEW.project_id IS DISTINCT FROM ...` | **`MEM-09`** | Member attempts altering project | 🚫 REJECTED (`FORBIDDEN`) |
| 14 | Member `created_by` immutability | `Rule 8.B: NEW.created_by IS DISTINCT FROM ...` | **`MEM-10`** | Member attempts altering creator | 🚫 REJECTED (`FORBIDDEN`) |
| 15 | Member `coordinator_id` immutability | `Rule 8.B: NEW.coordinator_id IS DISTINCT FROM ...` | **`MEM-11`** | Member attempts altering coordinator | 🚫 REJECTED (`FORBIDDEN`) |
| 16 | Universal Primary Key `id` immutability | `Rule 4: NEW.id IS DISTINCT FROM OLD.id` | **`MEM-12`** | Member attempts mutating PK `id` | 🚫 REJECTED (`FORBIDDEN`) |
| 17 | Universal Creation Timestamp immutability | `Rule 4: NEW.created_at IS DISTINCT FROM ...` | **`MEM-13`** | Member attempts mutating timestamp | 🚫 REJECTED (`FORBIDDEN`) |
| 18 | Member direct `DONE` blocked | `Rule 8.D: NEW.status NOT IN ('TODO', 'IN_PROGRESS')` | **`MEM-14`** | Member sets `status = 'DONE'` | 🚫 REJECTED (`FORBIDDEN`) |
| 19 | Member direct `APPROVED` blocked | `trg_enforce_task_approval` + Rule 8.D | **`MEM-15`** | Member sets `status = 'APPROVED'` | 🚫 REJECTED (`APPROVAL_VIOLATION`) |
| 20 | Member review transition without deliverable | `Rule 8.D: NOT EXISTS (task_submissions)` | **`MEM-16`** | Member sets `COORDINATOR_REVIEW` | 🚫 REJECTED (`FORBIDDEN`) |
| 21 | Member review transition with deliverable | `Rule 8.D: EXISTS (status = 'PENDING_COORDINATOR')` | **`MEM-17`** | Member deposits deliverable | ✅ SUCCESS |
| 22 | Member direct `BACKLOG` blocked | `Rule 8.D: NEW.status NOT IN (...)` | **`MEM-18`** | Member sets `status = 'BACKLOG'` | 🚫 REJECTED (`FORBIDDEN`) |
| 23 | Member direct `REVISION_REQUIRED` blocked | `Rule 8.D: NEW.status NOT IN (...)` | **`MEM-19`** | Member sets `REVISION_REQUIRED` | 🚫 REJECTED (`FORBIDDEN`) |
| 24 | Member direct `REJECTED` blocked | `Rule 8.D: NEW.status NOT IN (...)` | **`MEM-20`** | Member sets `REJECTED` | 🚫 REJECTED (`FORBIDDEN`) |
| 25 | Member direct `CANCELLED` blocked | `Rule 8.D: NEW.status NOT IN (...)` | **`MEM-21`** | Member sets `CANCELLED` | 🚫 REJECTED (`FORBIDDEN`) |
| 26 | Reusing stale `REVISION_REQUIRED` submission | `Rule 8.D: status = 'PENDING_COORDINATOR'` | **`MEM-22`** | Member reuses old revision sub | 🚫 REJECTED (`FORBIDDEN`) |
| 27 | Reusing stale `APPROVED` submission | `Rule 8.D: status = 'PENDING_COORDINATOR'` | **`MEM-23`** | Member reuses approved sub | 🚫 REJECTED (`FORBIDDEN`) |
| 28 | Unassigned member mutation blocked | `Rule 8.A: NOT EXISTS (task_assignees)` | **`MEM-24`** | Unassigned member mutates task | 🚫 REJECTED (`FORBIDDEN`) |
| 29 | Coordinator planning `title` update | `Rule 7: is_coordinator_of = true` | **`COORD-01`** | Coordinator updates title | ✅ SUCCESS |
| 30 | Coordinator planning `priority` update | `Rule 7: is_coordinator_of = true` | **`COORD-02`** | Coordinator updates priority | ✅ SUCCESS |
| 31 | Coordinator cross-department transfer blocked | `Rule 7.A: NEW.department_id IS DISTINCT FROM ...` | **`COORD-03`** | Coordinator reassigns department | 🚫 REJECTED (`FORBIDDEN`) |
| 32 | Coordinator `created_by` alteration blocked | `Rule 7.B: NEW.created_by IS DISTINCT FROM ...` | **`COORD-04`** | Coordinator alters creator | 🚫 REJECTED (`FORBIDDEN`) |
| 33 | Coordinator setting `APPROVED` blocked | `Rule 7.D + trg_enforce_task_approval` | **`COORD-05`** | Coordinator sets `APPROVED` | 🚫 REJECTED (`APPROVAL_VIOLATION`) |
| 34 | Coordinator mutating task in escrow blocked | `Rule 7.C: OLD.status = 'SUPER_ADMIN_APPROVAL'` | **`COORD-06`** | Coordinator mutates in review | 🚫 REJECTED (`FORBIDDEN`) |
| 35 | Coordinator mutating `APPROVED` task blocked | `Rule 7.C: OLD.status = 'APPROVED'` | **`COORD-07`** | Coordinator mutates approved task | 🚫 REJECTED (`FORBIDDEN`) |
| 36 | Coordinator setting `DONE` blocked | `Rule 7.D: NEW.status IN ('APPROVED', 'DONE')` | **`COORD-08`** | Coordinator sets `DONE` directly | 🚫 REJECTED (`APPROVAL_VIOLATION`) |
| 37 | Coordinator cancelling task in department | `Rule 7: is_coordinator_of = true` | **`COORD-09`** | Coordinator cancels task | ✅ SUCCESS |
| 38 | Coordinator cancelling task in other dept | `Rule 8.A: NOT EXISTS (task_assignees)` | **`COORD-10`** | Coordinator cancels other dept task | 🚫 REJECTED (`FORBIDDEN`) |
| 39 | Super Admin cross-department update | `Rule 6: is_super_admin = true` | **`SA-01`** | Super Admin updates any task | ✅ SUCCESS |
| 40 | Super Admin final approval | `trg_enforce_task_approval` + Rule 6 | **`SA-02`** | Super Admin sets `APPROVED` | ✅ SUCCESS |
| 41 | Super Admin Primary Key immutability | `Rule 4: NEW.id IS DISTINCT FROM OLD.id` | **`SA-03`** | Super Admin alters PK `id` | 🚫 REJECTED (`FORBIDDEN`) |
| 42 | Super Admin Creation Date immutability | `Rule 4: NEW.created_at IS DISTINCT FROM ...` | **`SA-04`** | Super Admin alters `created_at` | 🚫 REJECTED (`FORBIDDEN`) |
| 43 | Lifecycle Step 1: `TODO` → `IN_PROGRESS` | `Rule 8.D` | **`FLOW-01`** | Member starts work | ✅ SUCCESS (`IN_PROGRESS`) |
| 44 | Lifecycle Step 2: Submit Deliverable | `Rule 8.D + task_submissions` | **`FLOW-02`** | Task moves to review | ✅ SUCCESS (`COORDINATOR_REVIEW`) |
| 45 | Lifecycle Step 3: Member review lock | `Rule 8.C: OLD.status = 'COORDINATOR_REVIEW'` | **`FLOW-03`** | Member mutates under review | 🚫 REJECTED (`FORBIDDEN`) |
| 46 | Lifecycle Step 4: Coordinator escalation | `Rule 7: is_coordinator_of = true` | **`FLOW-04`** | Coordinator promotes to admin | ✅ SUCCESS (`SUPER_ADMIN_APPROVAL`) |
| 47 | Lifecycle Step 5: Escrow lock | `Rule 7.C: OLD.status = 'SUPER_ADMIN_APPROVAL'` | **`FLOW-05`** | Coordinator mutates in escrow | 🚫 REJECTED (`FORBIDDEN`) |
| 48 | Lifecycle Step 6: Super Admin approval | `trg_enforce_task_approval` + Rule 6 | **`FLOW-06`** | Super Admin approves | ✅ SUCCESS (`APPROVED`) |
| 49 | Lifecycle Step 7: Approved work lock | `Rule 7.C: OLD.status = 'APPROVED'` | **`FLOW-07`** | Coordinator mutates approved | 🚫 REJECTED (`FORBIDDEN`) |
| 50 | Lifecycle Step 8: Super Admin closure | `Rule 6: is_super_admin = true` | **`FLOW-08`** | Super Admin sets `DONE` | ✅ SUCCESS (`DONE`) |
| 51 | Automated timestamp maintenance | `trg_set_updated_at` (3rd in chain) | **`TRG-01`** | `updated_at` advances on commit | ✅ SUCCESS (`after >= before`) |
| 52 | Rollback drops trigger & function | `DROP TRIGGER ...; DROP FUNCTION ...;` | **`RBK-01`** | Detach trigger and function | ✅ SUCCESS (0 objects found) |
| 53 | Rollback preserves existing triggers | `pg_trigger` catalog check | **`RBK-02`** | Verify pre-existing triggers | ✅ SUCCESS (2 triggers intact) |
| 54 | Reapplication idempotency | `CREATE OR REPLACE ...` | **`RBK-03`** | Reapply patch after rollback | ✅ SUCCESS (1 trigger attached) |

---

## 2. Test Quality Assessment

1. **Negative Testing Coverage:** 34 of the 54 tests are explicit negative tests asserting that unauthorized operations throw specific PostgreSQL exceptions.
2. **Positive Testing Coverage:** 20 tests verify that authorized workflows succeed without false-positive blocks.
3. **Absence of Silent Catches:** None of the test blocks catch exceptions indiscriminately; every negative test verifies that the caught error message explicitly matches the anticipated authorization violation (`FORBIDDEN`, `APPROVAL_VIOLATION`, or `UNAUTHORIZED`).
