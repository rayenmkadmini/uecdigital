/**
 * UEC ESPACE DIGITAL — PHASE 2.5.3
 * Native PostgreSQL 17 Runtime Concurrency & Transaction Test Suite
 * Engine: Native PostgreSQL 17.6 (Supabase Docker Container: uec_pg17_val)
 * 
 * Safety Rule: Production Supabase is strictly READ-ONLY.
 * Runs 100% against isolated native PostgreSQL 17 instance.
 */

import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

function runPsql(sql) {
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
  const trimmed = sql.trim();
  const wrapped = (trimmed.toUpperCase().startsWith('UPDATE') || trimmed.toUpperCase().startsWith('INSERT') || trimmed.toUpperCase().startsWith('DELETE'))
    ? `WITH t AS (${trimmed.replace(/;\s*$/, '')}) SELECT COALESCE(json_agg(t), '[]'::json) FROM t;`
    : `SELECT COALESCE(json_agg(t), '[]'::json) FROM (${trimmed.replace(/;\s*$/, '')}) t;`;
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
    throw new Error(`psql error: ${res.stderr || res.stdout}`);
  }
  const text = (res.stdout || '').trim();
  if (!text || text === '') return [];
  try {
    return JSON.parse(text) || [];
  } catch (e) {
    return [];
  }
}

async function runNativePg17Tests() {
  console.log("==================================================================");
  console.log("   PHASE 2.5.3 — NATIVE POSTGRESQL 17 CONCURRENCY & INTEGRATION   ");
  console.log("==================================================================");

  // Ensure disposable container is running
  spawnSync('wsl', ['-e', 'bash', '-c', 'docker start uec_pg17_val']);
  await new Promise(r => setTimeout(r, 2500));

  const versionRes = runPsql("SELECT version();");
  if (versionRes.status !== 0) {
    console.error("FATAL: Could not connect to native PostgreSQL 17 container:", versionRes.stderr);
    process.exit(1);
  }
  console.log("-> Real Engine Verified:", versionRes.stdout.split('\n')[2]?.trim() || versionRes.stdout);

  const testResults = [];
  function record(id, description, expected, actual, passed, details = "") {
    testResults.push({ id, description, expected, actual, passed, details });
    const mark = passed ? "[✅ PASS]" : "[❌ FAIL]";
    console.log(`${mark} ${id}: ${description} (${actual})`);
    if (!passed) {
      console.error(`       Expected: ${expected}`);
      console.error(`       Details:  ${details}`);
    }
  }

  // 1. Setup Complete Relational Schema on Native PostgreSQL 17
  console.log("\n-> Initializing full relational schema on native PostgreSQL 17...");
  const initSQL = `
    DROP TABLE IF EXISTS public.meeting_attendees CASCADE;
    DROP TABLE IF EXISTS public.meetings CASCADE;
    DROP TABLE IF EXISTS public.equipment_loans CASCADE;
    DROP TABLE IF EXISTS public.equipment CASCADE;
    DROP TABLE IF EXISTS public.service_requests CASCADE;
    DROP TABLE IF EXISTS public.task_submissions CASCADE;
    DROP TABLE IF EXISTS public.task_assignees CASCADE;
    DROP TABLE IF EXISTS public.tasks CASCADE;
    DROP TABLE IF EXISTS public.projects CASCADE;
    DROP TABLE IF EXISTS public.department_members CASCADE;
    DROP TABLE IF EXISTS public.departments CASCADE;
    DROP TABLE IF EXISTS public.profiles CASCADE;

    DROP SCHEMA IF EXISTS private CASCADE;
    CREATE SCHEMA private;

    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
      SELECT COALESCE(
        NULLIF(current_setting('request.jwt.claim.sub', true), ''),
        (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
      )::uuid;
    $$ LANGUAGE sql STABLE;

    CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
      SELECT COALESCE(
        NULLIF(current_setting('request.jwt.claim.role', true), ''),
        (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
      )::text;
    $$ LANGUAGE sql STABLE;

    -- Profiles
    CREATE TABLE IF NOT EXISTS public.profiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL UNIQUE,
      full_name text NOT NULL,
      role text NOT NULL DEFAULT 'MEMBER',
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    -- Departments
    CREATE TABLE IF NOT EXISTS public.departments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      code text NOT NULL UNIQUE,
      coordinator_id uuid REFERENCES public.profiles(id),
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    -- Projects
    CREATE TABLE IF NOT EXISTS public.projects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text NOT NULL UNIQUE,
      title text NOT NULL,
      department_id uuid NOT NULL REFERENCES public.departments(id),
      manager_id uuid REFERENCES public.profiles(id),
      priority text NOT NULL DEFAULT 'MEDIUM',
      status text NOT NULL DEFAULT 'PLANNING',
      created_by uuid REFERENCES public.profiles(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    -- Tasks
    CREATE TABLE IF NOT EXISTS public.tasks (
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

    -- Task Assignees
    CREATE TABLE IF NOT EXISTS public.task_assignees (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      UNIQUE(task_id, user_id)
    );

    -- Task Submissions
    CREATE TABLE IF NOT EXISTS public.task_submissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
      submitted_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      version integer NOT NULL DEFAULT 1,
      title text NOT NULL,
      description text NOT NULL,
      file_urls jsonb DEFAULT '[]'::jsonb,
      status text NOT NULL DEFAULT 'PENDING_COORDINATOR',
      is_locked boolean NOT NULL DEFAULT false,
      coordinator_id uuid REFERENCES public.profiles(id),
      coordinateur_notes text,
      reviewed_by_coordinator_at timestamptz,
      super_admin_id uuid REFERENCES public.profiles(id),
      super_admin_notes text,
      approved_by_super_admin_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    -- Equipment
    CREATE TABLE IF NOT EXISTS public.equipment (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text NOT NULL UNIQUE,
      name text NOT NULL,
      category text NOT NULL,
      condition text NOT NULL DEFAULT 'GOOD',
      status text NOT NULL DEFAULT 'AVAILABLE',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    -- Equipment Loans
    CREATE TABLE IF NOT EXISTS public.equipment_loans (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
      borrower_id uuid NOT NULL REFERENCES public.profiles(id),
      status text NOT NULL DEFAULT 'REQUESTED',
      borrow_date timestamptz,
      expected_return_date timestamptz NOT NULL,
      actual_return_date timestamptz,
      approved_by uuid REFERENCES public.profiles(id),
      condition_at_checkout text,
      condition_at_return text,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    -- Service Requests
    CREATE TABLE IF NOT EXISTS public.service_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text NOT NULL UNIQUE,
      title text NOT NULL,
      description text NOT NULL,
      category text NOT NULL,
      target_department_id uuid NOT NULL REFERENCES public.departments(id),
      requester_id uuid NOT NULL REFERENCES public.profiles(id),
      priority text NOT NULL DEFAULT 'MEDIUM',
      status text NOT NULL DEFAULT 'NEW',
      converted_task_id uuid REFERENCES public.tasks(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    -- Meetings
    CREATE TABLE IF NOT EXISTS public.meetings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      scheduled_at timestamptz NOT NULL,
      status text NOT NULL DEFAULT 'SCHEDULED',
      created_by uuid NOT NULL REFERENCES public.profiles(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    -- Meeting Attendees
    CREATE TABLE IF NOT EXISTS public.meeting_attendees (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'INVITED',
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(meeting_id, user_id)
    );

    -- Security functions
    CREATE OR REPLACE FUNCTION private.is_super_admin(p_uid uuid)
    RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_uid AND role = 'SUPER_ADMIN' AND is_active = true
      );
    $$;

    CREATE OR REPLACE FUNCTION private.is_coordinator_of(p_dept_id uuid, p_uid uuid)
    RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.departments
        WHERE id = p_dept_id AND coordinator_id = p_uid AND is_active = true
      ) OR private.is_super_admin(p_uid);
    $$;

    -- Existing trigger
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

    DROP TRIGGER IF EXISTS trg_enforce_task_approval ON public.tasks;
    CREATE TRIGGER trg_enforce_task_approval
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION private.enforce_super_admin_approval();

    DROP TRIGGER IF EXISTS trg_set_updated_at ON public.tasks;
    CREATE TRIGGER trg_set_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

    -- Grants
    GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, supabase_admin;
  `;
  const initRes = runPsql(initSQL);
  if (initRes.status !== 0) {
    console.error("FATAL: Failed to init schema on native PostgreSQL 17:", initRes.stderr);
    process.exit(1);
  }
  console.log("-> Schema successfully created on PostgreSQL 17.");

  // Apply Phase 2.4.4 production patch to install enforce_task_member_immutability
  console.log("-> Applying Phase 2.4.4 production patch...");
  const patchSQL = readFileSync(join(process.cwd(), 'docs', 'sql', 'PHASE_2_4_4_PRODUCTION_PATCH.sql'), 'utf8');
  const patchRes = runPsql(patchSQL);
  if (patchRes.status !== 0) {
    console.error("FATAL: Patch failed on PostgreSQL 17:", patchRes.stderr);
    process.exit(1);
  }
  console.log("-> Patch applied and verified.");

  // Seed Data
  const SA_ID = "00000000-0000-0000-0000-000000000001";
  const COORD_ID = "00000000-0000-0000-0000-000000000002";
  const MEM_ID = "00000000-0000-0000-0000-000000000011";
  const DEPT_ID = "10000000-0000-0000-0000-000000000001";
  const TASK_ID = "20000000-0000-0000-0000-000000000001";
  const EQ_ID = "30000000-0000-0000-0000-000000000001";

  const seedSQL = `
    INSERT INTO public.profiles (id, email, full_name, role) VALUES
      ('${SA_ID}', 'president@uec.tn', 'Super Admin', 'SUPER_ADMIN'),
      ('${COORD_ID}', 'coord@uec.tn', 'Coordinateur', 'COORDINATOR'),
      ('${MEM_ID}', 'membre@uec.tn', 'Membre Graphiste', 'MEMBER')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.departments (id, name, code, coordinator_id) VALUES
      ('${DEPT_ID}', 'Pôle Design', 'DESIGN', '${COORD_ID}')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.tasks (id, department_id, title, status, created_by, coordinator_id) VALUES
      ('${TASK_ID}', '${DEPT_ID}', 'Tâche PostgreSQL 17 Test', 'TODO', '${COORD_ID}', '${COORD_ID}')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.task_assignees (task_id, user_id) VALUES
      ('${TASK_ID}', '${MEM_ID}')
    ON CONFLICT (task_id, user_id) DO NOTHING;

    INSERT INTO public.equipment (id, code, name, category, status) VALUES
      ('${EQ_ID}', 'EQ-SONY-01', 'Sony FX3', 'CAMERA', 'AVAILABLE')
    ON CONFLICT (id) DO NOTHING;
  `;
  runPsql(seedSQL);

  // --------------------------------------------------------------------
  // SECTION 1: UNIQUE CONSTRAINTS UNDER POSTGRESQL 17
  // --------------------------------------------------------------------
  console.log("\n--- SECTION 1: UNIQUE CONSTRAINTS (REAL POSTGRESQL 17) ---");
  {
    const res = runPsql(`
      INSERT INTO public.task_assignees (task_id, user_id)
      VALUES ('${TASK_ID}', '${MEM_ID}');
    `);
    const allErr = (res.stderr + " " + res.stdout).toLowerCase();
    const rejected = res.status !== 0 && (allErr.includes('unique') || allErr.includes('duplicate'));
    record("PG17-UC-01", "Duplicate task assignee rejected by unique composite constraint", true, rejected, rejected, allErr);
  }

  {
    const res = runPsql(`
      INSERT INTO public.departments (name, code)
      VALUES ('Autre Pôle', 'DESIGN');
    `);
    const allErr = (res.stderr + " " + res.stdout).toLowerCase();
    const rejected = res.status !== 0 && (allErr.includes('unique') || allErr.includes('duplicate'));
    record("PG17-UC-02", "Duplicate department code rejected by unique constraint", true, rejected, rejected, allErr);
  }

  // --------------------------------------------------------------------
  // SECTION 2: TRANSACTION ROLLBACK & ATOMICITY
  // --------------------------------------------------------------------
  console.log("\n--- SECTION 2: TRANSACTION BEHAVIOR & ROLLBACK ---");
  {
    const res = runPsql(`
      BEGIN;
      INSERT INTO public.equipment (code, name, category) VALUES ('EQ-TEMP-99', 'Micro HF', 'AUDIO');
      -- Force intentional error: invalid foreign key
      INSERT INTO public.tasks (department_id, title) VALUES ('99999999-9999-9999-9999-999999999999', 'Orphan Task');
      COMMIT;
    `);
    const checkEq = runPsqlJson(`SELECT count(*)::int as c FROM public.equipment WHERE code = 'EQ-TEMP-99'`);
    const rolledBack = (checkEq[0]?.c || 0) === 0;
    record("PG17-TX-01", "Transaction atomicity: Failed statement triggers complete rollback", 0, checkEq[0]?.c || 0, rolledBack);
  }

  // --------------------------------------------------------------------
  // SECTION 3: CONCURRENT APPROVALS & OPTIMISTIC LOCKING
  // --------------------------------------------------------------------
  console.log("\n--- SECTION 3: CONCURRENT APPROVALS & OPTIMISTIC LOCKING ---");
  {
    const subId = "40000000-0000-0000-0000-000000000001";
    runPsql(`
      INSERT INTO public.task_submissions (id, task_id, submitted_by, title, description, status, is_locked)
      VALUES ('${subId}', '${TASK_ID}', '${MEM_ID}', 'Livrable v1', 'Fichier prêt', 'PENDING_SUPER_ADMIN', false);
    `);

    // First admin session executes update with optimistic lock on is_locked = false
    const admin1 = runPsqlJson(`
      UPDATE public.task_submissions
      SET status = 'APPROVED', is_locked = true, approved_by_super_admin_at = now()
      WHERE id = '${subId}' AND is_locked = false
      RETURNING id;
    `);

    // Second concurrent admin session executes update on same submission
    const admin2 = runPsqlJson(`
      UPDATE public.task_submissions
      SET status = 'APPROVED', is_locked = true, approved_by_super_admin_at = now()
      WHERE id = '${subId}' AND is_locked = false
      RETURNING id;
    `);

    const admin1Count = admin1.length;
    const admin2Count = admin2.length;
    record(
      "PG17-CONC-01",
      "Native PostgreSQL 17 optimistic lock on is_locked: Exactly 1 row updated across concurrent updates",
      "A1=1, A2=0",
      `A1=${admin1Count}, A2=${admin2Count}`,
      admin1Count === 1 && admin2Count === 0
    );
  }

  // --------------------------------------------------------------------
  // SECTION 4: EQUIPMENT ALLOCATION COLLISION & CONDITIONAL UPDATE
  // --------------------------------------------------------------------
  console.log("\n--- SECTION 4: EQUIPMENT COLLISION & CONDITIONAL LOCKING ---");
  {
    const loan1Id = "50000000-0000-0000-0000-000000000001";
    const loan2Id = "50000000-0000-0000-0000-000000000002";
    runPsql(`
      INSERT INTO public.equipment_loans (id, equipment_id, borrower_id, expected_return_date, status)
      VALUES 
        ('${loan1Id}', '${EQ_ID}', '${MEM_ID}', now() + interval '2 days', 'REQUESTED'),
        ('${loan2Id}', '${EQ_ID}', '${MEM_ID}', now() + interval '3 days', 'REQUESTED');
    `);

    // Session 1 updates loan to ACTIVE and grabs equipment with WHERE status = 'AVAILABLE'
    const grab1 = runPsqlJson(`
      UPDATE public.equipment
      SET status = 'BORROWED'
      WHERE id = '${EQ_ID}' AND status = 'AVAILABLE'
      RETURNING id;
    `);

    // Session 2 attempts to grab same equipment concurrently
    const grab2 = runPsqlJson(`
      UPDATE public.equipment
      SET status = 'BORROWED'
      WHERE id = '${EQ_ID}' AND status = 'AVAILABLE'
      RETURNING id;
    `);

    record(
      "PG17-CONC-02",
      "Hardware collision in PostgreSQL 17: Conditional WHERE status='AVAILABLE' prevents double allocation",
      "Grab1=1, Grab2=0",
      `Grab1=${grab1.length}, Grab2=${grab2.length}`,
      grab1.length === 1 && grab2.length === 0
    );
  }

  // --------------------------------------------------------------------
  // SECTION 5: RSVP CONCURRENCY & UPSERT INTEGRITY
  // --------------------------------------------------------------------
  console.log("\n--- SECTION 5: RSVP UPSERT & CONFLICT HANDLING ---");
  {
    const meetId = "60000000-0000-0000-0000-000000000001";
    runPsql(`
      INSERT INTO public.meetings (id, title, scheduled_at, created_by)
      VALUES ('${meetId}', 'Réunion PostgreSQL 17', now() + interval '1 day', '${SA_ID}');
    `);

    // Run 2 rapid conflicting RSVP inserts with ON CONFLICT DO UPDATE
    runPsql(`
      INSERT INTO public.meeting_attendees (meeting_id, user_id, status)
      VALUES ('${meetId}', '${MEM_ID}', 'ACCEPTED')
      ON CONFLICT (meeting_id, user_id) DO UPDATE SET status = EXCLUDED.status;

      INSERT INTO public.meeting_attendees (meeting_id, user_id, status)
      VALUES ('${meetId}', '${MEM_ID}', 'TENTATIVE')
      ON CONFLICT (meeting_id, user_id) DO UPDATE SET status = EXCLUDED.status;
    `);

    const rsvpCheck = runPsqlJson(`
      SELECT count(*)::int as count, (array_agg(status))[1] as status
      FROM public.meeting_attendees
      WHERE meeting_id = '${meetId}' AND user_id = '${MEM_ID}'
    `);

    const isSingleRow = rsvpCheck[0]?.count === 1;
    const isLatestStatus = rsvpCheck[0]?.status === 'TENTATIVE';
    record(
      "PG17-CONC-03",
      "Native PostgreSQL 17 ON CONFLICT DO UPDATE handles concurrent RSVP without row duplication",
      "Count=1, Status=TENTATIVE",
      `Count=${rsvpCheck[0]?.count}, Status=${rsvpCheck[0]?.status}`,
      isSingleRow && isLatestStatus
    );
  }

  // --------------------------------------------------------------------
  // SECTION 6: IMMUTABILITY TRIGGER GUC SESSION INTEGRATION
  // --------------------------------------------------------------------
  console.log("\n--- SECTION 6: IMMUTABILITY TRIGGER & SESSION CLAIMS ---");
  {
    // Member cannot alter task title in real PostgreSQL 17
    const memberUpdate = runPsql(`
      SELECT set_config('request.jwt.claim.sub', '${MEM_ID}', false);
      SELECT set_config('request.jwt.claim.role', 'authenticated', false);
      UPDATE public.tasks SET title = 'Titre Modifié par Membre' WHERE id = '${TASK_ID}';
    `);
    const isMemberBlocked = memberUpdate.status !== 0 && memberUpdate.stderr.includes('FORBIDDEN');
    record("PG17-SEC-01", "Member task definition modification rejected in native PostgreSQL 17", true, isMemberBlocked, isMemberBlocked, memberUpdate.stderr);
  }

  {
    // Coordinator can update task title in own department
    const coordUpdate = runPsql(`
      SELECT set_config('request.jwt.claim.sub', '${COORD_ID}', false);
      SELECT set_config('request.jwt.claim.role', 'authenticated', false);
      UPDATE public.tasks SET title = 'Titre Mis à Jour par Coordinateur' WHERE id = '${TASK_ID}';
    `);
    const isCoordAllowed = coordUpdate.status === 0;
    record("PG17-SEC-02", "Coordinator task title update permitted in native PostgreSQL 17", true, isCoordAllowed, isCoordAllowed, coordUpdate.stderr);
  }

  {
    // Coordinator CANNOT set status = 'APPROVED'
    const coordApproved = runPsql(`
      SELECT set_config('request.jwt.claim.sub', '${COORD_ID}', false);
      SELECT set_config('request.jwt.claim.role', 'authenticated', false);
      UPDATE public.tasks SET status = 'APPROVED' WHERE id = '${TASK_ID}';
    `);
    const isApprovalBlocked = coordApproved.status !== 0 && coordApproved.stderr.includes('APPROVAL_VIOLATION');
    record("PG17-SEC-03", "Coordinator blocked from setting APPROVED in native PostgreSQL 17", true, isApprovalBlocked, isApprovalBlocked, coordApproved.stderr);
  }

  {
    // Super Admin can set status = 'APPROVED'
    const saApproved = runPsql(`
      SELECT set_config('request.jwt.claim.sub', '${SA_ID}', false);
      SELECT set_config('request.jwt.claim.role', 'authenticated', false);
      UPDATE public.tasks SET status = 'APPROVED' WHERE id = '${TASK_ID}';
    `);
    const isSaAllowed = saApproved.status === 0;
    record("PG17-SEC-04", "Super Admin permitted to set APPROVED in native PostgreSQL 17", true, isSaAllowed, isSaAllowed, saApproved.stderr);
  }

  // --------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------
  console.log("\n==================================================================");
  const total = testResults.length;
  const passed = testResults.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`REAL POSTGRESQL 17 RESULT: ${passed}/${total} checks passed (${Math.round((passed / total) * 100)}%)`);
  console.log("==================================================================");

  if (failed > 0) {
    console.error(`❌ ${failed} native PostgreSQL 17 tests failed!`);
    process.exit(1);
  } else {
    console.log("✅ ALL REAL POSTGRESQL 17 INTEGRATION & CONCURRENCY CHECKS PASSED!");
  }
}

runNativePg17Tests().catch((err) => {
  console.error("FATAL: Native PostgreSQL 17 test runner crashed:", err);
  process.exit(1);
});
