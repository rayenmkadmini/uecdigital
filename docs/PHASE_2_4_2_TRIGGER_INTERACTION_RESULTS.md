# UEC ESPACE DIGITAL — PHASE 2.4.2 TRIGGER INTERACTION RESULTS
## Runtime Verification of Multi-Trigger Execution Order, Exception Cascading & Timestamp Maintenance

**Project:** UEC — Espace Digital (*Union des Étudiants Clubistes*)  
**Database Table:** `public.tasks`  
**Triggers Analyzed:**
1. `trg_enforce_task_approval` (`private.enforce_super_admin_approval()`)
2. `trg_enforce_task_member_immutability` (`private.enforce_task_member_immutability()`)
3. `trg_set_updated_at` (`public.set_updated_at()`)  
**Audit Phase:** Phase 2.4.2  
**Date:** 2026-11-21  
**Status:** **DETERMINISTIC EXECUTION CHAIN CONFIRMED BY RUNTIME TESTS**

---

## 1. PostgreSQL Engine Execution Chain on `public.tasks`

In PostgreSQL, multiple `BEFORE UPDATE FOR EACH ROW` triggers execute sequentially in alphabetical order of their trigger names:

```
               INCOMING UPDATE ON public.tasks (NEW record)
                                   │
                                   ▼
       ┌───────────────────────────────────────────────────────┐
       │ 1. trg_enforce_task_approval                          │
       │    • Position: First ('trg_e...')                     │
       │    • Condition: NEW.status = 'APPROVED'               │
       │    • Non-Super Admin: RAISE 'APPROVAL_VIOLATION'      │
       │    • Super Admin: Passes through                      │
       └───────────────────────────────────────────────────────┘
                                   │
                                   ▼ (If not aborted)
       ┌───────────────────────────────────────────────────────┐
       │ 2. trg_enforce_task_member_immutability               │
       │    • Position: Second ('trg_enforce_task_m...')       │
       │    • Evaluates: Universal immutability (id, created_at)│
       │    • Evaluates: Role permissions (Admin, Coord, Mem)   │
       │    • Enforces: 12-column immutability for members     │
       │    • Enforces: Workflow state transitions             │
       └───────────────────────────────────────────────────────┘
                                   │
                                   ▼ (If not aborted)
       ┌───────────────────────────────────────────────────────┐
       │ 3. trg_set_updated_at                                 │
       │    • Position: Third ('trg_s...')                     │
       │    • Action: NEW.updated_at = now()                   │
       │    • Guarantees fresh timestamp on committed row      │
       └───────────────────────────────────────────────────────┘
                                   │
                                   ▼
                       COMMITTED TO DISK / WAL
```

---

## 2. Runtime Behavior Under Real Transaction Scenarios

The interaction between the three triggers was verified in our isolated PostgreSQL test environment across key operational patterns:

### Pattern 1: Non-Admin Attempts Unauthorized Final Approval (`status = 'APPROVED'`)
- **Execution Path:**
  1. Trigger 1 (`trg_enforce_task_approval`) fires.
  2. Evaluates `NEW.status = 'APPROVED' AND NOT is_super_admin(...)`.
  3. Raises `EXCEPTION: APPROVAL_VIOLATION`.
  4. The transaction aborts immediately. Trigger 2 and Trigger 3 **never execute**.
- **Runtime Proof:** Verified in tests `MEM-15` and `COORD-05`.

### Pattern 2: Member Attempts Column Mutation (`priority = 'CRITICAL'`)
- **Execution Path:**
  1. Trigger 1 fires: `NEW.status` is not `'APPROVED'`. Passes to Trigger 2.
  2. Trigger 2 (`trg_enforce_task_member_immutability`) fires.
  3. Detects `NEW.priority IS DISTINCT FROM OLD.priority`.
  4. Raises `EXCEPTION: FORBIDDEN: Seuls le coordinateur...`.
  5. The transaction aborts. Trigger 3 does not execute. Timestamp is not updated.
- **Runtime Proof:** Verified in tests `MEM-03` through `MEM-13`.

### Pattern 3: Legitimate Planning Update by Coordinator
- **Execution Path:**
  1. Trigger 1 fires: `NEW.status` is `'TODO'`. Returns `NEW`.
  2. Trigger 2 fires: Evaluates `private.is_coordinator_of(OLD.department_id)`. Verifies department boundary and non-approved status. Returns `NEW`.
  3. Trigger 3 (`trg_set_updated_at`) fires: Sets `NEW.updated_at = now()`.
  4. Transaction commits. Row is persisted with updated title/priority and updated timestamp.
- **Runtime Proof:** Verified in tests `COORD-01`, `COORD-02`, and `TRG-01`.

### Pattern 4: Legitimate Final Approval by Super Admin
- **Execution Path:**
  1. Trigger 1 fires: `NEW.status = 'APPROVED'`. Evaluates `private.is_super_admin(caller)`. Returns `true`. Returns `NEW`.
  2. Trigger 2 fires: Verifies `id` and `created_at` are immutable. Identifies `is_super_admin = true`. Returns `NEW`.
  3. Trigger 3 fires: Updates `NEW.updated_at = now()`.
  4. Transaction commits. Task is approved.
- **Runtime Proof:** Verified in test `SA-02`.

---

## 3. Timestamp Invariant & `updated_at` Verification

Because `trg_set_updated_at` executes **after** `trg_enforce_task_member_immutability`:
1. The immutability trigger compares `NEW.updated_at` as received from the client against `OLD.updated_at`.
2. It does NOT erroneously flag the engine-generated timestamp advance as an unauthorized mutation.
3. Every legitimate mutation committed to the database receives an accurate, monotonically increasing `updated_at` timestamp.
- **Runtime Proof:** In test `TRG-01`, `updated_at` was measured before and after a coordinator update:
  - `beforeTask.updated_at` = baseline
  - `afterTask.updated_at` = updated to `Sat Nov 21 2026 14:32:00 GMT+0100`
  - Verified: `afterTask.updated_at >= beforeTask.updated_at` (100% PASS).

---

## 4. Trigger Interaction Conclusion

The three triggers operate in harmonious, deterministic concert. Naming `trg_enforce_task_member_immutability` with `trg_e...m...` places it perfectly between approval verification (`trg_e...a...`) and timestamp maintenance (`trg_s...`). No trigger conflicts or sequence deadlocks exist.
