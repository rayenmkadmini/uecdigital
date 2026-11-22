-- ==============================================================================
-- UEC ESPACE DIGITAL — PRODUCTION SQL ROLLBACK PACKAGE
-- Phase: 2.4.4 Production Execution Package
-- Target Project: aigsdarfiplwmzqtqlxh
-- Engine: PostgreSQL 17.12 (Supabase)
-- Rollback Target: trg_enforce_task_member_immutability
-- ==============================================================================
--
-- IMPORTANT SAFETY NOTICE:
-- This script reverses Phase 2.4.4 instantaneously (< 100ms execution time).
-- It removes ONLY the immutability trigger and function.
-- It leaves all pre-existing tables, columns, rows, RLS policies, and triggers untouched.
-- ==============================================================================

BEGIN;

-- 1. DROP TRIGGER SAFELY
DROP TRIGGER IF EXISTS trg_enforce_task_member_immutability ON public.tasks;

-- 2. DROP FUNCTION SAFELY
DROP FUNCTION IF EXISTS private.enforce_task_member_immutability();

COMMIT;

-- ==============================================================================
-- 3. POST-ROLLBACK VERIFICATION QUERIES (READ-ONLY)
-- ==============================================================================

-- 3.1 Verify public.tasks triggers (must return exactly 2 pre-existing triggers)
SELECT 
    t.tgname AS trigger_name,
    p.proname AS function_name,
    n.nspname AS schema_name,
    t.tgtype
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE c.relname = 'tasks' AND NOT t.tgisinternal
ORDER BY t.tgname;

-- Expected Output:
-- 1. trg_enforce_task_approval (private.enforce_super_admin_approval)
-- 2. trg_set_updated_at (public.set_updated_at)

-- 3.2 Verify Function Removal
SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'private' AND p.proname = 'enforce_task_member_immutability'
) AS function_still_exists;

-- Expected Output:
-- function_still_exists: false
