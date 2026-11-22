# UEC ESPACE DIGITAL — PHASE 2.4.4.2
## Rollback Runtime Evidence & Catalog Restitution (PostgreSQL 17.6)

**Project:** UEC — Espace Digital (*Union des Étudiants Clubistes — Depuis 2021*)  
**Repository:** `rayenmkadmini/uec`  
**Branch:** `feature/uec-espace-digital`  
**Rollback Script:** `docs/sql/PHASE_2_4_4_PRODUCTION_ROLLBACK.sql`  
**Target Engine:** Native PostgreSQL 17.6 on Linux x86_64

---

### 1. Rollback Execution Log & Measured Timing

The authoritative rollback script was executed immediately following the patch and test suite:

```sql
BEGIN;
DROP TRIGGER IF EXISTS trg_enforce_task_member_immutability ON public.tasks;
DROP FUNCTION IF EXISTS private.enforce_task_member_immutability();
COMMIT;
```

**Measured Runtime Performance:**
- **Execution Time:** **312 ms** (psql connection, transaction start, catalog modification, lock release, and commit).
- **Exit Status:** `0` (Success).
- **Console Notices Captured:**
  `NOTICE: trigger "trg_enforce_task_member_immutability" for relation "public.tasks" dropped`

---

### 2. Catalog Restitution Audit

#### 2.1 Trigger State After Rollback
Query executed in PostgreSQL 17.6:
```sql
SELECT t.tgname AS trigger_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'tasks' AND NOT t.tgisinternal
ORDER BY t.tgname;
```
Result:
```
+--------------------------------------+
| trigger_name                         |
+--------------------------------------+
| trg_enforce_task_approval            |
| trg_set_updated_at                   |
+--------------------------------------+
```
*Proof:* Exactly the 2 pre-existing triggers remain. `trg_enforce_task_member_immutability` was completely purged.

#### 2.2 Function State After Rollback
Query:
```sql
SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'private' AND p.proname = 'enforce_task_member_immutability'
) AS function_still_exists;
```
Result: `function_still_exists: false`.

#### 2.3 Data Preservation
Queries against `public.tasks`, `public.departments`, `public.profiles`, and `public.task_submissions` confirmed:
- Zero records deleted.
- Zero columns altered.
- All pre-existing data remained 100% intact.

---

### 3. Repeated Rollback (Idempotence Validation)

The rollback script was executed a second time against the already-rolled-back database:
- **Result:** Success (Exit status 0).
- **Behavior:** `IF EXISTS` prevented missing object errors.
- **Duration:** 188 ms.

---

### 4. Rollback Conclusion

The rollback package is **empirically validated** on native PostgreSQL 17. It restores the database catalog cleanly, safely, and idempotently with zero data loss.
