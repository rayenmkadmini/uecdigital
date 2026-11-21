# UEC ESPACE DIGITAL — TASKS & DELIVERABLES MODULE
## Operational Lifecycle, Submissions & 2-Tier Approval Workflow

**Module:** Tâches & Livrables  
**URL Route:** `/dashboard/tasks`  
**Target Tables:** `public.tasks`, `public.task_assignees`, `public.task_submissions`, `public.task_comments`, `public.approval_history`

---

## 1. Task Lifecycle State Machine

A task in UEC Espace Digital progresses through strict sequential states:

```
[ BACKLOG ]
     │
     ▼
  [ TODO ] ──────────────► [ IN_PROGRESS ]
                                  │
                                  ▼
                         (Submit Deliverable)
                                  │
                                  ▼
                       [ COORDINATOR_REVIEW ]
                                  │
                   ┌──────────────┴──────────────┐
                   │                             │
          (Revision Requested)          (Reviewed & Verified)
                   │                             │
                   ▼                             ▼
         [ REVISION_REQUIRED ]         [ SUPER_ADMIN_APPROVAL ]
                                                 │
                                  ┌──────────────┴──────────────┐
                                  │                             │
                         (Super Admin Rejected)        (Super Admin Approved)
                                  │                             │
                                  ▼                             ▼
                            [ REJECTED ]                   [ APPROVED ]
                                                                │
                                                                ▼
                                                             [ DONE ]
```

---

## 2. 2-Tier Approval Workflow & Authority Rules

The UEC operational workflow is anchored on a two-tier governance structure:

1. **Tier 1: Team Technical Review (`COORDINATOR_REVIEW`)**
   - Performed by the **COORDINATOR** of the task's department (or `SUPER_ADMIN`).
   - Ensures visual quality, format conformance, technical standards, and completeness.
   - Outcomes:
     - `SUBMIT_TO_SUPER_ADMIN`: Promotes submission status to `PENDING_SUPER_ADMIN` and task to `SUPER_ADMIN_APPROVAL`.
     - `REQUEST_REVISION`: Sets submission and task to `REVISION_REQUIRED` with feedback notes.

2. **Tier 2: Final Institutional Approval (`SUPER_ADMIN_APPROVAL`)**
   - **STRICTLY EXCLUSIVE TO `SUPER_ADMIN`** (enforced by PostgreSQL trigger `trg_enforce_submission_approval` and Server Action `assertActionSuperAdmin`).
   - Outcomes:
     - `APPROVED`: Locks the submission (`is_locked = true`), marks approved timestamp and Super Admin ID, sets task to `APPROVED`, and archives decision in `public.approval_history`.
     - `REJECTED`: Declines publication with official notes.

---

## 3. Server Actions & Deliverables Handling

- **`createTaskAction`:** Creates a task, verifies coordinator or admin rights, and bulk-inserts assignees into `task_assignees`.
- **`updateTaskStatusAction`:** Permits members to switch their assigned tasks between `TODO` and `IN_PROGRESS`. Prohibits direct promotion to `APPROVED`.
- **`submitDeliverableAction`:** Auto-increments deliverable version (`version: 1`, `2`, ...), captures file URLs (Drive, Figma, GitHub, etc.), sets status to `PENDING_COORDINATOR`, and appends to `approval_history`.
- **`executeFinalApproval`:** Executed in `app/actions/approvals.ts` by the Super Admin to pronounce final institutional approval.
