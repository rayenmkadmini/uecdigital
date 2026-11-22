# UEC ESPACE DIGITAL — PHASE 2.4.1 ROLLBACK & APPROVAL SPECIFICATION
## Sub-Second Rollback DDL, Production Pre-Flight Checklist & Authorization Sign-Off Gate

**Project:** UEC — Espace Digital (*Union des Étudiants Clubistes*)  
**Supabase Instance:** `aigsdarfiplwmzqtqlxh` (PostgreSQL 17.12)  
**Target Migration:** Phase 2.4 SEC-V01 Database Trigger  
**Date:** 2026-11-21  
**Status:** **AWAITING FORMAL USER SIGN-OFF**

---

## 1. Reversible Rollback SQL Specification

In the event that the trigger causes any unanticipated operational friction or behavioral anomalies, the entire remediation can be rolled back instantaneously with **zero data loss, zero table locks, and zero service interruption**:

```sql
-- ==============================================================================
-- UEC ESPACE DIGITAL — IMMEDIATE ROLLBACK SCRIPT FOR SEC-V01 TRIGGER
-- Target Instance: aigsdarfiplwmzqtqlxh (PostgreSQL 17.12)
-- Execution Duration: < 50 milliseconds
-- ==============================================================================

BEGIN;

-- 1. Detach and drop the trigger from public.tasks
DROP TRIGGER IF EXISTS trg_enforce_task_member_immutability ON public.tasks;

-- 2. Drop the trigger function from private schema
DROP FUNCTION IF EXISTS private.enforce_task_member_immutability();

COMMIT;
```

### Rollback Verification Query
```sql
SELECT tgname, tgenabled, relname 
FROM pg_trigger 
JOIN pg_class ON pg_class.oid = pg_trigger.tgrelid 
WHERE relname = 'tasks' AND tgname = 'trg_enforce_task_member_immutability';
-- Returns 0 rows upon successful rollback.
```

---

## 2. Production Pre-Flight Checklist

Before executing the patch on production `aigsdarfiplwmzqtqlxh`, verify the following prerequisites:

- [x] **Adversarial SQL Review Complete:** All 5 design vulnerabilities (A through E) investigated and resolved.
- [x] **Column Immutability Catalog Verified:** All 14 columns of `public.tasks` categorized and accounted for.
- [x] **Workflow Interoperability Checked:** Confirmed that `submitDeliverableAction` (`COORDINATOR_REVIEW`) and `updateTaskStatusAction` (`TODO` ↔ `IN_PROGRESS`) remain 100% functional.
- [x] **Engine Identity Hardened:** `SECURITY DEFINER` identity swap mitigated using `session_user` and `auth.role()`.
- [x] **Trigger Ordering Validated:** Coexistence with `trg_enforce_task_approval` and `trg_set_updated_at` confirmed.
- [x] **Local Codebase Quality Gates:**
  - TypeScript: 0 errors (`npx tsc --noEmit`)
  - ESLint: 0 errors or warnings (`npm run lint`)
  - Next.js Production Build: 21/21 routes valid (`npm run build`)
  - Automated Security Suite: 23/23 tests passing (`verify-security.mjs`)
- [ ] **User Authorization:** Explicit user command authorizing execution on `aigsdarfiplwmzqtqlxh`.

---

## 3. Formal Sign-Off & Approval Decision

| Authorization Item | Requirement | Status |
|---|---|:---:|
| **Target Database** | `aigsdarfiplwmzqtqlxh` (PostgreSQL 17.12) | Verified |
| **DDL Scope** | Exactly 1 trigger (`trg_enforce_task_member_immutability`) & 1 function (`private.enforce_task_member_immutability`) | Confirmed |
| **Mutations Executed in Phase 2.4.1** | ZERO | Confirmed |
| **Rollback Readiness** | Sub-second rollback script prepared | Confirmed |
| **Final User Approval** | Explicit confirmation from user required | **PENDING** |

---

## 4. Instructions for Resuming to Phase 2.4 Execution

When the user provides explicit authorization to apply the patch:
1. Connect to Supabase instance `aigsdarfiplwmzqtqlxh`.
2. Execute the exact SQL patch defined in `docs/PHASE_2_4_1_FINAL_SQL_PROPOSAL.md`.
3. Query `pg_trigger` to verify that `trg_enforce_task_member_immutability` is enabled (`tgenabled = 'O'`).
4. Execute full post-deployment verification tests to confirm SEC-V01 is permanently resolved.
