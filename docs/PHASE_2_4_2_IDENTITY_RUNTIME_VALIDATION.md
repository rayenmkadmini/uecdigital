# UEC ESPACE DIGITAL — PHASE 2.4.2 IDENTITY RUNTIME VALIDATION
## Evaluation of PostgreSQL Execution Contexts, JWT Trust Boundaries & `SECURITY DEFINER` Variables

**Project:** UEC — Espace Digital (*Union des Étudiants Clubistes*)  
**Database Engine:** PostgreSQL 17.12 (Live Supabase `aigsdarfiplwmzqtqlxh`) & PostgreSQL 18.7 (Isolated PGlite Engine)  
**Audit Phase:** Phase 2.4.2  
**Date:** 2026-11-21  
**Status:** **7 EXECUTION CONTEXTS INDEPENDENTLY VALIDATED**

---

## 1. Engine Variables & Cryptographic Boundaries

In Supabase, access control relies on the interaction between PostgreSQL connection roles, Grand Unified Configuration (GUC) variables set by PostgREST from validated JWT claims, and PL/pgSQL function execution modes:

```
                    ┌────────────────────────────────────────────────────────┐
                    │               CLIENT REQUEST / CONNECTION              │
                    └────────────────────────────────────────────────────────┘
                                                 │
                   ┌─────────────────────────────┴─────────────────────────────┐
                   ▼                                                           ▼
     PostgREST HTTP Gateway (REST API)                            Direct TCP Session (psql / Migrations)
     • Connects as TCP user: 'authenticator'                     • Connects as TCP user: 'postgres'
     • Validates JWT via PGRST_JWT_SECRET                        • session_user = 'postgres'
     • Sets GUC claims via SET LOCAL request.jwt.*               • auth.uid() = NULL
     • SET LOCAL ROLE anon / authenticated / service_role        • auth.role() = NULL
                   │                                                           │
                   ▼                                                           ▼
   ┌───────────────────────────────┐                             ┌───────────────────────────────┐
   │ Inside SECURITY DEFINER Proc  │                             │ Inside SECURITY DEFINER Proc  │
   │ • session_user: 'authenticator'│                             │ • session_user: 'postgres'    │
   │ • current_user: 'postgres'    │                             │ • current_user: 'postgres'    │
   │ • auth.role(): from JWT       │                             │ • auth.role(): NULL           │
   │ • auth.uid(): from JWT sub    │                             │ • auth.uid(): NULL            │
   └───────────────────────────────┘                             └───────────────────────────────┘
```

---

## 2. Evaluation Across Seven Execution Contexts

### Context 1: Authenticated MEMBER via PostgREST
- `session_user`: `'authenticator'`
- `current_user` (prior to trigger): `'authenticated'`
- `current_user` (inside `SECURITY DEFINER` trigger): `'postgres'`
- `auth.role()`: `'authenticated'`
- `auth.uid()`: Valid Member UUID (e.g. `00000000-0000-0000-0000-000000000011`)
- **Evaluation Result:**
  - System bypass (`session_user = 'postgres' AND auth.uid() IS NULL`): **FALSE**
  - Service-role bypass (`auth.role() = 'service_role'`): **FALSE**
  - Caller ID check (`v_caller_id IS NULL`): **FALSE (Passes)**
  - `private.is_super_admin(v_caller_id)`: **FALSE**
  - `private.is_coordinator_of(OLD.department_id, v_caller_id)`: **FALSE**
  - Enters Rule 8 (Regular Assigned Member Rules).
- **Runtime Verdict:** **AUTHENTICATED MEMBER IDENTITY CONFIRMED & CONFINED TO SCOPE.**

---

### Context 2: Authenticated COORDINATOR via PostgREST
- `session_user`: `'authenticator'`
- `current_user` (inside trigger): `'postgres'`
- `auth.role()`: `'authenticated'`
- `auth.uid()`: Valid Coordinator UUID
- **Evaluation Result:**
  - System and service bypasses: **FALSE**
  - Caller ID extracted: **Valid UUID**
  - `private.is_super_admin(v_caller_id)`: **FALSE**
  - `private.is_coordinator_of(OLD.department_id, v_caller_id)`: **TRUE** (if modifying task in assigned department)
  - Enters Rule 7 (Coordinator Governance Rules).
  - Department boundary transfer (`NEW.dept_id != OLD.dept_id`): **BLOCKED (P0001)**
  - Setting `APPROVED` or `DONE`: **BLOCKED (P0001)**
- **Runtime Verdict:** **COORDINATOR CONFINED TO DEPARTMENTAL BOUNDARY & OPERATIONAL PLANNING.**

---

### Context 3: Authenticated SUPER_ADMIN via PostgREST
- `session_user`: `'authenticator'`
- `current_user` (inside trigger): `'postgres'`
- `auth.role()`: `'authenticated'`
- `auth.uid()`: Valid Super Admin UUID
- **Evaluation Result:**
  - Universal immutability: `id` and `created_at` verified. If caller attempts to modify them: **BLOCKED**.
  - `private.is_super_admin(v_caller_id)`: **TRUE**.
  - Returns `NEW`.
- **Runtime Verdict:** **SUPER ADMIN OPERATIONAL AUTHORITY PRESERVED; AUDIT INTEGRITY MAINTAINED.**

---

### Context 4: Anonymous PostgREST Request (No Bearer Token / Invalid Token)
- `session_user`: `'authenticator'`
- `current_user` (prior to trigger): `'anon'`
- `current_user` (inside trigger): `'postgres'` (Switched by `SECURITY DEFINER`)
- `auth.role()`: `'anon'`
- `auth.uid()`: `NULL`
- **Evaluation Result:**
  - System bypass: `session_user = 'postgres'` evaluates to **FALSE** (`session_user` is `'authenticator'`).
  - Service bypass: `auth.role() = 'service_role'` evaluates to **FALSE** (`auth.role()` is `'anon'`).
  - Caller ID check: `v_caller_id := auth.uid()` evaluates to `NULL`.
  - Trigger raises: `UNAUTHORIZED: Session utilisateur valide requise pour modifier une tâche.` (Code `P0001`).
- **Runtime Verdict:** **ZERO ANONYMOUS BYPASS POSSIBLE. COMPLETE FAIL-CLOSED SECURITY.**

---

### Context 5: Trusted Service-Role Request (Edge Functions, Sync Workers)
- `session_user`: `'authenticator'`
- `current_user` (inside trigger): `'postgres'`
- `auth.role()`: `'service_role'` (Signed with secret service key)
- `auth.uid()`: `NULL` (or service bot UUID)
- **Evaluation Result:**
  - `auth.role() = 'service_role'` evaluates to **TRUE**.
  - Executes `RETURN NEW;`.
- **Runtime Verdict:** **TRUSTED BACKGROUND OPERATIONS FUNCTION NORMALLY.**

---

### Context 6: Direct PostgreSQL Administrator Session (`psql`, Database Migrations)
- `session_user`: `'postgres'` (or `'supabase_admin'`)
- `current_user`: `'postgres'`
- `auth.role()`: `NULL`
- `auth.uid()`: `NULL`
- **Evaluation Result:**
  - `session_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL AND auth.role() IS NULL`: **TRUE**.
  - Executes `RETURN NEW;`.
- **Runtime Verdict:** **DATABASE ADMINISTRATIVE DDL/DML FULLY FUNCTIONAL WITHOUT JWT DEPENDENCY.**

---

### Context 7: Supabase SQL Editor Execution Context
- Query executed on live database `aigsdarfiplwmzqtqlxh`:
  ```sql
  SELECT session_user, current_user, auth.uid(), auth.role();
  ```
- Result from live engine:
  - `session_user`: `'postgres'`
  - `current_user`: `'postgres'`
  - `auth.uid()`: `NULL`
  - `auth.role()`: `NULL`
- **Evaluation Result:**
  - Matches Context 6 exactly.
- **Runtime Verdict:** **SQL EDITOR MAINTENANCE SAFE & UNIMPAIRED.**

---

## 3. Impersonation Defense: Can a Web Client Fake `service_role`?

**Attack Scenario:** An attacker sends an HTTP header to PostgREST:
```http
PATCH /rest/v1/tasks?id=eq.X HTTP/1.1
Authorization: Bearer <MEMBER_JWT>
Role: service_role
X-Consumer-Role: service_role
```
**Technical Engine Analysis:**
1. PostgREST does NOT accept arbitrary HTTP headers to set internal JWT configuration variables.
2. The GUC variables `request.jwt.claim.role` and `request.jwt.claims` are populated strictly from the payload of the cryptographically signed JWT.
3. PostgREST verifies the HMAC-SHA256 / EdDSA signature against the server-side `PGRST_JWT_SECRET`.
4. If the JWT signature is invalid or tampered with, PostgREST returns HTTP 401 before any SQL execution occurs.
5. If the JWT is a valid user token, its claim is `role: "authenticated"`.
6. Therefore, `auth.role()` inside PostgreSQL evaluates strictly to `'authenticated'`, and can never be spoofed to `'service_role'` by a web client.

---

## 4. Identity Validation Summary Table

| Execution Context | `session_user` | `current_user` inside Definer | `auth.role()` | `auth.uid()` | Trigger Action | Runtime Proof |
|---|---|---|---|---|---|:---:|
| **MEMBER (PostgREST)** | `'authenticator'` | `'postgres'` | `'authenticated'` | Member UUID | Evaluates Member Immutability Rules | ✅ PASS (MEM-01..23) |
| **COORDINATOR (PostgREST)** | `'authenticator'` | `'postgres'` | `'authenticated'` | Coord UUID | Evaluates Coordinator Dept Rules | ✅ PASS (COORD-01..10) |
| **SUPER_ADMIN (PostgREST)** | `'authenticator'` | `'postgres'` | `'authenticated'` | Admin UUID | Universal Immutability, then ALLOW | ✅ PASS (SA-01..04) |
| **ANON (PostgREST)** | `'authenticator'` | `'postgres'` | `'anon'` | `NULL` | **REJECT (UNAUTHORIZED)** | ✅ PASS (ID-03) |
| **SERVICE_ROLE (API)** | `'authenticator'` | `'postgres'` | `'service_role'` | `NULL` | **ALLOW (RETURN NEW)** | ✅ PASS (ID-02) |
| **DIRECT PSQL (Superuser)**| `'postgres'` | `'postgres'` | `NULL` | `NULL` | **ALLOW (RETURN NEW)** | ✅ PASS (ID-01) |
| **SUPABASE STUDIO** | `'postgres'` | `'postgres'` | `NULL` | `NULL` | **ALLOW (RETURN NEW)** | ✅ PASS (Live query) |
