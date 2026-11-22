# UEC ESPACE DIGITAL — PHASE 2.4.1 ROLE-COLUMN PERMISSION MATRIX
## Comprehensive Field-Level Immutability & Lifecycle Access Control for `public.tasks`

**Project:** UEC — Espace Digital (*Union des Étudiants Clubistes*)  
**Database:** PostgreSQL 17.12 (`aigsdarfiplwmzqtqlxh`)  
**Table:** `public.tasks` (14 Columns)  
**Date:** 2026-11-21  
**Status:** **AUTHORITATIVE DATABASE SPECIFICATION**

---

## 1. Complete Catalog of Columns on `public.tasks`

The `public.tasks` table consists of exactly 14 columns:

| # | Column Name | PostgreSQL Data Type | Nullable | Default Value | Business Purpose |
|---|---|---|:---:|---|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` | Immutable primary key |
| 2 | `project_id` | `uuid` | YES | `NULL` | Parent project reference |
| 3 | `department_id` | `uuid` | NO | *None* | Mandatory departmental boundary |
| 4 | `title` | `text` | NO | *None* | Task title and operational objective |
| 5 | `description` | `text` | YES | `NULL` | Detailed task instructions & context |
| 6 | `acceptance_criteria` | `text` | YES | `NULL` | Criteria required for technical validation |
| 7 | `priority` | `text` | NO | `'MEDIUM'` | Urgency (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) |
| 8 | `status` | `text` | NO | `'TODO'` | Workflow state machine indicator |
| 9 | `start_date` | `date` | YES | `NULL` | Scheduled work commencement date |
| 10 | `deadline` | `timestamptz` | YES | `NULL` | Technical completion target deadline |
| 11 | `created_by` | `uuid` | YES | `NULL` | Author/creator user profile ID |
| 12 | `coordinator_id` | `uuid` | YES | `NULL` | Department coordinator overseeing task |
| 13 | `created_at` | `timestamptz` | NO | `now()` | System audit creation timestamp |
| 14 | `updated_at` | `timestamptz` | NO | `now()` | System audit modification timestamp |

---

## 2. Role-Based Column Mutation Authority Matrix

This matrix specifies which roles are permitted to mutate each column under normal workflow conditions (prior to lifecycle locks):

| Column Name | Assigned `MEMBER` | Department `COORDINATOR` | `SUPER_ADMIN` | `service_role` / System | Enforcement Mechanism |
|---|:---:|:---:|:---:|:---:|---|
| `id` | 🚫 **IMMUTABLE** | 🚫 **IMMUTABLE** | 🚫 **IMMUTABLE** | 🚫 **IMMUTABLE** | Database Trigger |
| `project_id` | 🚫 **IMMUTABLE** | ✅ **MUTABLE** (Active phases) | ✅ **MUTABLE** | ✅ **MUTABLE** | Database Trigger |
| `department_id` | 🚫 **IMMUTABLE** | 🚫 **IMMUTABLE** (Boundary) | ✅ **MUTABLE** (Transfer) | ✅ **MUTABLE** | Database Trigger |
| `title` | 🚫 **IMMUTABLE** | ✅ **MUTABLE** (Active phases) | ✅ **MUTABLE** | ✅ **MUTABLE** | Database Trigger |
| `description` | 🚫 **IMMUTABLE** | ✅ **MUTABLE** (Active phases) | ✅ **MUTABLE** | ✅ **MUTABLE** | Database Trigger |
| `acceptance_criteria` | 🚫 **IMMUTABLE** | ✅ **MUTABLE** (Active phases) | ✅ **MUTABLE** | ✅ **MUTABLE** | Database Trigger |
| `priority` | 🚫 **IMMUTABLE** | ✅ **MUTABLE** (Active phases) | ✅ **MUTABLE** | ✅ **MUTABLE** | Database Trigger |
| `status` | ⚠️ **CONTROLLED** (`TODO` ↔ `IN_PROGRESS` or submit) | ⚠️ **CONTROLLED** (No direct `APPROVED`/`DONE`) | ✅ **FULL AUTHORITY** (Sole `APPROVED`) | ✅ **FULL AUTHORITY** | Trigger + State Machine |
| `start_date` | 🚫 **IMMUTABLE** | ✅ **MUTABLE** (Active phases) | ✅ **MUTABLE** | ✅ **MUTABLE** | Database Trigger |
| `deadline` | 🚫 **IMMUTABLE** | ✅ **MUTABLE** (Active phases) | ✅ **MUTABLE** | ✅ **MUTABLE** | Database Trigger |
| `created_by` | 🚫 **IMMUTABLE** | 🚫 **IMMUTABLE** (Audit trail) | 🚫 **IMMUTABLE** (Audit trail) | ✅ **MUTABLE** | Database Trigger |
| `coordinator_id` | 🚫 **IMMUTABLE** | ✅ **MUTABLE** (Delegate in dept) | ✅ **MUTABLE** | ✅ **MUTABLE** | Database Trigger |
| `created_at` | 🚫 **IMMUTABLE** | 🚫 **IMMUTABLE** | 🚫 **IMMUTABLE** | 🚫 **IMMUTABLE** | Database Trigger |
| `updated_at` | 🤖 **SYSTEM SET** | 🤖 **SYSTEM SET** | 🤖 **SYSTEM SET** | 🤖 **SYSTEM SET** | `trg_set_updated_at` |

---

## 3. Lifecycle Status-Dependent Mutability Matrix

The state machine governing `public.tasks` consists of 11 distinct statuses:
`BACKLOG`, `TODO`, `IN_PROGRESS`, `SUBMITTED`, `COORDINATOR_REVIEW`, `SUPER_ADMIN_APPROVAL`, `APPROVED`, `REVISION_REQUIRED`, `REJECTED`, `DONE`, `CANCELLED`.

The permissible mutations for each lifecycle stage are defined below:

### 3.1 Initial & Execution Stages (`TODO`, `IN_PROGRESS`, `REVISION_REQUIRED`, `BACKLOG`)
- **Assigned `MEMBER`:**
  - Can switch `status` between `'TODO'` and `'IN_PROGRESS'`.
  - When submitting a deliverable via `submitDeliverableAction`, can transition `status` to `'COORDINATOR_REVIEW'` (validated by trigger checking for active submission).
  - All other 12 columns are strictly locked.
- **Department `COORDINATOR`:**
  - Full operational control over scope and planning: `title`, `description`, `acceptance_criteria`, `priority`, `start_date`, `deadline`, `coordinator_id`, `project_id`.
  - Can update `status` to `REVISION_REQUIRED` or `SUPER_ADMIN_APPROVAL` via approval reviews.
  - Cannot alter `department_id`, `created_by`, `id`, `created_at`.
- **`SUPER_ADMIN`:**
  - Full authority.

### 3.2 Review Stages (`COORDINATOR_REVIEW`, `SUPER_ADMIN_APPROVAL`)
- **Assigned `MEMBER`:**
  - 🚫 **TOTAL LOCKOUT.** Any update attempt by a member raises `FORBIDDEN: Impossible de modifier une tâche en cours de revue.`
- **Department `COORDINATOR`:**
  - If in `COORDINATOR_REVIEW`: Can submit review via `submitCoordinatorReview`, moving task to `SUPER_ADMIN_APPROVAL` or `REVISION_REQUIRED`. Scope modifications are prohibited during active review.
  - If in `SUPER_ADMIN_APPROVAL`: 🚫 **LOCKED.** Task is in escrow with the Super Admin. Coordinator cannot mutate fields or regress status.
- **`SUPER_ADMIN`:**
  - Full authority. Can grant final approval (`status = 'APPROVED'`) or request revision.

### 3.3 Finalized & Terminal Stages (`APPROVED`, `DONE`, `CANCELLED`)
- **Assigned `MEMBER`:**
  - 🚫 **TOTAL LOCKOUT.**
- **Department `COORDINATOR`:**
  - 🚫 **LOCKED.** Once approved or closed, a coordinator cannot modify `title`, `description`, `acceptance_criteria`, `priority`, `deadline`, `project_id`, or `status`. Any change requires Super Admin intervention.
- **`SUPER_ADMIN`:**
  - Retains administrative correction privileges, but `id` and `created_at` remain immutable. Re-opening a finalized task requires explicit action.

---

## 4. Status Transition Matrix by Role

| Current Status (`OLD.status`) | Target Status (`NEW.status`) | Assigned `MEMBER` | Department `COORDINATOR` | `SUPER_ADMIN` |
|---|---|:---:|:---:|:---:|
| `TODO` | `IN_PROGRESS` | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW |
| `IN_PROGRESS` | `TODO` | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW |
| `TODO` / `IN_PROGRESS` | `COORDINATOR_REVIEW` | ⚠️ ALLOW (With submission) | ✅ ALLOW | ✅ ALLOW |
| `COORDINATOR_REVIEW` | `REVISION_REQUIRED` | 🚫 FORBIDDEN | ✅ ALLOW | ✅ ALLOW |
| `COORDINATOR_REVIEW` | `SUPER_ADMIN_APPROVAL` | 🚫 FORBIDDEN | ✅ ALLOW | ✅ ALLOW |
| `SUPER_ADMIN_APPROVAL` | `APPROVED` | 🚫 FORBIDDEN | 🚫 FORBIDDEN | ✅ ALLOW |
| `SUPER_ADMIN_APPROVAL` | `REVISION_REQUIRED` | 🚫 FORBIDDEN | 🚫 FORBIDDEN | ✅ ALLOW |
| `APPROVED` | `DONE` | 🚫 FORBIDDEN | 🚫 FORBIDDEN | ✅ ALLOW |
| Any Status | `APPROVED` | 🚫 FORBIDDEN | 🚫 FORBIDDEN | ✅ ALLOW (Sole Authority) |
| `APPROVED` / `DONE` | `TODO` / `IN_PROGRESS` | 🚫 FORBIDDEN | 🚫 FORBIDDEN | ✅ ALLOW (Admin Override) |
| Any Status | `CANCELLED` | 🚫 FORBIDDEN | ✅ ALLOW (Own Dept) | ✅ ALLOW |

---

## 5. Summary of Enforced Guarantees

1. **Least Privilege for Members:** Members can NEVER alter task requirements, deadlines, priorities, or departmental assignments. Direct REST calls targeting these fields fail at the database level with a PostgreSQL exception.
2. **Departmental Boundary Integrity:** Coordinators can NEVER reassign a task to another department (`NEW.department_id IS DISTINCT FROM OLD.department_id` is rejected).
3. **Approval Integrity:** No user other than `SUPER_ADMIN` can ever transition a task to `APPROVED` or mark an unreviewed task `DONE`.
4. **Deliverable Workflow Preservation:** Valid deliverable submissions advancing to `COORDINATOR_REVIEW` succeed without interruption.
