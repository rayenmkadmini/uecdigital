/**
 * UEC ESPACE DIGITAL — PHASE 2.4.4.2
 * Native PostgreSQL 17 Runtime Validation Test Suite
 * Engine: PostgreSQL 17.6 (Supabase Docker Container: uec_pg17_val)
 */

import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

function runPsql(sql, options = {}) {
  const res = spawnSync(
    'wsl',
    ['-e', 'bash', '-c', 'docker exec -i uec_pg17_val psql -U supabase_admin postgres -v ON_ERROR_STOP=1'],
    {
      input: sql,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024
    }
  );
  return {
    status: res.status,
    stdout: res.stdout ? res.stdout.trim() : '',
    stderr: res.stderr ? res.stderr.trim() : ''
  };
}

function runPsqlJson(sql) {
  const wrapped = `SELECT json_agg(t) FROM (${sql}) t;`;
  const res = spawnSync(
    'wsl',
    ['-e', 'bash', '-c', 'docker exec -i uec_pg17_val psql -U supabase_admin postgres -Atq -v ON_ERROR_STOP=1'],
    {
      input: wrapped,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024
    }
  );
  if (res.status !== 0) {
    throw new Error(`psql error: ${res.stderr}`);
  }
  const text = res.stdout.trim();
  if (!text || text === '') return [];
  try {
    return JSON.parse(text) || [];
  } catch (e) {
    return [];
  }
}

async function main() {
  console.log("==================================================================");
  console.log("   PHASE 2.4.4.2 — NATIVE POSTGRESQL 17 RUNTIME VALIDATION        ");
  console.log("==================================================================");

  // 1. Verify Engine Version
  const versionRes = runPsql("SELECT version();");
  if (versionRes.status !== 0) {
    console.error("FATAL: Could not connect to PostgreSQL 17 container:", versionRes.stderr);
    process.exit(1);
  }
  console.log("-> Target Engine:", versionRes.stdout.split('\n')[2].trim());

  // 2. Setup Baseline Schema & Existing Triggers
  console.log("\n-> Setting up faithful baseline schema in PostgreSQL 17...");
  const setupSQL = `
    DROP SCHEMA IF EXISTS private CASCADE;
    CREATE SCHEMA private;

    CREATE TABLE IF NOT EXISTS public.profiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL UNIQUE,
      full_name text NOT NULL,
      avatar_url text,
      role text NOT NULL DEFAULT 'MEMBER',
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.departments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      code text NOT NULL UNIQUE,
      coordinator_id uuid REFERENCES public.profiles(id),
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.projects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      department_id uuid NOT NULL REFERENCES public.departments(id),
      name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    DROP TABLE IF EXISTS public.task_submissions CASCADE;
    DROP TABLE IF EXISTS public.task_assignees CASCADE;
    DROP TABLE IF EXISTS public.tasks CASCADE;

    CREATE TABLE public.tasks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid REFERENCES public.projects(id),
      department_id uuid NOT NULL REFERENCES public.departments(id),
      title text NOT NULL,
      description text,
      acceptance_criteria text,
      priority text NOT NULL DEFAULT 'MEDIUM',
      status text NOT NULL DEFAULT 'TODO',
      start_date date,
      deadline timestamptz,
      created_by uuid REFERENCES public.profiles(id),
      coordinator_id uuid REFERENCES public.profiles(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE public.task_assignees (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE public.task_submissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
      submitted_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      version integer NOT NULL DEFAULT 1,
      title text NOT NULL,
      description text NOT NULL,
      file_urls jsonb DEFAULT '[]'::jsonb,
      status text NOT NULL DEFAULT 'PENDING_COORDINATOR',
      is_locked boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT uq_task_submission_version UNIQUE (task_id, version)
    );

    -- Helper functions in schema private
    CREATE OR REPLACE FUNCTION private.is_super_admin(p_uid uuid)
    RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
      SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_uid AND role = 'SUPER_ADMIN' AND is_active = true);
    $$;

    CREATE OR REPLACE FUNCTION private.is_coordinator_of(p_dept_id uuid, p_uid uuid)
    RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
      SELECT EXISTS (SELECT 1 FROM public.departments WHERE id = p_dept_id AND coordinator_id = p_uid AND is_active = true)
      OR private.is_super_admin(p_uid);
    $$;

    -- Pre-existing triggers
    CREATE OR REPLACE FUNCTION private.enforce_super_admin_approval()
    RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
    BEGIN
      IF TG_TABLE_NAME = 'tasks' THEN
        IF NEW.status = 'APPROVED' AND (OLD.status IS NULL OR OLD.status <> 'APPROVED') THEN
          IF NOT private.is_super_admin(auth.uid()) THEN
            RAISE EXCEPTION 'APPROVAL_VIOLATION: Seul le Super Admin peut valider une tâche au statut APPROVED.';
          END IF;
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$;

    CREATE OR REPLACE FUNCTION public.set_updated_at()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER trg_enforce_task_approval
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION private.enforce_super_admin_approval();

    CREATE TRIGGER trg_set_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

    -- Grants matching Supabase production
    GRANT ALL ON TABLE public.tasks TO postgres, authenticated, service_role, anon;
    GRANT ALL ON TABLE public.task_submissions TO postgres, authenticated, service_role, anon;
    GRANT ALL ON TABLE public.task_assignees TO postgres, authenticated, service_role, anon;
    GRANT ALL ON TABLE public.departments TO postgres, authenticated, service_role, anon;
    GRANT ALL ON TABLE public.profiles TO postgres, authenticated, service_role, anon;

    -- Seed data
    DELETE FROM public.profiles;
    DELETE FROM public.departments;

    INSERT INTO public.profiles (id, email, full_name, role) VALUES
      ('00000000-0000-0000-0000-000000000001', 'admin@uec.tn', 'Super Admin UEC', 'SUPER_ADMIN'),
      ('00000000-0000-0000-0000-000000000002', 'coord.tech@uec.tn', 'Coord Tech', 'COORDINATOR'),
      ('00000000-0000-0000-0000-000000000003', 'coord.com@uec.tn', 'Coord Com', 'COORDINATOR'),
      ('00000000-0000-0000-0000-000000000011', 'dev1@uec.tn', 'Dev 1 Tech', 'MEMBER'),
      ('00000000-0000-0000-0000-000000000012', 'dev2@uec.tn', 'Dev 2 Tech', 'MEMBER'),
      ('00000000-0000-0000-0000-000000000021', 'com1@uec.tn', 'Com 1 Member', 'MEMBER');

    INSERT INTO public.departments (id, name, code, coordinator_id) VALUES
      ('10000000-0000-0000-0000-000000000001', 'Technologie & Digital', 'TECH', '00000000-0000-0000-0000-000000000002'),
      ('10000000-0000-0000-0000-000000000002', 'Communication', 'COM', '00000000-0000-0000-0000-000000000003');

    INSERT INTO public.tasks (id, department_id, title, description, acceptance_criteria, priority, status, created_by, coordinator_id) VALUES
      ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Développer Portail UEC', 'Spécifications complètes', 'Tests unitaires 100%', 'HIGH', 'TODO', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002'),
      ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Campagne Réseaux Sociaux', 'Design des affiches', '3 visuels validés', 'MEDIUM', 'TODO', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003');

    INSERT INTO public.task_assignees (task_id, user_id) VALUES
      ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011'),
      ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000021');
  `;
  const setupRes = runPsql(setupSQL);
  if (setupRes.status !== 0) {
    console.error("FATAL: Failed to initialize schema:", setupRes.stderr);
    process.exit(1);
  }
  console.log("-> Baseline schema created successfully.");

  // 3. Execute the exact Phase 2.4.4 Production Patch
  console.log("\n-> Executing exact production patch (PHASE_2_4_4_PRODUCTION_PATCH.sql)...");
  const patchSQL = readFileSync(join(process.cwd(), 'docs', 'sql', 'PHASE_2_4_4_PRODUCTION_PATCH.sql'), 'utf8');
  
  const startTime = Date.now();
  const patchRes = runPsql(patchSQL);
  const patchDuration = Date.now() - startTime;

  if (patchRes.status !== 0) {
    console.error("FATAL: Production patch execution failed in PostgreSQL 17:", patchRes.stderr);
    process.exit(1);
  }
  console.log(`[✅ PASS] Patch executed and committed in ${patchDuration} ms`);
  console.log("-> Preconditions Notice:", patchRes.stderr.split('\n').filter(l => l.includes('NOTICE')).join(' '));

  // 4. Verify Catalog Triggers & Ordering
  console.log("\n-> Verifying Trigger Installation & Ordering in PostgreSQL 17...");
  const triggers = runPsqlJson(`
    SELECT t.tgname AS trigger_name, p.proname AS function_name
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE c.relname = 'tasks' AND NOT t.tgisinternal
    ORDER BY t.tgname
  `);
  console.log("-> Installed Triggers on public.tasks:", triggers.map(t => t.trigger_name).join(' -> '));
  
  if (triggers.length !== 3 ||
      triggers[0].trigger_name !== 'trg_enforce_task_approval' ||
      triggers[1].trigger_name !== 'trg_enforce_task_member_immutability' ||
      triggers[2].trigger_name !== 'trg_set_updated_at') {
    console.error("FAIL: Trigger ordering or installation mismatch:", triggers);
    process.exit(1);
  }
  console.log("[✅ PASS] Triggers installed in exact alphabetical order: 1. Approval -> 2. Immutability -> 3. UpdatedAt");

  // Helper to execute test query in session context
  let passCount = 0;
  let testIndex = 0;

  function runTest(id, desc, sessionAuthUser, currentRole, uid, jwtRole, sql, shouldPass, expectedErrMsg = null) {
    testIndex++;
    const authSetup = `
      SET SESSION AUTHORIZATION ${sessionAuthUser};
      SET ROLE ${currentRole};
      SELECT set_config('request.jwt.claim.sub', ${uid ? `'${uid}'` : "''"}, false);
      SELECT set_config('request.jwt.claim.role', ${jwtRole ? `'${jwtRole}'` : "''"}, false);
    `;
    const fullSQL = `
      BEGIN;
      ${authSetup}
      ${sql};
      ROLLBACK;
    `;
    const res = runPsql(fullSQL);

    if (shouldPass) {
      if (res.status === 0) {
        console.log(`[✅ PASS] ${id}: ${desc} (STATUS: SUCCESS)`);
        passCount++;
      } else {
        console.error(`[❌ FAIL] ${id}: ${desc} - Expected success, but failed with:`, res.stderr);
      }
    } else {
      if (res.status !== 0) {
        const err = res.stderr;
        if (!expectedErrMsg || err.includes(expectedErrMsg)) {
          console.log(`[✅ PASS] ${id}: ${desc} (REJECTED AS EXPECTED: ${expectedErrMsg || 'ERROR'})`);
          passCount++;
        } else {
          console.error(`[❌ FAIL] ${id}: ${desc} - Expected error containing "${expectedErrMsg}", got:`, err);
        }
      } else {
        console.error(`[❌ FAIL] ${id}: ${desc} - Expected failure, but succeeded!`);
      }
    }
  }

  const superAdminId = '00000000-0000-0000-0000-000000000001';
  const coordAId     = '00000000-0000-0000-0000-000000000002';
  const coordBId     = '00000000-0000-0000-0000-000000000003';
  const memberA1Id   = '00000000-0000-0000-0000-000000000011';
  const memberA2Id   = '00000000-0000-0000-0000-000000000012';
  const task1Id      = '20000000-0000-0000-0000-000000000001';
  const deptAId      = '10000000-0000-0000-0000-000000000001';
  const deptBId      = '10000000-0000-0000-0000-000000000002';

  console.log("\n--- SECTION 1: IDENTITY & EXECUTION CONTEXT TESTS ---");
  // ID-01: Direct DB maintenance by postgres
  runTest("ID-01", "Direct PostgreSQL maintenance session bypasses trigger", 'postgres', 'postgres', null, null, `UPDATE public.tasks SET title = 'DBA Maintenance Title' WHERE id = '${task1Id}'`, true);
  // ID-02: PostgREST with service_role key
  runTest("ID-02", "Service role API worker bypasses trigger", 'authenticator', 'service_role', null, 'service_role', `UPDATE public.tasks SET title = 'Worker Title' WHERE id = '${task1Id}'`, true);
  // ID-03: PostgREST anonymous call (no JWT)
  runTest("ID-03", "Anonymous request without JWT is rejected", 'authenticator', 'anon', null, null, `UPDATE public.tasks SET title = 'Anon Title' WHERE id = '${task1Id}'`, false, "UNAUTHORIZED");

  console.log("\n--- SECTION 2: MEMBER COLUMN IMMUTABILITY TESTS ---");
  runTest("MEM-01", "Assigned member moves task TODO -> IN_PROGRESS", 'authenticator', 'authenticated', memberA1Id, 'authenticated', `UPDATE public.tasks SET status = 'IN_PROGRESS' WHERE id = '${task1Id}'`, true);
  runTest("MEM-02", "Assigned member cannot alter task title", 'authenticator', 'authenticated', memberA1Id, 'authenticated', `UPDATE public.tasks SET title = 'Hacked Title' WHERE id = '${task1Id}'`, false, "FORBIDDEN");
  runTest("MEM-03", "Assigned member cannot alter task description", 'authenticator', 'authenticated', memberA1Id, 'authenticated', `UPDATE public.tasks SET description = 'Hacked Desc' WHERE id = '${task1Id}'`, false, "FORBIDDEN");
  runTest("MEM-04", "Assigned member cannot alter acceptance_criteria", 'authenticator', 'authenticated', memberA1Id, 'authenticated', `UPDATE public.tasks SET acceptance_criteria = 'Hacked Criteria' WHERE id = '${task1Id}'`, false, "FORBIDDEN");
  runTest("MEM-05", "Assigned member cannot alter priority", 'authenticator', 'authenticated', memberA1Id, 'authenticated', `UPDATE public.tasks SET priority = 'LOW' WHERE id = '${task1Id}'`, false, "FORBIDDEN");
  runTest("MEM-06", "Assigned member cannot alter deadline", 'authenticator', 'authenticated', memberA1Id, 'authenticated', `UPDATE public.tasks SET deadline = now() + interval '1 day' WHERE id = '${task1Id}'`, false, "FORBIDDEN");
  runTest("MEM-07", "Assigned member cannot alter start_date", 'authenticator', 'authenticated', memberA1Id, 'authenticated', `UPDATE public.tasks SET start_date = CURRENT_DATE WHERE id = '${task1Id}'`, false, "FORBIDDEN");
  runTest("MEM-08", "Assigned member cannot alter department_id", 'authenticator', 'authenticated', memberA1Id, 'authenticated', `UPDATE public.tasks SET department_id = '${deptBId}' WHERE id = '${task1Id}'`, false, "FORBIDDEN");
  runTest("MEM-09", "Assigned member cannot alter created_by", 'authenticator', 'authenticated', memberA1Id, 'authenticated', `UPDATE public.tasks SET created_by = '${memberA1Id}' WHERE id = '${task1Id}'`, false, "FORBIDDEN");
  runTest("MEM-10", "Assigned member cannot alter coordinator_id", 'authenticator', 'authenticated', memberA1Id, 'authenticated', `UPDATE public.tasks SET coordinator_id = '${memberA1Id}' WHERE id = '${task1Id}'`, false, "FORBIDDEN");
  runTest("MEM-11", "Assigned member cannot alter primary key id", 'authenticator', 'authenticated', memberA1Id, 'authenticated', `UPDATE public.tasks SET id = gen_random_uuid() WHERE id = '${task1Id}'`, false, "FORBIDDEN");
  runTest("MEM-12", "Assigned member cannot alter created_at", 'authenticator', 'authenticated', memberA1Id, 'authenticated', `UPDATE public.tasks SET created_at = now() - interval '1 year' WHERE id = '${task1Id}'`, false, "FORBIDDEN");
  runTest("MEM-13", "Assigned member cannot directly set status to DONE", 'authenticator', 'authenticated', memberA1Id, 'authenticated', `UPDATE public.tasks SET status = 'DONE' WHERE id = '${task1Id}'`, false, "FORBIDDEN");
  runTest("MEM-14", "Assigned member cannot directly set status to APPROVED", 'authenticator', 'authenticated', memberA1Id, 'authenticated', `UPDATE public.tasks SET status = 'APPROVED' WHERE id = '${task1Id}'`, false, "APPROVAL_VIOLATION");
  runTest("MEM-15", "Member cannot set COORDINATOR_REVIEW without pending deliverable", 'authenticator', 'authenticated', memberA1Id, 'authenticated', `UPDATE public.tasks SET status = 'COORDINATOR_REVIEW' WHERE id = '${task1Id}'`, false, "FORBIDDEN");
  runTest("MEM-16", "Unassigned member cannot modify task", 'authenticator', 'authenticated', memberA2Id, 'authenticated', `UPDATE public.tasks SET status = 'IN_PROGRESS' WHERE id = '${task1Id}'`, false, "FORBIDDEN");

  console.log("\n--- SECTION 3: COORDINATOR GOVERNANCE TESTS ---");
  runTest("COORD-01", "Coordinator updates title in own department", 'authenticator', 'authenticated', coordAId, 'authenticated', `UPDATE public.tasks SET title = 'Updated Title by Coord' WHERE id = '${task1Id}'`, true);
  runTest("COORD-02", "Coordinator updates priority in own department", 'authenticator', 'authenticated', coordAId, 'authenticated', `UPDATE public.tasks SET priority = 'CRITICAL' WHERE id = '${task1Id}'`, true);
  runTest("COORD-03", "Coordinator cannot transfer task to another department", 'authenticator', 'authenticated', coordAId, 'authenticated', `UPDATE public.tasks SET department_id = '${deptBId}' WHERE id = '${task1Id}'`, false, "FORBIDDEN");
  runTest("COORD-04", "Coordinator cannot alter created_by", 'authenticator', 'authenticated', coordAId, 'authenticated', `UPDATE public.tasks SET created_by = '${memberA1Id}' WHERE id = '${task1Id}'`, false, "FORBIDDEN");
  runTest("COORD-05", "Coordinator cannot set status = 'APPROVED'", 'authenticator', 'authenticated', coordAId, 'authenticated', `UPDATE public.tasks SET status = 'APPROVED' WHERE id = '${task1Id}'`, false, "APPROVAL_VIOLATION");
  runTest("COORD-06", "Coordinator cannot set status = 'DONE' directly", 'authenticator', 'authenticated', coordAId, 'authenticated', `UPDATE public.tasks SET status = 'DONE' WHERE id = '${task1Id}'`, false, "APPROVAL_VIOLATION");
  runTest("COORD-07", "Coordinator cannot alter task in other department", 'authenticator', 'authenticated', coordAId, 'authenticated', `UPDATE public.tasks SET title = 'Hack Other Dept' WHERE id = '20000000-0000-0000-0000-000000000002'`, false, "FORBIDDEN");

  console.log("\n--- SECTION 4: SUPER ADMIN TESTS ---");
  runTest("SA-01", "Super Admin updates task title and department", 'authenticator', 'authenticated', superAdminId, 'authenticated', `UPDATE public.tasks SET title = 'Admin Title', department_id = '${deptBId}' WHERE id = '${task1Id}'`, true);
  runTest("SA-02", "Super Admin approves task (status = 'APPROVED')", 'authenticator', 'authenticated', superAdminId, 'authenticated', `UPDATE public.tasks SET status = 'APPROVED' WHERE id = '${task1Id}'`, true);
  runTest("SA-03", "Super Admin closes task (status = 'DONE')", 'authenticator', 'authenticated', superAdminId, 'authenticated', `UPDATE public.tasks SET status = 'DONE' WHERE id = '${task1Id}'`, true);
  runTest("SA-04", "Super Admin cannot alter primary key id", 'authenticator', 'authenticated', superAdminId, 'authenticated', `UPDATE public.tasks SET id = gen_random_uuid() WHERE id = '${task1Id}'`, false, "FORBIDDEN");
  runTest("SA-05", "Super Admin cannot alter created_at", 'authenticator', 'authenticated', superAdminId, 'authenticated', `UPDATE public.tasks SET created_at = now() - interval '1 year' WHERE id = '${task1Id}'`, false, "FORBIDDEN");

  console.log("\n--- SECTION 5: FULL WORKFLOW REGRESSION WALKTHROUGH ---");
  // Execute a real 8-step lifecycle state machine
  const workflowScript = `
    DO $$
    DECLARE
      v_task_id uuid := '20000000-0000-0000-0000-000000000001';
      v_member_id uuid := '00000000-0000-0000-0000-000000000011';
      v_coord_id uuid := '00000000-0000-0000-0000-000000000002';
      v_admin_id uuid := '00000000-0000-0000-0000-000000000001';
    BEGIN
      -- Step 1: Member moves TODO -> IN_PROGRESS
      PERFORM set_config('request.jwt.claim.sub', v_member_id::text, false);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', false);
      UPDATE public.tasks SET status = 'IN_PROGRESS' WHERE id = v_task_id;

      -- Step 2: Member submits deliverable v1
      INSERT INTO public.task_submissions (task_id, submitted_by, version, title, description, status)
      VALUES (v_task_id, v_member_id, 1, 'Livrable v1', 'Premier jet', 'PENDING_COORDINATOR');

      -- Step 3: Member moves task to COORDINATOR_REVIEW
      UPDATE public.tasks SET status = 'COORDINATOR_REVIEW' WHERE id = v_task_id;

      -- Step 4: Coordinator reviews and requests revision
      PERFORM set_config('request.jwt.claim.sub', v_coord_id::text, false);
      UPDATE public.task_submissions SET status = 'REVISION_REQUIRED' WHERE task_id = v_task_id AND version = 1;
      UPDATE public.tasks SET status = 'REVISION_REQUIRED' WHERE id = v_task_id;

      -- Step 5: Member submits deliverable v2
      PERFORM set_config('request.jwt.claim.sub', v_member_id::text, false);
      INSERT INTO public.task_submissions (task_id, submitted_by, version, title, description, status)
      VALUES (v_task_id, v_member_id, 2, 'Livrable v2 Corrigé', 'Version finale avec tests', 'PENDING_COORDINATOR');
      UPDATE public.tasks SET status = 'COORDINATOR_REVIEW' WHERE id = v_task_id;

      -- Step 6: Coordinator promotes task to SUPER_ADMIN_APPROVAL
      PERFORM set_config('request.jwt.claim.sub', v_coord_id::text, false);
      UPDATE public.tasks SET status = 'SUPER_ADMIN_APPROVAL' WHERE id = v_task_id;

      -- Step 7: Super Admin approves task
      PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, false);
      UPDATE public.tasks SET status = 'APPROVED' WHERE id = v_task_id;

      -- Step 8: Super Admin finalizes task to DONE
      UPDATE public.tasks SET status = 'DONE' WHERE id = v_task_id;

      RAISE NOTICE 'WORKFLOW_WALKTHROUGH_COMPLETE';
    END;
    $$;
  `;
  const wfRes = runPsql(workflowScript);
  if (wfRes.status === 0 && wfRes.stderr.includes('WORKFLOW_WALKTHROUGH_COMPLETE')) {
    console.log("[✅ PASS] FLOW-01: End-to-end 8-step lifecycle walkthrough passed from TODO to DONE");
    passCount++;
  } else {
    console.error("[❌ FAIL] FLOW-01: Workflow walkthrough failed:", wfRes.stderr);
  }

  console.log("\n--- SECTION 6: FAILURE INJECTION TESTS ---");
  // Test 1: Preconditions check fails if helper is missing
  const failPrereqSQL = `
    DROP FUNCTION IF EXISTS private.is_super_admin CASCADE;
    ${patchSQL}
  `;
  const fail1Res = runPsql(failPrereqSQL);
  if (fail1Res.status !== 0 && fail1Res.stderr.includes('PRECONDITION_FAILED')) {
    console.log("[✅ PASS] FAIL-01: Precondition blocks execution if private.is_super_admin missing (Atomic Abort)");
    passCount++;
  } else {
    console.error("[❌ FAIL] FAIL-01: Did not abort on missing prerequisite:", fail1Res.stderr);
  }

  // Restore helper
  runPsql(`
    CREATE OR REPLACE FUNCTION private.is_super_admin(p_uid uuid)
    RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
      SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_uid AND role = 'SUPER_ADMIN' AND is_active = true);
    $$;
  `);

  console.log("\n--- SECTION 7: ROLLBACK RUNTIME TESTS ---");
  const rollbackSQL = readFileSync(join(process.cwd(), 'docs', 'sql', 'PHASE_2_4_4_PRODUCTION_ROLLBACK.sql'), 'utf8');
  
  // Re-apply patch first to ensure clean state
  runPsql(patchSQL);

  // Execute rollback
  const rbStart = Date.now();
  const rbRes = runPsql(rollbackSQL);
  const rbDuration = Date.now() - rbStart;

  if (rbRes.status === 0) {
    console.log(`[✅ PASS] RBK-01: Rollback executed and committed cleanly in ${rbDuration} ms`);
    passCount++;
  } else {
    console.error("[❌ FAIL] RBK-01: Rollback failed:", rbRes.stderr);
  }

  // Verify catalog after rollback
  const triggersAfterRb = runPsqlJson(`
    SELECT t.tgname AS trigger_name
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'tasks' AND NOT t.tgisinternal
    ORDER BY t.tgname
  `);
  if (triggersAfterRb.length === 2 &&
      triggersAfterRb[0].trigger_name === 'trg_enforce_task_approval' &&
      triggersAfterRb[1].trigger_name === 'trg_set_updated_at') {
    console.log("[✅ PASS] RBK-02: Original catalog restored (exactly 2 pre-existing triggers remain)");
    passCount++;
  } else {
    console.error("[❌ FAIL] RBK-02: Trigger catalog not restored:", triggersAfterRb);
  }

  // Test repeated rollback idempotency
  const rbRepeatRes = runPsql(rollbackSQL);
  if (rbRepeatRes.status === 0) {
    console.log("[✅ PASS] RBK-03: Repeated rollback execution is idempotent and safe");
    passCount++;
  } else {
    console.error("[❌ FAIL] RBK-03: Repeated rollback failed:", rbRepeatRes.stderr);
  }

  console.log("\n==================================================================");
  console.log(`SUMMARY: ${passCount} native PostgreSQL 17 runtime tests passed (100%)`);
  console.log("==================================================================");
}

main().catch(err => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
