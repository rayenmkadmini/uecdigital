# UEC ESPACE DIGITAL — PHASE 2.4.3 SUPABASE IDENTITY REVIEW
## Cryptographic Boundaries, PostgREST GUC Injection & `SECURITY DEFINER` Privilege Analysis

**Project:** UEC — Espace Digital (*Union des Étudiants Clubistes — Depuis 2021*)  
**Database:** PostgreSQL 17.12 (`aigsdarfiplwmzqtqlxh`)  
**Audit Phase:** Phase 2.4.3  
**Date:** 2026-11-21  
**Status:** **INDEPENDENT SECURITY REVIEW OF ENGINE & GATEWAY IDENTITY RESOLUTION**

---

## 1. Identity Propagation Across the Supabase Stack

In a production Supabase architecture, identity is established outside PostgreSQL and transmitted across three distinct abstraction boundaries:

```
[ Client Browser / REST Caller ]
              │  HTTP Bearer <JWT>
              ▼
[ PostgREST HTTP Gateway ]
   1. Decodes JWT using PGRST_JWT_SECRET
   2. Validates expiration ('exp'), issuer ('iss'), signature
   3. Establishes TCP connection to PostgreSQL pooler as user: 'authenticator'
   4. Issues session setup within transaction:
      SET LOCAL ROLE authenticated; -- (or 'anon')
      SET LOCAL request.jwt.claim.sub = '<UUID>';
      SET LOCAL request.jwt.claim.role = 'authenticated';
      SET LOCAL request.jwt.claims = '{"sub":"...", "role":"..."}';
              │
              ▼
[ PostgreSQL Engine (Database) ]
   • session_user: 'authenticator'
   • current_user: 'authenticated'
              │
              ▼ (Trigger Invocation: private.enforce_task_member_immutability())
[ SECURITY DEFINER Execution Context ]
   • session_user: 'authenticator' (Unchanged)
   • current_user: 'postgres' (Switched to function owner)
   • auth.uid(): Evaluates current_setting('request.jwt.claim.sub', true)
   • auth.role(): Evaluates current_setting('request.jwt.claim.role', true)
```

---

## 2. Review of the Seven Execution Contexts

### Context 1: Authenticated MEMBER
- `session_user`: `'authenticator'`
- `current_user`: `'postgres'` (inside function)
- `auth.role()`: `'authenticated'`
- `auth.uid()`: Member's `auth.users.id`
- **Security Check:**
  - `session_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL`: **FALSE** (`session_user` is `'authenticator'`).
  - `auth.role() = 'service_role'`: **FALSE**.
  - `auth.uid() IS NULL`: **FALSE**.
  - Enforces Member rules: strictly locked to `TODO` ↔ `IN_PROGRESS` and verified submissions.
- **Verdict:** **PROPERLY CONFINED.**

### Context 2: Authenticated COORDINATOR
- `session_user`: `'authenticator'`
- `auth.role()`: `'authenticated'`
- `auth.uid()`: Coordinator's UUID
- **Security Check:**
  - Enforces Coordinator rules: confined to their assigned department via `private.is_coordinator_of()`.
  - Blocked from cross-department reassignments (`NEW.department_id IS DISTINCT FROM OLD.department_id`).
  - Blocked from setting `APPROVED` or `DONE`.
- **Verdict:** **PROPERLY CONFINED.**

### Context 3: Authenticated SUPER_ADMIN
- `session_user`: `'authenticator'`
- `auth.role()`: `'authenticated'`
- `auth.uid()`: Super Admin's UUID
- **Security Check:**
  - Universal immutability enforced for `id` and `created_at`.
  - Full operational authority granted.
- **Verdict:** **PROPERLY GOVERNED.**

### Context 4: Anonymous PostgREST Request
- `session_user`: `'authenticator'`
- `current_user`: `'anon'` (switches to `'postgres'` inside `SECURITY DEFINER`)
- `auth.role()`: `'anon'`
- `auth.uid()`: `NULL`
- **Security Check:**
  - System bypass check: `session_user IN ('postgres', 'supabase_admin')` evaluates to **FALSE** because `session_user` is `'authenticator'`.
  - Service bypass check: `auth.role() = 'service_role'` evaluates to **FALSE** (`auth.role()` is `'anon'`).
  - User ID extraction: `v_caller_id := auth.uid()` evaluates to `NULL`.
  - Line 35 raises: `RAISE EXCEPTION 'UNAUTHORIZED: Session utilisateur valide requise pour modifier une tâche.';`
- **Verdict:** **FAIL-CLOSED. ZERO ANONYMOUS BYPASS POSSIBLE.**

### Context 5: Trusted Service-Role API Request
- `session_user`: `'authenticator'`
- `auth.role()`: `'service_role'` (Signed with secret service-role key)
- `auth.uid()`: `NULL`
- **Security Check:**
  - `auth.role() = 'service_role'` evaluates to **TRUE**.
  - Executes `RETURN NEW;`.
- **Verdict:** **TRUSTED WORKERS FUNCTION UNIMPEDED.**

### Context 6: Direct Database Administrator Session (`psql`, Migrations)
- `session_user`: `'postgres'` (or `'supabase_admin'`)
- `auth.role()`: `NULL`
- `auth.uid()`: `NULL`
- **Security Check:**
  - `session_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL AND auth.role() IS NULL` evaluates to **TRUE**.
  - Executes `RETURN NEW;`.
- **Verdict:** **ADMINISTRATIVE MAINTENANCE FULLY FUNCTIONAL WITHOUT JWT DEPENDENCY.**

### Context 7: Supabase SQL Editor / Studio
- Verified on live instance `aigsdarfiplwmzqtqlxh`:
  - `session_user` = `'postgres'`
  - `current_user` = `'postgres'`
  - `auth.uid()` = `NULL`
  - `auth.role()` = `NULL`
- **Security Check:**
  - Matches Context 6 exactly.
- **Verdict:** **STUDIO SESSIONS SAFELY BYPASS WITHOUT USER JWT.**

---

## 3. Critical Threat Model Analysis: Can Client Spoof Claims?

### Can a regular user pass `Role: service_role` in HTTP headers to bypass the trigger?
1. In PostgREST, custom client HTTP headers are stored under `request.headers` (e.g. `current_setting('request.headers', true)::json->>'role'`).
2. PostgREST strictly isolates `request.jwt.claim.role` and `request.jwt.claims`. These variables are populated **exclusively from the decoded payload of the verified JWT**.
3. If an attacker attempts to inject a custom header named `request.jwt.claim.role` or `Role`, PostgREST ignores it for authentication purposes.
4. If an attacker crafts a fake JWT with `role: "service_role"`, PostgREST attempts to verify the signature using `PGRST_JWT_SECRET`. Since the attacker lacks the secret, verification fails, and PostgREST immediately returns HTTP 401 Unauthorized before any SQL transaction begins.
5. Therefore, `auth.role() = 'service_role'` is an **unspoofable, cryptographically validated server-side assertion**.

---

## 4. `SECURITY DEFINER` Function Privilege & Scope Analysis

1. **Function Ownership:** The function is owned by `postgres`.
2. **Search Path Hardening:** `SET search_path = ''` ensures that no attacker can alter `search_path` to inject rogue functions or tables. All referenced objects are schema-qualified (`public.tasks`, `public.task_assignees`, `public.task_submissions`, `private.is_super_admin`, `private.is_coordinator_of`).
3. **Execute Permissions:**
   ```sql
   REVOKE EXECUTE ON FUNCTION private.enforce_task_member_immutability() FROM PUBLIC;
   GRANT EXECUTE ON FUNCTION private.enforce_task_member_immutability() TO authenticated, service_role, postgres;
   ```
   Revoking `EXECUTE` from `PUBLIC` prevents unintended invocation and ensures that the function can only be executed by verified system roles during table trigger operations.
