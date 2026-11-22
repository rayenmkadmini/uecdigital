# UEC ESPACE DIGITAL — KNOWN LIMITATIONS
## Documentation of Current System Boundaries & Deferred Tasks

**Project:** UEC — Espace Digital  
**Audit Phase:** Phase 2.1 Post-Implementation  
**Date:** 21 Novembre 2026

---

## 1. Database RLS Subquery Column Shadowing (SEC-F01)

### Description
In the deployed PostgreSQL schema migration (`supabase/migrations/20261120210000_espace_digital_core_schema.sql`), subqueries inside `CREATE POLICY` statements on `projects`, `tasks`, `task_submissions`, and `meetings` reference `id` without qualification.

Because PostgreSQL parses unqualified identifiers against the innermost subquery table first:
- `projects_select` evaluates `WHERE ((pm.project_id = pm.id) AND (pm.user_id = auth.uid()))`
- `tasks_select` evaluates `WHERE ((ta.task_id = ta.id) AND (ta.user_id = auth.uid()))`

### Operational Impact
- **Impact on Super Admin & Coordinators:** None. Super Admin bypasses with `is_super_admin(auth.uid())` and Coordinators evaluate `is_coordinator_of(department_id, auth.uid())`.
- **Impact on Members via Direct Client SDK:** Normal members querying `projects` or `tasks` directly from a browser Supabase client would receive 0 rows because `pm.project_id` does not equal `pm.id`.
- **Application Layer Mitigation:** Next.js Server Components and Server Actions run with verified user context on the server runtime, ensuring correct filtering.

### Resolution Plan
An approved database migration (`20261121100000_fix_rls_subquery_qualification.sql`) has been prepared and documented in `docs/PHASE_2_1_AUDIT_REPORT.md` (Section 7). It will be deployed when production database migration access is authorized.

---

## 2. Real-Account Interactive Testing Constraint

### Description
The Supabase authentication table `auth.users` currently contains 0 registered accounts.

### Operational Impact
Interactive end-to-end testing with real credentials in a live browser session could not be executed without creating test user records in the remote Supabase authentication service.

### Resolution Plan
Per strict project safety guidelines, no production user accounts were created or modified during this audit turn. When test accounts are provisioned or mock auth credentials provided, interactive manual testing across the 3 roles can be scheduled.

---

## 3. Large File Storage & CDN Upload Streaming

### Description
Deliverable submissions currently capture file URLs (Drive, Figma, GitHub, WeTransfer) or storage URLs.

### Operational Impact
Direct browser-to-bucket chunked multipart upload for files greater than 50MB (video files, large RAW captures) will be fully integrated during Phase 4 (Storage & Media Pipeline).

---

## 4. Realtime WebSockets Subscription Optimization

### Description
Data synchronization currently relies on Server Actions with Next.js `revalidatePath` and cache tags.

### Operational Impact
Live instant push notifications (without page refresh) for incoming submissions on the Super Admin queue will be added during Phase 5 (Realtime Notifications & Collaborative Features).
