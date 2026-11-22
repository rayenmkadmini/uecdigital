# UEC ESPACE DIGITAL — SECURITY TEST MATRIX
## Comprehensive Authorization & RBAC Test Scenarios

**Project:** UEC — Espace Digital  
**Platform Version:** Phase 2.1 Post-Implementation Hardened  
**Date:** 21 Novembre 2026

---

## 1. Route Access Control Matrix

| Route Path | Unauthenticated | MEMBER | COORDINATOR | SUPER_ADMIN | Enforcing Mechanism |
|---|---|---|---|---|---|
| `/login` | ✅ Allowed | 🔄 Redirect `/dashboard` | 🔄 Redirect `/dashboard` | 🔄 Redirect `/dashboard` | Middleware & Auth Provider |
| `/forgot-password` | ✅ Allowed | 🔄 Redirect `/dashboard` | 🔄 Redirect `/dashboard` | 🔄 Redirect `/dashboard` | Middleware & Auth Provider |
| `/reset-password` | ✅ Allowed | 🔄 Redirect `/dashboard` | 🔄 Redirect `/dashboard` | 🔄 Redirect `/dashboard` | Middleware & Auth Provider |
| `/preview` | ✅ Allowed (Sandbox) | ✅ Allowed (Sandbox) | ✅ Allowed (Sandbox) | ✅ Allowed (Sandbox) | Isolated UI Sandbox |
| `/dashboard` | ❌ Redirect `/login` | ✅ Member View | ✅ Coordinator View | ✅ Super Admin View | Server Component Guard |
| `/dashboard/departments` | ❌ Redirect `/login` | ✅ Read Only | ✅ Read Only | ✅ Full Manage | `requireProfile()` |
| `/dashboard/projects` | ❌ Redirect `/login` | ✅ Assigned Only | ✅ Dept Projects + Create | ✅ All Projects + Create | `requireProfile()` + RLS |
| `/dashboard/tasks` | ❌ Redirect `/login` | ✅ Assigned + Submit | ✅ Dept Tasks + Assign | ✅ All Tasks + Full Control | `requireProfile()` + RLS |
| `/dashboard/users` | ❌ Redirect `/login` | ❌ Redirect `/dashboard` | ❌ Redirect `/dashboard` | ✅ Full Member Admin | `requireSuperAdmin()` |
| `/dashboard/approvals` | ❌ Redirect `/login` | ❌ Redirect `/dashboard` | ❌ Redirect `/dashboard` | ✅ Final Approval Queue | `requireSuperAdmin()` |
| `/dashboard/settings` | ❌ Redirect `/login` | ✅ User Profile Only | ✅ User Profile Only | ✅ User + Global Config | `requireProfile()` |
| `/dashboard/media` | ❌ Redirect `/login` | ✅ Dept Media | ✅ Dept Media + Upload | ✅ All Media | `requireProfile()` + Bucket RLS |

---

## 2. Server Actions Mutation Matrix

| Server Action | Unauthenticated | MEMBER | COORDINATOR | SUPER_ADMIN | Validation & Protections |
|---|---|---|---|---|---|
| `createProjectAction` | ❌ 401 Unauthorized | ❌ 403 Forbidden | ✅ Own Dept Only | ✅ Any Dept | Zod `ProjectCreateSchema`, code uniqueness, audit log |
| `updateProjectAction` | ❌ 401 Unauthorized | ✅ If Manager | ✅ Own Dept + Manager | ✅ Any Project | Zod `ProjectUpdateSchema`, role & manager verification |
| `assignProjectMemberAction` | ❌ 401 Unauthorized | ❌ 403 Forbidden | ✅ Own Dept Projects | ✅ Any Project | Zod UUID & Role verification, dept ownership check |
| `createTaskAction` | ❌ 401 Unauthorized | ❌ 403 Forbidden | ✅ Own Dept Tasks | ✅ Any Dept | Zod `TaskCreateSchema`, dept ownership, bulk assignees |
| `updateTaskStatusAction` | ❌ 401 Unauthorized | ✅ `TODO` ↔ `IN_PROGRESS` | ✅ Own Dept | ✅ Any Status | Locked status check, non-super-admin regression block |
| `submitDeliverableAction` | ❌ 401 Unauthorized | ✅ If Assigned | ✅ If Dept Coord | ✅ Any Task | Assignment check, terminal state guard, auto-versioning |
| `addTaskCommentAction` | ❌ 401 Unauthorized | ✅ If Assigned | ✅ If Dept Coord | ✅ Any Task | Task membership check, non-empty content check |
| `submitCoordinatorReview` | ❌ 401 Unauthorized | ❌ 403 Forbidden | ✅ Own Dept Only | ✅ Any Submission | Department ownership check, locked submission guard |
| `executeFinalApproval` | ❌ 401 Unauthorized | ❌ 403 Forbidden | ❌ 403 Forbidden | ✅ Super Admin Exclusive | `assertActionSuperAdmin()`, locked check, DB trigger |
| `assignDepartmentMemberAction` | ❌ 401 Unauthorized | ❌ 403 Forbidden | ✅ Own Dept Only | ✅ Any Dept | Target user active check, UUID validation |
| `updateMemberRoleAction` | ❌ 401 Unauthorized | ❌ 403 Forbidden | ❌ 403 Forbidden | ✅ Super Admin Exclusive | Self-demotion block, Zod `RoleSchema` validation |

---

## 3. Workflow State Transition Matrix

| Source State | Target State | Permitted Roles | Required Action / Pre-condition |
|---|---|---|---|
| `TODO` | `IN_PROGRESS` | `MEMBER` (Assigned), `COORDINATOR`, `SUPER_ADMIN` | `updateTaskStatusAction` |
| `IN_PROGRESS` | `TODO` | `MEMBER` (Assigned), `COORDINATOR`, `SUPER_ADMIN` | `updateTaskStatusAction` |
| `TODO` / `IN_PROGRESS` | `COORDINATOR_REVIEW` | `MEMBER` (Assigned), `COORDINATOR`, `SUPER_ADMIN` | `submitDeliverableAction` (Increments version) |
| `COORDINATOR_REVIEW` | `REVISION_REQUIRED` | `COORDINATOR` (Own Dept), `SUPER_ADMIN` | `submitCoordinatorReview("REQUEST_REVISION")` |
| `COORDINATOR_REVIEW` | `SUPER_ADMIN_APPROVAL` | `COORDINATOR` (Own Dept), `SUPER_ADMIN` | `submitCoordinatorReview("SUBMIT_TO_SUPER_ADMIN")` |
| `SUPER_ADMIN_APPROVAL` | `APPROVED` | **`SUPER_ADMIN` ONLY** | `executeFinalApproval` (Locks deliverable) |
| `SUPER_ADMIN_APPROVAL` | `REVISION_REQUIRED` | **`SUPER_ADMIN` ONLY** | `submitCoordinatorReview` or final rejection |
| `SUPER_ADMIN_APPROVAL` | `REJECTED` | **`SUPER_ADMIN` ONLY** | Super Admin decision |
| `APPROVED` | *Any regression* | ❌ **BLOCKED** | Submission immutable (`is_locked = true`) |
