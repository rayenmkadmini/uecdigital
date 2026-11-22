# UEC ESPACE DIGITAL — PHASE 2.3 RBAC ACCESS CONTROL MATRIX
## Role-Based Access Control, Department Scoping & Permission Architecture

**Project:** UEC — Espace Digital  
**Target Project:** `aigsdarfiplwmzqtqlxh` (PostgreSQL 17.12)  
**Document Ref:** Phase 2.3 RBAC Governance  
**Date:** 2026-11-21  

---

## 1. Role Definitions & Governance Responsibilities

| Role | Hierarchy Level | Primary Responsibilities | Scope of Authority |
|---|---|---|---|
| **`SUPER_ADMIN`** | Level 1 (Executive) | Overall digital pole governance, member role assignments, final deliverable validation, platform settings, global analytics | **System-wide** (All 6 departments, all users, all projects, all tasks) |
| **`COORDINATOR`** | Level 2 (Departmental) | Departmental task assignment, project supervision, technical intermediate review, compliance filtering | **Assigned Department Strictly** (e.g., `DESIGN`, `VIDEO`, `WEB`, `INNOVATION`, `SOCIAL_MEDIA`, `STRATEGY`) |
| **`MEMBER`** | Level 3 (Operational) | Task execution, status progression (`TODO` ↔ `IN_PROGRESS`), deliverable submission, collaboration | **Assigned Tasks & Projects Only** |
| **`UNAUTHENTICATED`** | Level 0 (Public) | Login, password reset request, static public assets, isolated demo sandbox (`/preview`) | **Public routes only** (Zero database access) |

---

## 2. Complete Role Permission Matrix

| Resource / Action | Unauthenticated | MEMBER | COORDINATOR | SUPER_ADMIN | Enforcement Mechanism |
|---|:---:|:---:|:---:|:---:|---|
| **Access `/login`** | ALLOW | REDIRECT `/dashboard` | REDIRECT `/dashboard` | REDIRECT `/dashboard` | Middleware |
| **Access `/preview`** | ALLOW | ALLOW | ALLOW | ALLOW | Isolated Client Component (Static Mock) |
| **Access `/dashboard`** | DENY (➔ `/login`) | ALLOW (Member View) | ALLOW (Coord View) | ALLOW (Admin View) | Middleware + `requireProfile()` |
| **Access `/dashboard/users`** | DENY | DENY (➔ `/dashboard`) | DENY (➔ `/dashboard`) | ALLOW | `requireSuperAdmin()` in `page.tsx` |
| **Access `/dashboard/approvals`** | DENY | DENY (➔ `/dashboard`) | DENY (➔ `/dashboard`) | ALLOW | `requireSuperAdmin()` in `page.tsx` |
| **Access `/dashboard/departments`** | DENY | ALLOW (Read-only) | ALLOW (Department View) | ALLOW (Full Management) | `requireProfile()` + Client Component RBAC |
| **Access `/dashboard/projects`** | DENY | ALLOW (Assigned Only) | ALLOW (Own Dept) | ALLOW (All Depts) | `projects_select` RLS + `requireProfile()` |
| **Access `/dashboard/tasks`** | DENY | ALLOW (Assigned Only) | ALLOW (Own Dept) | ALLOW (All Depts) | `tasks_select` RLS + `requireProfile()` |
| **Execute Final Approval** | DENY | DENY | DENY | ALLOW | `assertActionSuperAdmin()` + `trg_enforce_submission_approval` |
| **Submit Coordinator Review** | DENY | DENY | ALLOW (Own Dept Only) | ALLOW (All Depts) | `assertActionRole(["COORDINATOR", "SUPER_ADMIN"])` + dept check |
| **Update Member Role** | DENY | DENY | DENY | ALLOW (Self-demotion blocked) | `assertActionSuperAdmin()` + `trg_protect_profile_roles` |
| **Assign Dept Member** | DENY | DENY | ALLOW (Own Dept Only) | ALLOW (All Depts) | `requireProfile()` + dept match |
| **Create Project** | DENY | DENY | ALLOW (Own Dept Only) | ALLOW (All Depts) | `ProjectCreateSchema` + dept match |
| **Update Project** | DENY | DENY (unless `LEAD`) | ALLOW (Own Dept) | ALLOW (All Depts) | `ProjectUpdateSchema` + dept match |
| **Create Task** | DENY | DENY | ALLOW (Own Dept Only) | ALLOW (All Depts) | `TaskCreateSchema` + dept match |
| **Update Task Status** | DENY | ALLOW (`TODO` ↔ `IN_PROGRESS`) | ALLOW (Own Dept) | ALLOW (All Depts) | `updateTaskStatusAction` + `tasks_update` |
| **Submit Deliverable** | DENY | ALLOW (Assigned Task Only) | DENY (unless assigned) | ALLOW | `submissions_insert` RLS + assignee check |
| **Add Task Comment** | DENY | ALLOW (Assigned Task Only) | ALLOW (Own Dept) | ALLOW (All Depts) | `addTaskCommentAction` + `task_comments_insert` |
| **View Meetings** | DENY | ALLOW (Attendee/Dept) | ALLOW (Dept Meetings) | ALLOW (All Meetings) | `meetings_select` RLS |
| **Download Media Files** | DENY | ALLOW (Signed URL) | ALLOW (Signed URL) | ALLOW (Signed URL) | `storage.objects` RLS + private bucket |
| **Delete Media Files** | DENY | DENY (unless Owner) | DENY (unless Owner) | ALLOW | `media_bucket_delete` RLS |

---

## 3. Department Isolation Matrix

The UEC Espace Digital platform hosts 6 distinct departments:
1. `DESIGN` (Design & Branding)
2. `VIDEO` (Photo & Video Production)
3. `WEB` (Web & Development)
4. `INNOVATION` (Innovation & IT)
5. `SOCIAL_MEDIA` (Social Media Management)
6. `STRATEGY` (Digital Strategy & Analytics)

### Cross-Department Isolation Rules:
- **Project Visibility:** A Coordinator of `DESIGN` querying `projects` via direct PostgREST or Server Actions cannot view or mutate projects in `VIDEO` or `WEB` unless explicitly enrolled as a project member.
- **Task Assignment:** A Coordinator of `DESIGN` cannot assign members to tasks belonging to `INNOVATION`.
- **Review Boundary:** A Coordinator of `DESIGN` calling `submitCoordinatorReview` on a deliverable belonging to `VIDEO` is rejected with `AuthorizationError(403)`.
- **Deliverable Submission:** An assigned member of Department A cannot inject a deliverable into a task belonging to Department B.

---

## 4. Multi-Stage Approval Workflow Progression

```
[ BACKLOG / TODO ] 
       │
       ▼ (Member: updateTaskStatusAction)
 [ IN_PROGRESS ]
       │
       ▼ (Member: submitDeliverableAction)
[ COORDINATOR_REVIEW ]  <─── Locked for unilateral member edits
       │
       ├─────────────────────────────────┐
       ▼ (Coordinator: REQUEST_REVISION)   ▼ (Coordinator: SUBMIT_TO_SUPER_ADMIN)
[ REVISION_REQUIRED ]             [ SUPER_ADMIN_APPROVAL ]
       │                                 │
       ▼ (Member re-submits v+1)         ▼ (Super Admin: executeFinalApproval)
[ COORDINATOR_REVIEW ]             [ APPROVED ]  <─── Trigger trg_enforce_submission_approval
                                         │             Locks version permanently (is_locked = true)
                                         ▼
                                      [ DONE ]
```

### Security Invariants in Workflow:
1. **No Self-Approval:** A member cannot approve their own deliverable or advance their submission past `COORDINATOR_REVIEW`.
2. **No Coordinator Impersonation:** Coordinators cannot submit deliverables pretending to be assigned members.
3. **No Direct Admin Promotion:** Coordinators cannot promote tasks or submissions directly to `APPROVED`. Only Super Admin can transition to `APPROVED`.
4. **Permanent Immutability:** Once `status = 'APPROVED'`, the submission is locked (`is_locked = true`). Modifying `title`, `description`, or `file_urls` is aborted by PostgreSQL trigger `trg_enforce_submission_approval`.
