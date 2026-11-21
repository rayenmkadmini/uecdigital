# UEC ESPACE DIGITAL — PHASE 2.4.3 POSTGRESQL VERSION COMPATIBILITY
## Engine Comparison: PostgreSQL 17.12 (Supabase Production) vs. PostgreSQL 18.7 (PGlite Isolated Test Environment)

**Project:** UEC — Espace Digital (*Union des Étudiants Clubistes — Depuis 2021*)  
**Production Engine:** Supabase PostgreSQL 17.12 (Region: `eu-west-1`)  
**Isolated Test Engine:** PGlite 0.5.17 (PostgreSQL 18.7 wasm32-unknown-emscripten)  
**Audit Phase:** Phase 2.4.3  
**Date:** 2026-11-21  
**Status:** **VERSION COMPATIBILITY ANALYZED — CORE CONSTRUCTS 100% PORTABLE**

---

## 1. Context & Motivation

Phase 2.4.2 executed its 54 runtime tests inside `@electric-sql/pglite`, which runs an official build of PostgreSQL 18.7 compiled to WebAssembly. The production Supabase instance (`aigsdarfiplwmzqtqlxh`) runs PostgreSQL 17.12.

An independent security review must determine:
1. Whether any SQL syntax, trigger semantics, or PL/pgSQL features utilized in the proposed remediation depend on PostgreSQL 18-specific changes.
2. Whether the findings from PGlite are 100% portable to PostgreSQL 17.12.
3. Which elements remain unverified until tested directly against the live Supabase stack.

---

## 2. Feature-by-Feature Portability Matrix

| SQL / Engine Construct | Syntax in Proposal | Introduced in PostgreSQL | Behavior in PG 17.12 | Behavior in PG 18.7 | Compatibility Assessment |
|---|---|:---:|:---:|:---:|:---:|
| **`BEFORE UPDATE` Triggers** | `CREATE TRIGGER ... BEFORE UPDATE ... FOR EACH ROW` | v7.0+ | Standard | Standard | **100% Identical** |
| **`IS DISTINCT FROM` Operator** | `NEW.col IS DISTINCT FROM OLD.col` | v7.3+ | Standard | Standard | **100% Identical** |
| **`SECURITY DEFINER`** | `CREATE FUNCTION ... SECURITY DEFINER` | v7.3+ | Standard | Standard | **100% Identical** |
| **`SET search_path = ''`** | `CREATE FUNCTION ... SET search_path = ''` | v8.3+ | Standard | Standard | **100% Identical** |
| **Custom GUCs via `current_setting()`** | `current_setting('request.jwt.claim.sub', true)` | v8.4+ | Standard | Standard | **100% Identical** |
| **`RAISE EXCEPTION` in PL/pgSQL** | `RAISE EXCEPTION 'FORBIDDEN: ...'` | v7.0+ | Standard | Standard | **100% Identical** |
| **Alphabetical Trigger Ordering** | Multiple `BEFORE UPDATE` triggers execute alphabetically | v7.3+ | Alphabetical | Alphabetical | **100% Identical** |
| **`session_user` vs `current_user`** | Identification of connection vs active definer user | v7.3+ | Standard | Standard | **100% Identical** |
| **`REVOKE / GRANT EXECUTE`** | Revoke from PUBLIC, grant to authenticated | v7.0+ | Standard | Standard | **100% Identical** |

---

## 3. Analysis of PostgreSQL 18 Changes vs. PostgreSQL 17

A detailed review of PostgreSQL release notes between v17 and v18 confirms:
1. **Trigger Engine:** No breaking changes were introduced to the row-level trigger execution engine, exception handling, or `OLD`/`NEW` record access.
2. **PL/pgSQL Language:** The PL/pgSQL procedural language syntax, control structures (`IF ... THEN ... ELSIF`), and variable assignment semantics remain unchanged.
3. **Null Handling:** `IS DISTINCT FROM` semantics are identical in both versions.
4. **Conclusion on SQL Portability:** **All PL/pgSQL and SQL statements in the proposed trigger function and trigger definition are fully portable to PostgreSQL 17.12 without modification.**

---

## 4. PGlite Limitations & What Remains "Not Verified"

While the SQL engine logic is 100% portable, PGlite operates under specific architectural boundaries that differ from Supabase Production:

| Operational Dimension | PGlite (Isolated Test) | Supabase Production (`aigsdarfiplwmzqtqlxh`) | Status |
|---|---|---|:---:|
| **SQL Engine Parsing & Execution** | Real PostgreSQL C engine (Wasm) | Real PostgreSQL 17.12 C engine | ✅ PORTABLE |
| **Row Level Security (RLS) Interaction** | Supported, manually configured | Managed by Supabase RLS policies | ✅ VERIFIED |
| **PostgREST HTTP Gateway** | Simulated via `set_config()` | Real Haskell PostgREST daemon | ⚠️ **NOT VERIFIED OVER HTTP** |
| **JWT Cryptographic Verification** | Simulated GUC injection | Verified via `PGRST_JWT_SECRET` | ⚠️ **NOT VERIFIED OVER HTTP** |
| **PostgREST Connection Pooling** | Single in-memory connection | Supavisor / PgBouncer pooler | ⚠️ **NOT VERIFIED UNDER POOLING** |

---

## 5. Architectural Verdict

The core database logic (`private.enforce_task_member_immutability`) is **fully compatible with PostgreSQL 17.12**.  
However, because PGlite simulates the PostgREST authentication context via PostgreSQL GUC variables (`set_config`), end-to-end HTTP request processing through the live PostgREST gateway remains **not verified on production**. This distinction must be explicitly accounted for in the final production deployment strategy.
