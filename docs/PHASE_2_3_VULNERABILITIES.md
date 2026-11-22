# UEC ESPACE DIGITAL — PHASE 2.3 VULNERABILITY REGISTER & FINDINGS
## Security Findings Classification, Reproduction Scenarios & Risk Assessment

**Project:** UEC — Espace Digital  
**Supabase Instance:** `aigsdarfiplwmzqtqlxh` (PostgreSQL 17.12)  
**Audit Date:** 2026-11-21  

---

## 1. Vulnerability Summary by Severity

| Severity Level | Open Findings | Remediated in Phase 2.3 | Total Tracked |
|---|:---:|:---:|:---:|
| **CRITICAL** | 0 | 0 (CRIT-01 fixed in Phase 1.2) | 0 |
| **HIGH** | 0 | 0 (SEC-F01 fixed in Phase 2.2) | 0 |
| **MEDIUM** | 1 | 0 | 1 |
| **LOW** | 0 | 1 | 1 |
| **INFO** | 2 | 0 | 2 |
| **TOTAL** | **3** | **1** | **4** |

---

## 2. Detailed Findings Register

### Finding SEC-V01: Direct PostgREST Column-Level Mutation Surface on `tasks`
- **Finding ID:** `SEC-V01`
- **Severity:** **MEDIUM**
- **Affected Surface:** Database table `public.tasks`, RLS policy `tasks_update`
- **Category:** Authorization / Defense-in-Depth
- **Description:**  
  PostgreSQL Row-Level Security evaluates row-level access permissions (`USING` and `WITH CHECK`), but does not natively enforce column-level immutability.  
  - *Application Layer Protection:* Server Action `updateTaskStatusAction` (`app/actions/tasks.ts`) completely mitigates this at the application layer by restricting members strictly to `{ status: 'TODO' | 'IN_PROGRESS' }` and never touching administrative columns.
  - *Direct REST Surface:* If a malicious authenticated member with an assigned task bypassed the Next.js frontend and issued a direct HTTP `PATCH /rest/v1/tasks?id=eq.<task_id>` to Supabase PostgREST, they could theoretically mutate administrative fields (`priority`, `department_id`, `project_id`, `created_by`, `coordinator_id`, or `status` to non-approved values). The database trigger `trg_enforce_task_approval` only intercepts transitions to `status = 'APPROVED'`.
- **Reproduction Scenario:**
  ```bash
  # As an assigned member with valid JWT:
  PATCH /rest/v1/tasks?id=eq.<assigned_task_id>
  Content-Type: application/json
  { "priority": "CRITICAL", "department_id": "<other_dept_id>" }
  ```
- **Business Impact:** Potential unauthorized administrative metadata tampering if direct PostgREST is accessed outside the official application frontend.
- **Recommended Remediation:**  
  Deploy the previously formulated `BEFORE UPDATE ON public.tasks` trigger `private.enforce_task_member_immutability()` to guarantee column immutability for non-coordinators and non-admins at the database engine layer.
- **Production Changes Required:** YES (Requires separate DDL migration and explicit user approval).
- **Status:** **DOCUMENTED & AWAITING SEPARATE AUTHORIZATION**

---

### Finding SEC-V02: Open Redirect Potential in OAuth Callback Route
- **Finding ID:** `SEC-V02`
- **Severity:** **LOW**
- **Affected Surface:** `app/auth/callback/route.ts`
- **Category:** Route Security / Redirect Validation
- **Description:**  
  In the authentication callback handler, the `next` query parameter was read directly without validating against protocol-relative URLs (`//evil.com`), which could potentially allow an attacker to craft a phishing redirect link.
- **Reproduction Scenario:**
  ```
  GET /auth/callback?code=<valid_code>&next=//attacker-phishing.com
  ```
- **Business Impact:** Could be leveraged in sophisticated social engineering campaigns against club members.
- **Applied Remediation:**  
  Sanitized `next` parameter in `app/auth/callback/route.ts` line 9 to strictly enforce:
  ```typescript
  const rawNext = searchParams.get("next");
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";
  ```
  Verified via test `SEC-14` in `scripts/verify-security.mjs`.
- **Production Changes Required:** NO (Local code fix only; fully backwards-compatible).
- **Status:** **REMEDIATED & VERIFIED**

---

### Finding SEC-V03: Remaining `auth_rls_initplan` Performance Warnings on Untouched Tables
- **Finding ID:** `SEC-V03`
- **Severity:** **INFO**
- **Affected Surface:** 43 RLS policies across secondary tables (`service_requests`, `content_calendar`, `announcements`, `equipment`, `equipment_loans`, `notifications`, `activity_logs`, `task_comments`, `task_attachments`)
- **Category:** Database Performance / Supabase Linter Rule `0003_auth_rls_initplan`
- **Description:**  
  While the 5 core Phase 2.2 policies were successfully optimized with `(select auth.uid())`, 43 secondary policies created during initial schema creation still invoke bare `auth.uid()`, causing per-row function re-evaluation during large table scans.
- **Business Impact:** Suboptimal query latency at high row volumes; zero security vulnerability.
- **Recommended Remediation:**  
  Batch-optimize secondary table policies in future scheduled maintenance migrations.
- **Production Changes Required:** YES (Future migration).
- **Status:** **TRACKED AS PERFORMANCE BACKLOG**

---

### Finding SEC-V04: Multiple Permissive Policies Warning on 9 Tables
- **Finding ID:** `SEC-V04`
- **Severity:** **INFO**
- **Affected Surface:** Tables `announcements`, `department_members`, `departments`, `equipment`, `meeting_attendees`, `meeting_minutes`, `meetings`, `project_members`, `task_assignees`
- **Category:** Database Linter Rule `0006_multiple_permissive_policies`
- **Description:**  
  Supabase linter flags that multiple permissive policies exist for the same action (`SELECT`). For example, `department_members` has `dept_members_select` (`qual: true`) and `dept_members_manage` (`qual: is_coordinator_of`). In PostgreSQL RLS, multiple permissive policies are combined with logical OR.
- **Business Impact:** Minor query execution plan overhead; zero security impact.
- **Recommended Remediation:**  
  Can be consolidated into single unified policies during future refactoring.
- **Production Changes Required:** YES (Future refactoring).
- **Status:** **ACCEPTED ARCHITECTURAL PATTERN**
