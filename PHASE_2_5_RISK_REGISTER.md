# UEC ESPACE DIGITAL — PHASE 2.5 RISK REGISTER & RUNBOOK

**Target Platform:** UEC Espace Digital  
**Production Domain:** `https://digital.ueclubistes.tn`  
**Production Supabase Reference:** `aigsdarfiplwmzqtqlxh` (PostgreSQL 17.12)  
**Date:** 2026-11-22  

---

## 1. Risk Register Matrix

| Risk ID | Category | Description | Likelihood | Impact | Severity | Mitigation Strategy | Pre-Deployment Check |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| **RSK-01** | Database Migration | Direct REST update on `public.tasks` columns bypassing frontend rules | Medium | High | **HIGH** | Apply `PHASE_2_4_4_PRODUCTION_PATCH.sql` to install `trg_enforce_task_member_immutability` trigger | Verify PostgreSQL 17 runtime preconditions |
| **RSK-02** | Concurrency | Simultaneous final approvals by two Super Admins | Low | Medium | **MEDIUM** | Optimistic lock on `is_locked = false` in `executeFinalApproval` | Verified via `PG17-CONC-01` and `CONC-02` |
| **RSK-03** | Logistics | Simultaneous approval of loan requests for identical hardware | Low | High | **MEDIUM** | Atomic 2-phase availability verification + status rollback | Verified via `PG17-CONC-02` and `CONC-04` |
| **RSK-04** | Operational | Service role secret or database password committed to git | Low | Critical | **CRITICAL** | Strict `.gitignore`, `lib/env.ts` validation, zero secrets in repo | Verified via `SEC-V01` and Git history check |
| **RSK-05** | Repository Divergence | Overwriting remote `main` commits during production deployment | Medium | High | **HIGH** | Never force-push; deploy via dedicated release pull request | Compare remote and local SHA before push |
| **RSK-06** | Availability | Vercel cold starts or API route timeout on heavy queries | Low | Low | **LOW** | Optimized Supabase queries with indexed lookups & SSR streaming | Build output traces verified |

---

## 2. Production Pre-Flight Checklist (Runbook for Super Admin)

Before executing production deployment, the authorized engineering lead must confirm:

1. **[ ] Production Patch Execution:**
   - Execute `docs/sql/PHASE_2_4_4_PRODUCTION_PATCH.sql` in the Supabase SQL Editor (`aigsdarfiplwmzqtqlxh`).
   - Confirm notice: `PRECONDITIONS_PASSED: Project aigsdarfiplwmzqtqlxh catalog verified for Phase 2.4.4 deployment`.
   - Verify triggers:
     ```sql
     SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.tasks'::regclass AND NOT tgisinternal;
     ```
     Must return:
     - `trg_enforce_task_approval`
     - `trg_enforce_task_member_immutability`
     - `trg_set_updated_at`

2. **[ ] Vercel Environment Variables Configuration:**
   Configure in Vercel Project Settings for `https://digital.ueclubistes.tn`:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://aigsdarfiplwmzqtqlxh.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `[Production Anon Key]`
   - `NEXT_PUBLIC_APP_URL` = `https://digital.ueclubistes.tn`
   - `SUPABASE_SERVICE_ROLE_KEY` = `[Production Service Role Key]` (Server-only, no `NEXT_PUBLIC_` prefix)

3. **[ ] Supabase Authentication Redirect URLs:**
   In Supabase Dashboard $\to$ Authentication $\to$ URL Configuration:
   - Site URL: `https://digital.ueclubistes.tn`
   - Redirect URLs:
     - `https://digital.ueclubistes.tn/auth/callback`
     - `https://digital.ueclubistes.tn/reset-password`

4. **[ ] Git Release Deployment:**
   - Publish branch `feature/uec-espace-digital` to `rayenmkadmini/uecdigital`.
   - Merge via standard Pull Request into `main` (NO force push).

---

## 3. Rollback & Disaster Recovery Runbook

If any regression is detected post-deployment:
1. **Immediate Database Rollback:**
   Execute `docs/sql/PHASE_2_4_4_PRODUCTION_ROLLBACK.sql` in Supabase SQL editor.
   This cleanly uninstalls `trg_enforce_task_member_immutability` within 350 ms without touching data or other triggers.
2. **Instant Vercel Rollback:**
   In Vercel Dashboard $\to$ Deployments, select previous deployment and click **"Promote to Production"** (instant zero-downtime rollback).
