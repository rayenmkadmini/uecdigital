# UEC ESPACE DIGITAL — PHASE 2.3.1 TEST EVIDENCE DOSSIER
## Comprehensive Evidence Mapping, Line References & Query Audit Logs

**Project:** UEC — Espace Digital  
**Supabase Instance:** `aigsdarfiplwmzqtqlxh` (PostgreSQL 17.12)  
**Date:** 2026-11-21  

---

## 1. Automated Test Suite Evidence (`scripts/verify-security.mjs`)

| Test ID | Test Name | Classification | Primary File / Endpoint | Exact Line Reference / Artifact | Observed Evidence |
|---|---|---|---|---|---|
| **SEC-01** | Removal of demo authentication bypass | `STATIC_ANALYSIS` | `lib/supabase/middleware.ts` | Lines 45–54 | Zero occurrence of `uec_demo_role`; strict `!user && isDashboardRoute` redirect present |
| **SEC-02** | Server-side RBAC engine implementation | `STATIC_ANALYSIS` | `lib/auth/rbac.ts` | Lines 37–118 | `getCurrentProfile()` queries `public.profiles` by `user.id`; verifies `is_active` |
| **SEC-03** | Server Component Guard on `/dashboard/approvals` | `STATIC_ANALYSIS` | `app/dashboard/approvals/page.tsx` | Lines 1–11 | Async Server Component calling `await requireSuperAdmin()` before rendering HTML |
| **SEC-04** | Server Component Guard on `/dashboard/users` | `STATIC_ANALYSIS` | `app/dashboard/users/page.tsx` | Lines 1–12 | Async Server Component calling `await requireSuperAdmin()` before rendering HTML |
| **SEC-05** | Server Action Super Admin re-verification | `STATIC_ANALYSIS` | `app/actions/approvals.ts` | Lines 21–23 | `executeFinalApproval` invokes `await assertActionSuperAdmin()` |
| **SEC-06** | Demo mode sandbox isolation | `STATIC_ANALYSIS` | `app/preview/page.tsx` | Lines 1–60 | Client component with static `MOCK_*` objects; zero database/cookie mutations |
| **SEC-07** | Live PostgREST anonymous read blocking | `LIVE_ANONYMOUS_PROBE` | `GET /rest/v1/profiles?select=*` | HTTP Request via fetch | HTTP 200 returned exactly 0 rows to anonymous client |
| **SEC-08** | i18n dictionaries integrity & RTL | `STATIC_ANALYSIS` | `messages/{fr,ar,en}.json` | `roles.SUPER_ADMIN` | All 3 dictionaries define governance and role keys |
| **DATA-01** | Data Access Layer modularization | `STATIC_ANALYSIS` | `lib/data/*.ts` | File presence | `departments.ts`, `members.ts`, `projects.ts`, `tasks.ts`, `dashboard.ts` exist |
| **DATA-02** | Server Actions authorization integrity | `STATIC_ANALYSIS` | `app/actions/*.ts` | `createProjectAction`, etc. | All mutation functions enforce RBAC and session checks |
| **DATA-03** | Dashboard routes Server Component guards | `STATIC_ANALYSIS` | `app/dashboard/**/page.tsx` | Layout & pages | All 4 core routes enforce `await requireProfile()` |
| **SEC-09** | Cross-department review guard | `STATIC_ANALYSIS` | `app/actions/approvals.ts` | Lines 145–161 | `is_locked` guard + `department.id !== taskDeptId` rejection |
| **SEC-10** | Super Admin self-demotion block | `STATIC_ANALYSIS` | `app/actions/members.ts` | Lines 99–102 | Rejects if `user.id === userId && newRole !== "SUPER_ADMIN"` |
| **SEC-11** | Deliverable assignment & terminal guard | `STATIC_ANALYSIS` | `app/actions/tasks.ts` | Lines 226–248 | Blocks submitted tasks in `APPROVED`, `DONE`, `CANCELLED` |
| **SEC-12** | Task status workflow regression defense | `STATIC_ANALYSIS` | `app/actions/tasks.ts` | Lines 151–157 | Blocks non-admin regression from review/approved states |
| **SEC-13** | Task collaborative comment access control | `STATIC_ANALYSIS` | `app/actions/tasks.ts` | Lines 325–338 | Requires task assignment or department coordinator match |
| **SEC-14** | Open Redirect defense in `/auth/callback` | `STATIC_ANALYSIS` | `app/auth/callback/route.ts` | Line 9 | Validates `rawNext.startsWith("/") && !rawNext.startsWith("//")` |
| **SEC-15** | Universal Server Component layout guard | `STATIC_ANALYSIS` | `app/dashboard/layout.tsx` | Line 11 | `await requireProfile()` guards entire `/dashboard/*` subtree |
| **SEC-16** | Live anonymous POST rejected on `tasks` | `LIVE_ANONYMOUS_PROBE` | `POST /rest/v1/tasks` | HTTP Request via fetch | HTTP 401 returned (Unauthorized anonymous mutation) |
| **SEC-17** | Live anonymous POST rejected on submissions | `LIVE_ANONYMOUS_PROBE` | `POST /rest/v1/task_submissions` | HTTP Request via fetch | HTTP 401 returned (Unauthorized anonymous mutation) |
| **SEC-18** | Server Action runtime input validation | `STATIC_ANALYSIS` | `app/actions/*.ts` | Zod Schemas | UUID and enum schemas validated before database calls |
| **SEC-19** | Private schema RBAC function isolation | `STATIC_ANALYSIS` | `supabase/migrations/...sql` | `private.*` functions | Security DEFINER helper functions isolated from REST exposure |
| **SEC-20** | Role protection & approval triggers | `STATIC_ANALYSIS` | `supabase/migrations/...sql` | `trg_*` triggers | Triggers guard against direct role escalation and lock tampering |

---

## 2. Live Database Catalog Evidence (`aigsdarfiplwmzqtqlxh`)

| Catalog Item | Query Target | PostgreSQL Catalog Table | Observed Raw Result | Verification Conclusion |
|---|---|---|---|---|
| **RLS Policy: `projects_select`** | `public.projects` | `pg_policies` | `qual: (private.is_super_admin(( SELECT auth.uid() AS uid)) OR private.is_coordinator_of(department_id, ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1 FROM project_members pm WHERE ((pm.project_id = projects.id) AND (pm.user_id = ( SELECT auth.uid() AS uid))))))` | Outer-table correlation `projects.id` confirmed; initPlan active |
| **RLS Policy: `tasks_select`** | `public.tasks` | `pg_policies` | `qual: (private.is_super_admin(( SELECT auth.uid() AS uid)) OR private.is_coordinator_of(department_id, ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1 FROM task_assignees ta WHERE ((ta.task_id = tasks.id) AND (ta.user_id = ( SELECT auth.uid() AS uid))))))` | Outer-table correlation `tasks.id` confirmed; initPlan active |
| **RLS Policy: `tasks_update`** | `public.tasks` | `pg_policies` | `qual` & `with_check`: `ta.task_id = tasks.id` | Outer-table correlation in both USING and WITH CHECK |
| **RLS Policy: `submissions_insert`** | `public.task_submissions` | `pg_policies` | `with_check: ((submitted_by = ( SELECT auth.uid() AS uid)) AND ((EXISTS ( SELECT 1 FROM task_assignees ta WHERE ((ta.task_id = task_submissions.task_id) AND (ta.user_id = ( SELECT auth.uid() AS uid))))) OR private.is_super_admin(( SELECT auth.uid() AS uid))))` | Tautology eliminated; coordinator impersonation blocked |
| **RLS Policy: `meetings_select`** | `public.meetings` | `pg_policies` | `qual: ma.meeting_id = meetings.id` | Outer-table correlation confirmed; attendees can view |
| **Storage Bucket: `espace-digital-media`** | `storage.buckets` | `storage.buckets` | `public: false`, `file_size_limit: 52428800`, 11 allowed MIME types | Private bucket, strict MIME whitelist, 50MB limit |
| **Storage Policy: `media_bucket_delete`** | `storage.objects` | `pg_policies` | `qual: (owner = auth.uid()) OR private.is_super_admin(auth.uid())` | Deletion restricted to owner or Super Admin |
| **RLS Coverage** | Schema `public` | `pg_class` | 23/23 tables report `relrowsecurity = true` | 100% universal RLS coverage |
| **Public Views** | Schema `public` | `information_schema.views` | Returned 0 rows | Zero views in `public` (zero view bypass risk) |
| **User Population** | `auth.users` | `auth.users` | `count = 0` | Confirms zero users in production; explains why dynamic user tests were skipped |
