# UEC ESPACE DIGITAL — PHASE 2.4.4
## Final Production SQL Review & Patch Package Specification

**Project:** UEC — Espace Digital (*Union des Étudiants Clubistes — Depuis 2021*)  
**Repository:** `rayenmkadmini/uec`  
**Branch:** `feature/uec-espace-digital`  
**Target Supabase Project:** `aigsdarfiplwmzqtqlxh`  
**Authoritative SQL Patch:** [docs/sql/PHASE_2_4_4_PRODUCTION_PATCH.sql](file:///d:/uecdegital/docs/sql/PHASE_2_4_4_PRODUCTION_PATCH.sql)  
**Authoritative SQL Rollback:** [docs/sql/PHASE_2_4_4_PRODUCTION_ROLLBACK.sql](file:///d:/uecdegital/docs/sql/PHASE_2_4_4_PRODUCTION_ROLLBACK.sql)  
**Patch SHA-256:** `D23367632C85BA0D5F845E76BCE053FB02B471FD55E4F6FF93032524676DE75A`  
**Rollback SHA-256:** `599EA4246FB357543731822CF744F82F34EC1D0322CDD15B30A42DCCAADA5649`

---

### 1. Reconciliation of Previous Phases

To guarantee absolute integrity, the SQL proposal was reconciled across all previous development and testing phases:

1. **Phase 2.4.1 (Commit `2ef7af4`):**  
   - Established the baseline trigger architecture (`trg_enforce_task_member_immutability`) and PL/pgSQL function (`private.enforce_task_member_immutability()`).
   - Defined the core immutability invariant across 10 structural task columns.
2. **Phase 2.4.2 (Commit `bac4ab0`):**  
   - Implemented real transactional PostgreSQL test runner with 54 test scenarios in `@electric-sql/pglite`.
   - Discovered and addressed two critical edge cases:
     - **COORD-08:** Prohibited Coordinators from setting `status = 'DONE'` directly, which would have bypassed Super Admin review.
     - **MEM-24:** Added an explicit assignment check on `public.task_assignees` to provide defense-in-depth against RLS misconfigurations.
3. **Phase 2.4.3 (Commit `62441f3`):**  
   - Conducted independent line-by-line security review.
   - Replaced custom mock settings with real Supabase GUC parameters: `current_setting('request.jwt.claim.sub', true)` and `current_setting('request.jwt.claim.role', true)`.
   - Verified that PostgREST does not allow client-controlled headers to spoof `request.jwt.claim.role`.
   - Added `supabase_admin` alongside `postgres` in Rule 1 maintenance bypass.
   - Issued **CONDITIONAL GO** decision pending Phase 2.4.4 execution planning.
4. **Phase 2.4.4 (Current Phase):**  
   - Consolidated the complete, authoritative patch into `docs/sql/PHASE_2_4_4_PRODUCTION_PATCH.sql`.
   - Embedded transactional preconditions block (`DO $$ ... $$;`).
   - Configured explicit function ownership (`postgres`) and restricted EXECUTE privileges (`postgres, service_role, authenticated`).

---

### 2. Line-by-Line Architecture Review

The authoritative production patch consists of four discrete stages wrapped in a single transaction (`BEGIN; ... COMMIT;`):

#### Stage 1: Preconditions & Project Safeguards (`DO $$ ... $$;`)
- **Version Check:** Queries `current_setting('server_version_num')::integer >= 170000`. Aborts immediately if executed on an outdated engine.
- **Table & Column Check:** Verifies that `public.tasks` exists and possesses the `acceptance_criteria` column.
- **Helper Function Check:** Verifies that `private.is_super_admin` and `private.is_coordinator_of` exist and are callable.
- **Pre-Existing Trigger Check:** Confirms that `trg_enforce_task_approval` and `trg_set_updated_at` are present on `public.tasks`.

#### Stage 2: Trigger Function (`private.enforce_task_member_immutability()`)
- **Execution Mode:** `SECURITY DEFINER` allows the function to inspect `public.task_assignees` and `public.task_submissions` safely even if caller privileges are restricted.
- **Search Path:** `SET search_path = ''` completely prevents search path hijack attacks. Every table and function reference is explicitly schema-qualified (`auth.`, `private.`, `public.`).
- **Rule 1 (Direct DB Maintenance):**  
  ```sql
  IF session_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL AND auth.role() IS NULL THEN
    RETURN NEW;
  END IF;
  ```
  Permits DB migrations and DBA sessions while blocking PostgREST clients.
- **Rule 2 (Service Role):**  
  ```sql
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  ```
  Allows trusted backend workers and cron jobs to operate without restrictions.
- **Rule 3 (Authentication Enforcement):**  
  Raises `UNAUTHORIZED` if `auth.uid()` is null.
- **Rule 4 (Universal Immutability):**  
  Raises `FORBIDDEN` if any caller (including Super Admins) attempts to alter `id` or `created_at`.
- **Rule 5 (Role Resolution):**  
  Resolves `is_super_admin` and `is_coordinator_of` using trusted `private` functions.
- **Rule 6 (Super Admin Authority):**  
  Super Admins are granted full update authority over tasks across all departments.
- **Rule 7 (Department Coordinator Governance):**  
  - Blocks cross-department task transfers (`department_id`).
  - Blocks task author modification (`created_by`).
  - Freezes tasks under `SUPER_ADMIN_APPROVAL`, `APPROVED`, or `DONE`.
  - Blocks direct status moves to `APPROVED` or `DONE`.
- **Rule 8 (Assigned Member Constraints):**  
  - Requires user to be assigned to the task (`public.task_assignees`).
  - Freezes all 10 structural fields (`department_id`, `project_id`, `title`, `description`, `acceptance_criteria`, `priority`, `deadline`, `start_date`, `created_by`, `coordinator_id`).
  - Freezes tasks in review or terminal states (`COORDINATOR_REVIEW`, `SUPER_ADMIN_APPROVAL`, `APPROVED`, `DONE`, `CANCELLED`).
  - Restricts status changes to working states (`TODO`, `IN_PROGRESS`) or promotion to `COORDINATOR_REVIEW` (which strictly requires an existing `PENDING_COORDINATOR` deliverable in `public.task_submissions`).

#### Stage 3: Privileges & Ownership
```sql
ALTER FUNCTION private.enforce_task_member_immutability() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.enforce_task_member_immutability() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.enforce_task_member_immutability() TO postgres, service_role, authenticated;
```
Ensures least privilege: `anon` has no execute rights, and `PUBLIC` is revoked.

#### Stage 4: Trigger Definition
```sql
DROP TRIGGER IF EXISTS trg_enforce_task_member_immutability ON public.tasks;

CREATE TRIGGER trg_enforce_task_member_immutability
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION private.enforce_task_member_immutability();
```
- Operates `BEFORE UPDATE FOR EACH ROW`.
- Alphabetical name ordering ensures execution between `trg_enforce_task_approval` and `trg_set_updated_at`.

---

### 3. Authoritative Checksums

| File Path | SHA-256 Checksum | Purpose |
|:---|:---|:---|
| `docs/sql/PHASE_2_4_4_PRODUCTION_PATCH.sql` | `D23367632C85BA0D5F845E76BCE053FB02B471FD55E4F6FF93032524676DE75A` | Standalone remediation patch |
| `docs/sql/PHASE_2_4_4_PRODUCTION_ROLLBACK.sql` | `599EA4246FB357543731822CF744F82F34EC1D0322CDD15B30A42DCCAADA5649` | Sub-second rollback script |

Both files are saved in `docs/sql/`, verified idempotent, and ready for deployment upon user authorization.
