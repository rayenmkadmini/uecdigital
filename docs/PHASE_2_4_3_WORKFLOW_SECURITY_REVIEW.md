# UEC ESPACE DIGITAL — PHASE 2.4.3 WORKFLOW SECURITY REVIEW
## End-to-End Application Workflow Analysis, Submission Integrity & State Machine Robustness

**Project:** UEC — Espace Digital (*Union des Étudiants Clubistes — Depuis 2021*)  
**Source Files Analyzed:** `app/actions/tasks.ts`, `app/actions/approvals.ts`, `lib/data/tasks.ts`  
**Database Tables:** `public.tasks`, `public.task_submissions`, `public.task_assignees`, `public.approval_history`  
**Audit Phase:** Phase 2.4.3  
**Date:** 2026-11-21  
**Status:** **INDEPENDENT WORKFLOW SECURITY AUDIT COMPLETE**

---

## 1. End-to-End Workflow Architecture

The UEC Espace Digital task lifecycle operates across three layers:
1. **Frontend UI Components:** Form actions and optimistic state management.
2. **Next.js 15 Server Actions:** Server-side authentication (`requireProfile()`), role assertions, and Zod input validation.
3. **PostgreSQL Database:** Row Level Security (RLS) policies, foreign key constraints, unique version constraints, and `BEFORE UPDATE` trigger governance.

```
       ┌──────────┐
       │   TODO   │ ◄────────────────────────┐
       └────┬─────┘                          │
            │ (updateTaskStatusAction)       │ (updateTaskStatusAction)
            ▼                                │
     ┌─────────────┐                         │
     │ IN_PROGRESS │ ────────────────────────┘
     └──────┬──────┘
            │ (submitDeliverableAction + task_submissions.insert)
            ▼
 ┌──────────────────────┐
 │  COORDINATOR_REVIEW  │ ◄─────── [LOCKED FOR MEMBERS]
 └──────────┬───────────┘
            │ (submitCoordinatorReview)
            ├─────────────────────────────────────────┐
            │ action = 'SUBMIT_TO_SUPER_ADMIN'        │ action = 'REQUEST_REVISION'
            ▼                                         ▼
┌─────────────────────────┐               ┌───────────────────┐
│  SUPER_ADMIN_APPROVAL   │               │ REVISION_REQUIRED │
└───────────┬─────────────┘               └─────────┬─────────┘
            │ (superAdminReviewAction)              │ (Member resubmits)
            ▼                                       ▼
     ┌──────────────┐                       ┌───────────────┐
     │   APPROVED   │                       │  IN_PROGRESS  │
     └──────┬───────┘                       └───────────────┘
            │ (Task completed)
            ▼
     ┌──────────────┐
     │     DONE     │
     └──────────────┘
```

---

## 2. In-Depth Threat Analysis on Submission Edge Cases

### 2.1 Stale Pending Submissions
- **Threat:** Can an old, already-reviewed submission be used by a member to transition a task to `COORDINATOR_REVIEW` without uploading new work?
- **Analysis:**
  - When a Coordinator reviews a submission, its status in `task_submissions` transitions to `PENDING_SUPER_ADMIN` or `REVISION_REQUIRED`.
  - When the Super Admin approves, it transitions to `APPROVED` (and `is_locked = true`).
  - In our trigger, Rule 8.D checks:
    ```sql
    EXISTS (SELECT 1 FROM public.task_submissions WHERE task_id = OLD.id AND status = 'PENDING_COORDINATOR')
    ```
  - None of the reviewed or approved submissions have `status = 'PENDING_COORDINATOR'`.
  - **Verdict:** **IMMUNE.** Stale submissions cannot unlock review status. Runtime tests `MEM-22` and `MEM-23` actively verified this.

### 2.2 Multiple Pending Submissions & Race Conditions
- **Threat:** Can a member create multiple conflicting submissions simultaneously?
- **Analysis:**
  - In `app/actions/tasks.ts`, `submitDeliverableAction` computes `nextVersion = prevVersion + 1`.
  - In PostgreSQL, `public.task_submissions` enforces:
    ```sql
    CONSTRAINT uq_task_submission_version UNIQUE (task_id, version)
    ```
  - If two concurrent requests attempt to insert the same version number, one commits while the second is aborted with a unique violation error (`23505`).
  - **Verdict:** **IMMUNE.** Version collisions are caught and rolled back by PostgreSQL.

### 2.3 Submission Ownership & Task Assignment
- **Threat:** Can an attacker deposit deliverables on tasks they are not assigned to?
- **Analysis:**
  - **Application Layer:** `submitDeliverableAction` verifies that `task_assignees` contains the caller's ID and throws `AuthorizationError` if not found.
  - **Database Layer (RLS):** `submissions_insert` policy requires:
    ```sql
    WITH CHECK: (submitted_by = auth.uid() AND EXISTS (
      SELECT 1 FROM task_assignees ta WHERE ta.task_id = task_submissions.task_id AND ta.user_id = auth.uid()
    ))
    ```
  - **Database Layer (Trigger):** Rule 8.A verifies `task_assignees` in `private.enforce_task_member_immutability()`.
  - **Verdict:** **TRIPLE DEFENSE-IN-DEPTH.** Unassigned members cannot submit or alter status.

### 2.4 Non-Atomic Submission & Task Status Updates
- **Threat:** In `submitDeliverableAction`:
  - Step 1: `task_submissions.insert(...)`
  - Step 2: `tasks.update({ status: "COORDINATOR_REVIEW" })`
  - Step 3: `approval_history.insert(...)`
- **Analysis:**
  - These run as 3 separate HTTP requests.
  - If Step 1 succeeds and Step 2 fails (e.g. network timeout), the submission exists with `PENDING_COORDINATOR`, but `tasks.status` is still `IN_PROGRESS`.
  - When the user retries, the next execution calculates `version = 2` and succeeds.
  - While this creates an orphaned draft deliverable, **it does not cause any privilege escalation or security compromise**.
  - **Future Optimization:** Wrap the sequence into an atomic database RPC (`public.submit_task_deliverable`) in Phase 2.7.

---

## 3. Workflow Security Audit Summary

| Workflow Step | Actor | Invariants Enforced | Defense Layers | Status |
|---|---|---|:---:|:---:|
| **Task Creation** | Coordinator / Super Admin | Department required, initial `status = 'TODO'` | Server Action + `tasks_insert` RLS | ✅ SECURE |
| **Progress Toggle** | Assigned Member | Only `TODO` ↔ `IN_PROGRESS` | Server Action + Trigger Rule 8.D | ✅ SECURE |
| **Deliverable Deposit** | Assigned Member | Requires file URLs, assigned member only | Server Action + RLS + Trigger Rule 8.D | ✅ SECURE |
| **Coordinator Review** | Coordinator (Own Dept) | Cannot alter task scope; notes required | Server Action + Trigger Rule 7.C | ✅ SECURE |
| **Super Admin Approval** | Super Admin | Exclusive authority to set `APPROVED` / `DONE` | Server Action + `trg_enforce_task_approval` + Rule 7.D | ✅ SECURE |
| **Post-Approval Lock** | All Roles | Approved deliverables and tasks cannot be mutated | Trigger Rule 7.C, 8.C + `trg_enforce_submission_approval` | ✅ SECURE |
