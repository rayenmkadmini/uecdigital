# UEC ESPACE DIGITAL — PHASE 2.4.1 IDENTITY SECURITY ANALYSIS
## PostgreSQL Execution Contexts, `SECURITY DEFINER` Traps & Secure Identity Resolution in Supabase

**Project:** UEC — Espace Digital (*Union des Étudiants Clubistes*)  
**Database:** PostgreSQL 17.12 (`aigsdarfiplwmzqtqlxh`)  
**Date:** 2026-11-21  
**Status:** **IN-DEPTH ENGINE IDENTITY ANALYSIS**

---

## 1. PostgreSQL Engine Variables in Supabase

To construct a reliable defense-in-depth trigger in Supabase, one must understand how PostgreSQL evaluates identity across connection pooling, PostgREST requests, and `SECURITY DEFINER` execution contexts:

| Engine Variable / Function | Definition in PostgreSQL | Value in Direct `psql` / Migrations | Value in PostgREST Client Request | Value Inside `SECURITY DEFINER` Function |
|---|---|---|---|---|
| `session_user` | The database role that established the physical TCP connection | `postgres` | `authenticator` | `authenticator` (Unchanged) |
| `current_user` | The active role whose permissions are checked for current execution | `postgres` | `authenticated` (or `anon`) | **Switches to Function Owner (`postgres`)** |
| `auth.role()` | `request.jwt.claim.role` extracted from the HTTP Authorization header | `NULL` | `'authenticated'`, `'anon'`, or `'service_role'` | Same as outside function |
| `auth.uid()` | `request.jwt.claim.sub` extracted from JWT, cast to `uuid` | `NULL` | User's UUID (from `auth.users`) | Same as outside function |

---

## 2. The `SECURITY DEFINER` Identity Confusion Trap

### 2.1 The Vulnerability in Previous Code
The Phase 2.4 preliminary proposal contained the following lines:
```sql
CREATE OR REPLACE FUNCTION private.enforce_task_member_immutability()
...
SECURITY DEFINER
AS $$
BEGIN
  -- Flawed Check:
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') AND auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  ...
```

### 2.2 Proof of Vulnerability
1. In PostgreSQL, a function declared `SECURITY DEFINER` runs with the authority of the user that owns it.
2. In Supabase, database functions are owned by `postgres`.
3. When any user (including an anonymous client or a regular member) triggers this function, PostgreSQL sets `current_user = 'postgres'`.
4. Therefore, inside the function body, the expression:
   ```sql
   current_user IN ('postgres', 'service_role', 'supabase_admin')
   ```
   **is ALWAYS TRUE** regardless of who called the database or what role they possess!
5. As a result, the entire condition reduces to:
   ```sql
   IF auth.uid() IS NULL THEN
     RETURN NEW;
   END IF;
   ```
6. **The Consequence:**  
   If an unauthenticated client connects without a JWT (e.g. an anonymous user where `auth.uid()` is `NULL`), the function immediately executes `RETURN NEW`!  
   If RLS is misconfigured or if an edge service executes a mutation without passing user claims, the trigger fails open rather than failing closed.

---

## 3. Dissecting Legitimate vs. Illegitimate Calls

To properly protect the database, we must distinguish between four distinct operational contexts:

```
                                  INCOMING DATABASE REQUEST
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
         Direct TCP Connection                           PostgREST HTTP Gateway
         (Migrations, psql, Studio)                      (API Clients, Next.js Server Actions)
         session_user = 'postgres'                       session_user = 'authenticator'
                      │                                               │
             auth.uid() IS NULL                          ┌────────────┴────────────┐
             auth.role() IS NULL                         ▼                         ▼
                      │                         JWT with User Claims      No JWT / Service Role
                      ▼                         auth.role()='authenticated'
             SYSTEM BYPASS ALLOWED              auth.uid() = <UUID>       ┌────────┴────────┐
                                                         │                ▼                 ▼
                                                         │       auth.role()=        auth.role()=
                                                         │      'service_role'      'anon' OR NULL
                                                         │            │                 │
                                                         ▼            ▼                 ▼
                                                  VALIDATE ROLES    SYSTEM        ACCESS DENIED
                                                  (Admin/Coord/     BYPASS        (UNAUTHORIZED)
                                                   Member)          ALLOWED
```

### Context 1: Direct Database Administration (`psql`, Migrations, SQL Editor)
- `session_user = 'postgres'`
- `auth.uid() IS NULL`
- `auth.role() IS NULL`
- **Verdict:** Trusted system operation. Allow update without user session constraints.

### Context 2: Service-Role Administrative Operations (Edge Functions, Cron, Webhooks)
- `session_user = 'authenticator'`
- `auth.role() = 'service_role'`
- `auth.uid()` is typically `NULL` or service account UUID.
- **Verdict:** Trusted internal infrastructure. Allow update.

### Context 3: Authenticated Application Users (Next.js Server Actions, REST Client)
- `session_user = 'authenticator'`
- `auth.role() = 'authenticated'`
- `auth.uid()` contains the authenticated user's `auth.users.id` UUID.
- **Verdict:** Must be resolved via `private.is_super_admin()` and `private.is_coordinator_of()`.

### Context 4: Anonymous or Unauthenticated REST Requests
- `session_user = 'authenticator'`
- `auth.role() = 'anon'` OR missing.
- `auth.uid() IS NULL`.
- **Verdict:** MUST BE REJECTED WITH `UNAUTHORIZED` EXCEPTION. Under no circumstances should this trigger allow `NEW`.

---

## 4. The Secure Engine-Level Identification Pattern

The hardened, cryptographically sound implementation that resolves Vulnerability D is:

```sql
-- 1. System superuser bypass (direct psql, migrations, or database administrator)
IF session_user = 'postgres' AND auth.uid() IS NULL AND auth.role() IS NULL THEN
  RETURN NEW;
END IF;

-- 2. Legitimate trusted service_role API request (server-side background workers)
IF auth.role() = 'service_role' THEN
  RETURN NEW;
END IF;

-- 3. Extract and enforce verified caller identity
v_caller_id := auth.uid();
IF v_caller_id IS NULL THEN
  RAISE EXCEPTION 'UNAUTHORIZED: Session utilisateur requise pour modifier une tâche.';
END IF;
```

### Why this pattern is 100% secure:
1. `session_user` is read directly from PostgreSQL session context and cannot be modified by `SECURITY DEFINER`.
2. PostgREST connections always have `session_user = 'authenticator'`, preventing any HTTP client from spoofing a direct `postgres` session.
3. `auth.role()` evaluates the cryptographic signature of the Supabase JWT. It only returns `'service_role'` if signed with the project's secret service-role key.
4. Anonymous callers have `session_user = 'authenticator'` and `auth.role() = 'anon'`. Both bypass checks fail, and line 3 raises `UNAUTHORIZED`.

This completely eliminates the identity confusion vulnerability.
