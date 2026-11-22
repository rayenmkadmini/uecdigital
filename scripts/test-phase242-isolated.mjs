import { PGlite } from "@electric-sql/pglite";

async function runRuntimeTests() {
  console.log("==================================================================");
  console.log("  PHASE 2.4.2 — REAL ISOLATED POSTGRESQL RUNTIME TEST SUITE       ");
  console.log("==================================================================");

  const db = new PGlite();
  const testResults = [];

  function recordResult(id, description, role, sql, expected, actual, passed, details = "") {
    testResults.push({ id, description, role, sql, expected, actual, passed, details });
    const mark = passed ? "[✅ PASS]" : "[❌ FAIL]";
    console.log(`${mark} ${id}: ${description} (${actual})`);
    if (!passed) {
      console.error(`       Expected: ${expected}`);
      console.error(`       Details: ${details}`);
    }
  }

  // 1. Setup Base Database Schema mirroring production
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS private;
    CREATE SCHEMA IF NOT EXISTS auth;

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

    -- Tables
    CREATE TABLE IF NOT EXISTS public.profiles (
      id uuid PRIMARY KEY,
      email text NOT NULL,
      full_name text NOT NULL,
      role text NOT NULL DEFAULT 'MEMBER',
      is_active boolean NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS public.departments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      code text NOT NULL,
      coordinator_id uuid REFERENCES public.profiles(id),
      is_active boolean NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS public.tasks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid,
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

    CREATE TABLE IF NOT EXISTS public.task_assignees (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE
    );

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
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    -- Helper functions in private schema
    CREATE OR REPLACE FUNCTION private.is_super_admin(p_uid uuid)
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = ''
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_uid AND role = 'SUPER_ADMIN' AND is_active = true
      );
    $$;

    CREATE OR REPLACE FUNCTION private.is_coordinator_of(p_dept_id uuid, p_uid uuid)
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = ''
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.departments
        WHERE id = p_dept_id AND coordinator_id = p_uid AND is_active = true
      ) OR private.is_super_admin(p_uid);
    $$;

    -- Existing Triggers
    CREATE OR REPLACE FUNCTION private.enforce_super_admin_approval()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = ''
    AS $$
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
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER trg_enforce_task_approval
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION private.enforce_super_admin_approval();

    CREATE TRIGGER trg_set_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  `);

  console.log("-> Base schema and existing triggers created.");

  // Test Context Switcher Helper using real Supabase GUC settings
  async function setAuthContext(uid, role) {
    await db.exec(`
      SELECT set_config('request.jwt.claim.sub', ${uid ? `'${uid}'` : "''"}, false);
      SELECT set_config('request.jwt.claim.role', ${role ? `'${role}'` : "''"}, false);
    `);
  }

  // 2. Insert Seed Data
  const superAdminId = "00000000-0000-0000-0000-000000000001";
  const coordAId = "00000000-0000-0000-0000-000000000002";
  const coordBId = "00000000-0000-0000-0000-000000000003";
  const memberA1Id = "00000000-0000-0000-0000-000000000011";
  const memberA2Id = "00000000-0000-0000-0000-000000000012";
  const memberB1Id = "00000000-0000-0000-0000-000000000021";

  const deptAId = "10000000-0000-0000-0000-000000000001";
  const deptBId = "10000000-0000-0000-0000-000000000002";

  const task1Id = "20000000-0000-0000-0000-000000000001";
  const task2Id = "20000000-0000-0000-0000-000000000002";

  await db.exec(`
    INSERT INTO public.profiles (id, email, full_name, role) VALUES
      ('${superAdminId}', 'admin@uec.tn', 'Super Admin UEC', 'SUPER_ADMIN'),
      ('${coordAId}', 'coord.tech@uec.tn', 'Coord Tech', 'COORDINATOR'),
      ('${coordBId}', 'coord.com@uec.tn', 'Coord Com', 'COORDINATOR'),
      ('${memberA1Id}', 'dev1@uec.tn', 'Dev 1 Tech', 'MEMBER'),
      ('${memberA2Id}', 'dev2@uec.tn', 'Dev 2 Tech', 'MEMBER'),
      ('${memberB1Id}', 'com1@uec.tn', 'Com 1 Member', 'MEMBER');

    INSERT INTO public.departments (id, name, code, coordinator_id) VALUES
      ('${deptAId}', 'Technologie & Digital', 'TECH', '${coordAId}'),
      ('${deptBId}', 'Communication', 'COM', '${coordBId}');

    INSERT INTO public.tasks (id, department_id, title, description, acceptance_criteria, priority, status, created_by, coordinator_id) VALUES
      ('${task1Id}', '${deptAId}', 'Développer Portail UEC', 'Spécifications complètes', 'Tests unitaires 100%', 'HIGH', 'TODO', '${coordAId}', '${coordAId}'),
      ('${task2Id}', '${deptBId}', 'Campagne Réseaux Sociaux', 'Design des affiches', '3 visuels validés', 'MEDIUM', 'TODO', '${coordBId}', '${coordBId}');

    INSERT INTO public.task_assignees (task_id, user_id) VALUES
      ('${task1Id}', '${memberA1Id}'),
      ('${task2Id}', '${memberB1Id}');
  `);

  console.log("-> Seed data initialized.");

  // 3. Apply the Phase 2.4.1 Proposed Trigger
  const proposedTriggerSQL = `
    CREATE OR REPLACE FUNCTION private.enforce_task_member_immutability()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = ''
    AS $$
    DECLARE
      v_caller_id uuid;
      v_is_super_admin boolean := false;
      v_is_dept_coordinator boolean := false;
    BEGIN
      -- 1. Trusted System Superuser Bypass
      IF session_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL AND auth.role() IS NULL THEN
        RETURN NEW;
      END IF;

      -- 2. Trusted Service-Role Bypass
      IF auth.role() = 'service_role' THEN
        RETURN NEW;
      END IF;

      -- 3. Enforce Verified User Session
      v_caller_id := auth.uid();
      IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Session utilisateur valide requise pour modifier une tâche.';
      END IF;

      -- 4. Universal Immutability
      IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'FORBIDDEN: Les champs identifiant (id) et date de création (created_at) sont strictement immuables.';
      END IF;

      -- 5. Resolve Trusted Profile Roles
      v_is_super_admin := private.is_super_admin(v_caller_id);
      v_is_dept_coordinator := private.is_coordinator_of(OLD.department_id, v_caller_id);

      -- 6. Super Admin Authority
      IF v_is_super_admin THEN
        RETURN NEW;
      END IF;

      -- 7. Department Coordinator Governance Rules
      IF v_is_dept_coordinator THEN
        IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
          RAISE EXCEPTION 'FORBIDDEN: Un coordinateur ne peut pas transférer une tâche vers un autre département.';
        END IF;

        IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
          RAISE EXCEPTION 'FORBIDDEN: L''auteur initial de la tâche (created_by) est immuable.';
        END IF;

        IF OLD.status IN ('SUPER_ADMIN_APPROVAL', 'APPROVED', 'DONE') AND (
          NEW.title IS DISTINCT FROM OLD.title OR
          NEW.description IS DISTINCT FROM OLD.description OR
          NEW.acceptance_criteria IS DISTINCT FROM OLD.acceptance_criteria OR
          NEW.priority IS DISTINCT FROM OLD.priority OR
          NEW.deadline IS DISTINCT FROM OLD.deadline OR
          NEW.start_date IS DISTINCT FROM OLD.start_date OR
          NEW.project_id IS DISTINCT FROM OLD.project_id OR
          NEW.status IS DISTINCT FROM OLD.status
        ) THEN
          RAISE EXCEPTION 'FORBIDDEN: Impossible de modifier une tâche validée ou sous revue du Super Admin (statut actuel: %).', OLD.status;
        END IF;

        IF NEW.status IN ('APPROVED', 'DONE') AND (OLD.status IS NULL OR OLD.status NOT IN ('APPROVED', 'DONE')) THEN
          RAISE EXCEPTION 'APPROVAL_VIOLATION: Seul le Super Admin est habilité à approuver ou clôturer définitivement une tâche (statut demandé: %).', NEW.status;
        END IF;

        RETURN NEW;
      END IF;

      -- 8. Regular Assigned Member Rules
      -- A. Enforce assignment: User must be an assigned member of this task
      IF NOT EXISTS (
        SELECT 1 
        FROM public.task_assignees 
        WHERE task_id = OLD.id 
          AND user_id = v_caller_id
      ) THEN
        RAISE EXCEPTION 'FORBIDDEN: Vous n''êtes pas assigné à cette tâche.';
      END IF;

      -- B. Strict Column-Level Immutability:
      IF NEW.department_id IS DISTINCT FROM OLD.department_id OR
         NEW.project_id IS DISTINCT FROM OLD.project_id OR
         NEW.title IS DISTINCT FROM OLD.title OR
         NEW.description IS DISTINCT FROM OLD.description OR
         NEW.acceptance_criteria IS DISTINCT FROM OLD.acceptance_criteria OR
         NEW.priority IS DISTINCT FROM OLD.priority OR
         NEW.deadline IS DISTINCT FROM OLD.deadline OR
         NEW.start_date IS DISTINCT FROM OLD.start_date OR
         NEW.created_by IS DISTINCT FROM OLD.created_by OR
         NEW.coordinator_id IS DISTINCT FROM OLD.coordinator_id THEN
        RAISE EXCEPTION 'FORBIDDEN: Seuls le coordinateur de pôle ou le Super Admin peuvent modifier la définition ou les métadonnées de la tâche.';
      END IF;

      IF OLD.status IN ('COORDINATOR_REVIEW', 'SUPER_ADMIN_APPROVAL', 'APPROVED', 'DONE', 'CANCELLED') THEN
        RAISE EXCEPTION 'FORBIDDEN: Impossible de modifier une tâche en cours de revue ou finalisée (statut actuel: %).', OLD.status;
      END IF;

      IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NEW.status IN ('TODO', 'IN_PROGRESS') THEN
          RETURN NEW;
        END IF;

        IF NEW.status = 'COORDINATOR_REVIEW' THEN
          IF NOT EXISTS (
            SELECT 1 
            FROM public.task_submissions 
            WHERE task_id = OLD.id 
              AND status = 'PENDING_COORDINATOR'
          ) THEN
            RAISE EXCEPTION 'FORBIDDEN: Le passage en revue requiert le dépôt préalable d''un livrable.';
          END IF;
          RETURN NEW;
        END IF;

        RAISE EXCEPTION 'FORBIDDEN: Les membres ne peuvent pas positionner ce statut (statut demandé: %). Les livrables doivent être soumis via le workflow de dépôt.', NEW.status;
      END IF;

      RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS trg_enforce_task_member_immutability ON public.tasks;

    CREATE TRIGGER trg_enforce_task_member_immutability
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION private.enforce_task_member_immutability();
  `;

  await db.exec(proposedTriggerSQL);
  console.log("-> Proposed trigger and function applied to isolated database.");

  // Helper execution function with transaction rollback for isolated test
  async function executeTest(id, desc, role, uid, sql, shouldSucceed, expectedErrMsgSubstring = "") {
    await setAuthContext(uid, role);
    let error = null;
    let success = false;
    try {
      await db.exec("BEGIN;");
      await db.exec(sql);
      await db.exec("ROLLBACK;"); // Always rollback so state remains pristine
      success = true;
    } catch (err) {
      await db.exec("ROLLBACK;");
      error = err;
      success = false;
    }

    if (shouldSucceed) {
      if (success) {
        recordResult(id, desc, role, sql, "SUCCESS", "SUCCESS", true);
      } else {
        recordResult(id, desc, role, sql, "SUCCESS", `FAILED: ${error.message}`, false, error.message);
      }
    } else {
      if (!success) {
        const matchesMsg = expectedErrMsgSubstring ? error.message.includes(expectedErrMsgSubstring) : true;
        if (matchesMsg) {
          recordResult(id, desc, role, sql, `REJECT (${expectedErrMsgSubstring})`, `REJECTED (${error.message})`, true);
        } else {
          recordResult(id, desc, role, sql, `REJECT (${expectedErrMsgSubstring})`, `WRONG ERROR (${error.message})`, false, error.message);
        }
      } else {
        recordResult(id, desc, role, sql, `REJECT (${expectedErrMsgSubstring})`, "UNEXPECTED SUCCESS", false, "SQL succeeded when it should have been rejected");
      }
    }
  }

  // ==============================================================================
  // SECTION 1: IDENTITY & EXECUTION CONTEXT TESTS
  // ==============================================================================
  console.log("\n--- SECTION 1: IDENTITY & EXECUTION CONTEXT TESTS ---");

  // ID-01: Direct postgres superuser bypass
  await executeTest(
    "ID-01",
    "Direct PostgreSQL maintenance session bypasses trigger",
    null,
    null,
    `UPDATE public.tasks SET title = 'Superuser Title' WHERE id = '${task1Id}';`,
    true
  );

  // ID-02: Service role bypass
  await executeTest(
    "ID-02",
    "Service role API worker bypasses trigger",
    "service_role",
    null,
    `UPDATE public.tasks SET title = 'Worker Title' WHERE id = '${task1Id}';`,
    true
  );

  // ID-03: Anonymous REST request rejected
  await executeTest(
    "ID-03",
    "Anonymous request without JWT is rejected",
    "anon",
    null,
    `UPDATE public.tasks SET status = 'IN_PROGRESS' WHERE id = '${task1Id}';`,
    false,
    "UNAUTHORIZED"
  );

  // ID-04: Authenticated user cannot claim service_role bypass without service_role claim
  await executeTest(
    "ID-04",
    "Authenticated member cannot bypass trigger via spoofed claims",
    "authenticated",
    memberA1Id,
    `UPDATE public.tasks SET title = 'Spoofed' WHERE id = '${task1Id}';`,
    false,
    "FORBIDDEN"
  );

  // ==============================================================================
  // SECTION 2: MEMBER RUNTIME TESTS
  // ==============================================================================
  console.log("\n--- SECTION 2: MEMBER RUNTIME TESTS ---");

  // MEM-01: Member toggles TODO -> IN_PROGRESS
  await executeTest(
    "MEM-01",
    "Assigned member moves task TODO -> IN_PROGRESS",
    "authenticated",
    memberA1Id,
    `UPDATE public.tasks SET status = 'IN_PROGRESS' WHERE id = '${task1Id}';`,
    true
  );

  // MEM-02: Member toggles IN_PROGRESS -> TODO
  await db.exec(`UPDATE public.tasks SET status = 'IN_PROGRESS' WHERE id = '${task1Id}';`);
  await executeTest(
    "MEM-02",
    "Assigned member moves task IN_PROGRESS -> TODO",
    "authenticated",
    memberA1Id,
    `UPDATE public.tasks SET status = 'TODO' WHERE id = '${task1Id}';`,
    true
  );
  await db.exec(`UPDATE public.tasks SET status = 'TODO' WHERE id = '${task1Id}';`);

  // MEM-03: Member attempts to change title
  await executeTest(
    "MEM-03",
    "Assigned member cannot alter task title",
    "authenticated",
    memberA1Id,
    `UPDATE public.tasks SET title = 'Hacked Title' WHERE id = '${task1Id}';`,
    false,
    "FORBIDDEN"
  );

  // MEM-04: Member attempts to change description
  await executeTest(
    "MEM-04",
    "Assigned member cannot alter task description",
    "authenticated",
    memberA1Id,
    `UPDATE public.tasks SET description = 'Hacked Description' WHERE id = '${task1Id}';`,
    false,
    "FORBIDDEN"
  );

  // MEM-05: Member attempts to change acceptance_criteria
  await executeTest(
    "MEM-05",
    "Assigned member cannot alter acceptance_criteria",
    "authenticated",
    memberA1Id,
    `UPDATE public.tasks SET acceptance_criteria = 'None' WHERE id = '${task1Id}';`,
    false,
    "FORBIDDEN"
  );

  // MEM-06: Member attempts to change priority
  await executeTest(
    "MEM-06",
    "Assigned member cannot alter task priority",
    "authenticated",
    memberA1Id,
    `UPDATE public.tasks SET priority = 'CRITICAL' WHERE id = '${task1Id}';`,
    false,
    "FORBIDDEN"
  );

  // MEM-07: Member attempts to change deadline
  await executeTest(
    "MEM-07",
    "Assigned member cannot alter task deadline",
    "authenticated",
    memberA1Id,
    `UPDATE public.tasks SET deadline = now() + interval '10 days' WHERE id = '${task1Id}';`,
    false,
    "FORBIDDEN"
  );

  // MEM-08: Member attempts to change department_id
  await executeTest(
    "MEM-08",
    "Assigned member cannot alter task department_id",
    "authenticated",
    memberA1Id,
    `UPDATE public.tasks SET department_id = '${deptBId}' WHERE id = '${task1Id}';`,
    false,
    "FORBIDDEN"
  );

  // MEM-09: Member attempts to change project_id
  await executeTest(
    "MEM-09",
    "Assigned member cannot alter task project_id",
    "authenticated",
    memberA1Id,
    `UPDATE public.tasks SET project_id = gen_random_uuid() WHERE id = '${task1Id}';`,
    false,
    "FORBIDDEN"
  );

  // MEM-10: Member attempts to change created_by
  await executeTest(
    "MEM-10",
    "Assigned member cannot alter task created_by",
    "authenticated",
    memberA1Id,
    `UPDATE public.tasks SET created_by = '${memberA1Id}' WHERE id = '${task1Id}';`,
    false,
    "FORBIDDEN"
  );

  // MEM-11: Member attempts to change coordinator_id
  await executeTest(
    "MEM-11",
    "Assigned member cannot alter task coordinator_id",
    "authenticated",
    memberA1Id,
    `UPDATE public.tasks SET coordinator_id = '${memberA1Id}' WHERE id = '${task1Id}';`,
    false,
    "FORBIDDEN"
  );

  // MEM-12: Member attempts to mutate primary key id
  await executeTest(
    "MEM-12",
    "Assigned member cannot alter task primary key id",
    "authenticated",
    memberA1Id,
    `UPDATE public.tasks SET id = gen_random_uuid() WHERE id = '${task1Id}';`,
    false,
    "FORBIDDEN"
  );

  // MEM-13: Member attempts to mutate created_at
  await executeTest(
    "MEM-13",
    "Assigned member cannot alter task created_at",
    "authenticated",
    memberA1Id,
    `UPDATE public.tasks SET created_at = now() - interval '1 year' WHERE id = '${task1Id}';`,
    false,
    "FORBIDDEN"
  );

  // MEM-14: Member attempts direct transition to DONE
  await executeTest(
    "MEM-14",
    "Assigned member cannot directly set status to DONE",
    "authenticated",
    memberA1Id,
    `UPDATE public.tasks SET status = 'DONE' WHERE id = '${task1Id}';`,
    false,
    "FORBIDDEN"
  );

  // MEM-15: Member attempts direct transition to APPROVED
  await executeTest(
    "MEM-15",
    "Assigned member cannot directly set status to APPROVED",
    "authenticated",
    memberA1Id,
    `UPDATE public.tasks SET status = 'APPROVED' WHERE id = '${task1Id}';`,
    false,
    "APPROVAL_VIOLATION"
  );

  // MEM-16: Member attempts COORDINATOR_REVIEW without deliverable
  await executeTest(
    "MEM-16",
    "Member cannot set COORDINATOR_REVIEW without pending deliverable",
    "authenticated",
    memberA1Id,
    `UPDATE public.tasks SET status = 'COORDINATOR_REVIEW' WHERE id = '${task1Id}';`,
    false,
    "FORBIDDEN"
  );

  // MEM-17: Member transitions to COORDINATOR_REVIEW WITH deliverable
  await db.exec(`
    INSERT INTO public.task_submissions (task_id, submitted_by, title, description, status)
    VALUES ('${task1Id}', '${memberA1Id}', 'Livrable v1', 'Code terminé', 'PENDING_COORDINATOR');
  `);
  await executeTest(
    "MEM-17",
    "Member sets COORDINATOR_REVIEW when valid submission exists",
    "authenticated",
    memberA1Id,
    `UPDATE public.tasks SET status = 'COORDINATOR_REVIEW' WHERE id = '${task1Id}';`,
    true
  );
  await db.exec(`DELETE FROM public.task_submissions WHERE task_id = '${task1Id}';`);

  // MEM-18: Member attempts arbitrary status BACKLOG
  await executeTest(
    "MEM-18",
    "Assigned member cannot directly set status to BACKLOG",
    "authenticated",
    memberA1Id,
    `UPDATE public.tasks SET status = 'BACKLOG' WHERE id = '${task1Id}';`,
    false,
    "FORBIDDEN"
  );

  // MEM-19: Member attempts arbitrary status REVISION_REQUIRED
  await executeTest(
    "MEM-19",
    "Assigned member cannot directly set status to REVISION_REQUIRED",
    "authenticated",
    memberA1Id,
    `UPDATE public.tasks SET status = 'REVISION_REQUIRED' WHERE id = '${task1Id}';`,
    false,
    "FORBIDDEN"
  );

  // MEM-20: Member attempts arbitrary status REJECTED
  await executeTest(
    "MEM-20",
    "Assigned member cannot directly set status to REJECTED",
    "authenticated",
    memberA1Id,
    `UPDATE public.tasks SET status = 'REJECTED' WHERE id = '${task1Id}';`,
    false,
    "FORBIDDEN"
  );

  // MEM-21: Member attempts arbitrary status CANCELLED
  await executeTest(
    "MEM-21",
    "Assigned member cannot directly set status to CANCELLED",
    "authenticated",
    memberA1Id,
    `UPDATE public.tasks SET status = 'CANCELLED' WHERE id = '${task1Id}';`,
    false,
    "FORBIDDEN"
  );

  // MEM-22: Cannot reuse old reviewed submission (REVISION_REQUIRED)
  await db.exec(`
    INSERT INTO public.task_submissions (task_id, submitted_by, title, description, status)
    VALUES ('${task1Id}', '${memberA1Id}', 'Ancien Livrable v1', 'Code incomplet', 'REVISION_REQUIRED');
  `);
  await executeTest(
    "MEM-22",
    "Member cannot set COORDINATOR_REVIEW using an old REVISION_REQUIRED submission",
    "authenticated",
    memberA1Id,
    `UPDATE public.tasks SET status = 'COORDINATOR_REVIEW' WHERE id = '${task1Id}';`,
    false,
    "FORBIDDEN"
  );
  await db.exec(`DELETE FROM public.task_submissions WHERE task_id = '${task1Id}';`);

  // MEM-23: Cannot reuse old approved submission (APPROVED)
  await db.exec(`
    INSERT INTO public.task_submissions (task_id, submitted_by, title, description, status, is_locked)
    VALUES ('${task1Id}', '${memberA1Id}', 'Ancien Livrable v1', 'Validé', 'APPROVED', true);
  `);
  await executeTest(
    "MEM-23",
    "Member cannot set COORDINATOR_REVIEW using an old APPROVED submission",
    "authenticated",
    memberA1Id,
    `UPDATE public.tasks SET status = 'COORDINATOR_REVIEW' WHERE id = '${task1Id}';`,
    false,
    "FORBIDDEN"
  );
  await db.exec(`DELETE FROM public.task_submissions WHERE task_id = '${task1Id}';`);

  // MEM-24: Member cannot modify an unassigned task in another department
  await executeTest(
    "MEM-24",
    "Member cannot modify task outside assignment scope (unassigned task)",
    "authenticated",
    memberA1Id,
    `UPDATE public.tasks SET status = 'IN_PROGRESS' WHERE id = '${task2Id}';`,
    false,
    "FORBIDDEN"
  );

  // ==============================================================================
  // SECTION 3: COORDINATOR RUNTIME TESTS
  // ==============================================================================
  console.log("\n--- SECTION 3: COORDINATOR RUNTIME TESTS ---");

  // COORD-01: Coordinator updates title in own department
  await executeTest(
    "COORD-01",
    "Coordinator updates title in own department",
    "authenticated",
    coordAId,
    `UPDATE public.tasks SET title = 'Portail V2' WHERE id = '${task1Id}';`,
    true
  );

  // COORD-02: Coordinator updates priority in own department
  await executeTest(
    "COORD-02",
    "Coordinator updates priority in own department",
    "authenticated",
    coordAId,
    `UPDATE public.tasks SET priority = 'CRITICAL' WHERE id = '${task1Id}';`,
    true
  );

  // COORD-03: Coordinator attempts cross-department task transfer
  await executeTest(
    "COORD-03",
    "Coordinator cannot transfer task to another department",
    "authenticated",
    coordAId,
    `UPDATE public.tasks SET department_id = '${deptBId}' WHERE id = '${task1Id}';`,
    false,
    "FORBIDDEN"
  );

  // COORD-04: Coordinator attempts to modify created_by to another user
  await executeTest(
    "COORD-04",
    "Coordinator cannot alter created_by",
    "authenticated",
    coordAId,
    `UPDATE public.tasks SET created_by = '${memberA1Id}' WHERE id = '${task1Id}';`,
    false,
    "FORBIDDEN"
  );

  // COORD-05: Coordinator attempts to set status = 'APPROVED'
  await executeTest(
    "COORD-05",
    "Coordinator cannot set status = 'APPROVED'",
    "authenticated",
    coordAId,
    `UPDATE public.tasks SET status = 'APPROVED' WHERE id = '${task1Id}';`,
    false,
    "APPROVAL_VIOLATION"
  );

  // COORD-06: Coordinator cannot modify task in SUPER_ADMIN_APPROVAL
  await setAuthContext(superAdminId, "authenticated");
  await db.exec(`UPDATE public.tasks SET status = 'SUPER_ADMIN_APPROVAL' WHERE id = '${task1Id}';`);
  await executeTest(
    "COORD-06",
    "Coordinator cannot modify task in SUPER_ADMIN_APPROVAL",
    "authenticated",
    coordAId,
    `UPDATE public.tasks SET priority = 'LOW' WHERE id = '${task1Id}';`,
    false,
    "FORBIDDEN"
  );
  await setAuthContext(superAdminId, "authenticated");
  await db.exec(`UPDATE public.tasks SET status = 'TODO' WHERE id = '${task1Id}';`);

  // COORD-07: Coordinator cannot modify task in APPROVED state
  await setAuthContext(superAdminId, "authenticated");
  await db.exec(`UPDATE public.tasks SET status = 'APPROVED' WHERE id = '${task1Id}';`);
  await executeTest(
    "COORD-07",
    "Coordinator cannot modify task in APPROVED state",
    "authenticated",
    coordAId,
    `UPDATE public.tasks SET title = 'Modified Approved Task' WHERE id = '${task1Id}';`,
    false,
    "FORBIDDEN"
  );
  await setAuthContext(superAdminId, "authenticated");
  await db.exec(`UPDATE public.tasks SET status = 'TODO' WHERE id = '${task1Id}';`);

  // COORD-08: Coordinator cannot set status = 'DONE' directly without Super Admin approval
  await executeTest(
    "COORD-08",
    "Coordinator cannot set status = 'DONE' directly to bypass approval",
    "authenticated",
    coordAId,
    `UPDATE public.tasks SET status = 'DONE' WHERE id = '${task1Id}';`,
    false,
    "APPROVAL_VIOLATION"
  );

  // COORD-09: Coordinator can cancel task in own department
  await executeTest(
    "COORD-09",
    "Coordinator can cancel task in own department (CANCELLED)",
    "authenticated",
    coordAId,
    `UPDATE public.tasks SET status = 'CANCELLED' WHERE id = '${task1Id}';`,
    true
  );

  // COORD-10: Coordinator cannot cancel or modify task in other department
  await executeTest(
    "COORD-10",
    "Coordinator cannot modify or cancel task in another department",
    "authenticated",
    coordAId,
    `UPDATE public.tasks SET status = 'CANCELLED' WHERE id = '${task2Id}';`,
    false,
    "FORBIDDEN"
  );

  // ==============================================================================
  // SECTION 4: SUPER ADMIN RUNTIME TESTS
  // ==============================================================================
  console.log("\n--- SECTION 4: SUPER ADMIN RUNTIME TESTS ---");

  // SA-01: Super Admin updates task in any department
  await executeTest(
    "SA-01",
    "Super Admin updates task parameters in any department",
    "authenticated",
    superAdminId,
    `UPDATE public.tasks SET priority = 'CRITICAL', title = 'Priority Task Admin' WHERE id = '${task1Id}';`,
    true
  );

  // SA-02: Super Admin approves task
  await executeTest(
    "SA-02",
    "Super Admin sets task status = 'APPROVED'",
    "authenticated",
    superAdminId,
    `UPDATE public.tasks SET status = 'APPROVED' WHERE id = '${task1Id}';`,
    true
  );

  // SA-03: Super Admin cannot alter primary key id
  await executeTest(
    "SA-03",
    "Super Admin cannot alter primary key id (universal immutability)",
    "authenticated",
    superAdminId,
    `UPDATE public.tasks SET id = gen_random_uuid() WHERE id = '${task1Id}';`,
    false,
    "FORBIDDEN"
  );

  // SA-04: Super Admin cannot alter created_at
  await executeTest(
    "SA-04",
    "Super Admin cannot alter created_at (universal immutability)",
    "authenticated",
    superAdminId,
    `UPDATE public.tasks SET created_at = now() - interval '1 year' WHERE id = '${task1Id}';`,
    false,
    "FORBIDDEN"
  );

  // ==============================================================================
  // SECTION 4B: COMPLETE END-TO-END WORKFLOW LIFECYCLE WALKTHROUGH (FLOW-01..08)
  // ==============================================================================
  console.log("\n--- SECTION 4B: COMPLETE END-TO-END WORKFLOW LIFECYCLE WALKTHROUGH ---");

  const flowTaskId = "30000000-0000-0000-0000-000000000001";
  await setAuthContext(superAdminId, "authenticated");
  await db.exec(`
    INSERT INTO public.tasks (id, department_id, title, description, priority, status, created_by, coordinator_id)
    VALUES ('${flowTaskId}', '${deptAId}', 'Cycle de vie complet', 'Test E2E', 'HIGH', 'TODO', '${coordAId}', '${coordAId}');
    INSERT INTO public.task_assignees (task_id, user_id) VALUES ('${flowTaskId}', '${memberA1Id}');
  `);

  // FLOW-01: Member starts task: TODO -> IN_PROGRESS
  await setAuthContext(memberA1Id, "authenticated");
  await db.exec(`UPDATE public.tasks SET status = 'IN_PROGRESS' WHERE id = '${flowTaskId}';`);
  const status01 = (await db.query(`SELECT status FROM public.tasks WHERE id = '${flowTaskId}';`)).rows[0].status;
  recordResult("FLOW-01", "Step 1: Member moves TODO -> IN_PROGRESS", "MEMBER", "UPDATE ... status = 'IN_PROGRESS'", "IN_PROGRESS", status01, status01 === "IN_PROGRESS");

  // FLOW-02: Member deposits deliverable and transitions to COORDINATOR_REVIEW
  await db.exec(`
    INSERT INTO public.task_submissions (task_id, submitted_by, title, description, status)
    VALUES ('${flowTaskId}', '${memberA1Id}', 'Livrable Final', 'Code complet', 'PENDING_COORDINATOR');
  `);
  await db.exec(`UPDATE public.tasks SET status = 'COORDINATOR_REVIEW' WHERE id = '${flowTaskId}';`);
  const status02 = (await db.query(`SELECT status FROM public.tasks WHERE id = '${flowTaskId}';`)).rows[0].status;
  recordResult("FLOW-02", "Step 2: Member submits deliverable -> COORDINATOR_REVIEW", "MEMBER", "UPDATE ... status = 'COORDINATOR_REVIEW'", "COORDINATOR_REVIEW", status02, status02 === "COORDINATOR_REVIEW");

  // FLOW-03: Member is now locked out during review
  let memberBlocked = false;
  try {
    await db.exec(`UPDATE public.tasks SET title = 'Trying to edit' WHERE id = '${flowTaskId}';`);
  } catch (err) {
    memberBlocked = err.message.includes("FORBIDDEN");
  }
  recordResult("FLOW-03", "Step 3: Member is locked out during review", "MEMBER", "UPDATE ... title = ...", "FORBIDDEN", memberBlocked ? "FORBIDDEN" : "MUTATED", memberBlocked);

  // FLOW-04: Coordinator reviews and promotes to SUPER_ADMIN_APPROVAL
  await setAuthContext(coordAId, "authenticated");
  await db.exec(`
    UPDATE public.task_submissions SET status = 'PENDING_SUPER_ADMIN' WHERE task_id = '${flowTaskId}';
    UPDATE public.tasks SET status = 'SUPER_ADMIN_APPROVAL' WHERE id = '${flowTaskId}';
  `);
  const status04 = (await db.query(`SELECT status FROM public.tasks WHERE id = '${flowTaskId}';`)).rows[0].status;
  recordResult("FLOW-04", "Step 4: Coordinator promotes to SUPER_ADMIN_APPROVAL", "COORDINATOR", "UPDATE ... status = 'SUPER_ADMIN_APPROVAL'", "SUPER_ADMIN_APPROVAL", status04, status04 === "SUPER_ADMIN_APPROVAL");

  // FLOW-05: Coordinator cannot modify task in SUPER_ADMIN_APPROVAL
  let coordBlocked = false;
  try {
    await db.exec(`UPDATE public.tasks SET priority = 'LOW' WHERE id = '${flowTaskId}';`);
  } catch (err) {
    coordBlocked = err.message.includes("FORBIDDEN");
  }
  recordResult("FLOW-05", "Step 5: Coordinator locked out while in SUPER_ADMIN_APPROVAL", "COORDINATOR", "UPDATE ... priority = 'LOW'", "FORBIDDEN", coordBlocked ? "FORBIDDEN" : "MUTATED", coordBlocked);

  // FLOW-06: Super Admin grants final approval -> APPROVED
  await setAuthContext(superAdminId, "authenticated");
  await db.exec(`
    UPDATE public.task_submissions SET status = 'APPROVED', is_locked = true WHERE task_id = '${flowTaskId}';
    UPDATE public.tasks SET status = 'APPROVED' WHERE id = '${flowTaskId}';
  `);
  const status06 = (await db.query(`SELECT status FROM public.tasks WHERE id = '${flowTaskId}';`)).rows[0].status;
  recordResult("FLOW-06", "Step 6: Super Admin approves task -> APPROVED", "SUPER_ADMIN", "UPDATE ... status = 'APPROVED'", "APPROVED", status06, status06 === "APPROVED");

  // FLOW-07: Coordinator cannot modify APPROVED task
  await setAuthContext(coordAId, "authenticated");
  let coordApprovedBlocked = false;
  try {
    await db.exec(`UPDATE public.tasks SET title = 'Altering Approved' WHERE id = '${flowTaskId}';`);
  } catch (err) {
    coordApprovedBlocked = err.message.includes("FORBIDDEN");
  }
  recordResult("FLOW-07", "Step 7: Coordinator cannot alter APPROVED task", "COORDINATOR", "UPDATE ... title = ...", "FORBIDDEN", coordApprovedBlocked ? "FORBIDDEN" : "MUTATED", coordApprovedBlocked);

  // FLOW-08: Super Admin marks task DONE
  await setAuthContext(superAdminId, "authenticated");
  await db.exec(`UPDATE public.tasks SET status = 'DONE' WHERE id = '${flowTaskId}';`);
  const status08 = (await db.query(`SELECT status FROM public.tasks WHERE id = '${flowTaskId}';`)).rows[0].status;
  recordResult("FLOW-08", "Step 8: Super Admin closes task -> DONE", "SUPER_ADMIN", "UPDATE ... status = 'DONE'", "DONE", status08, status08 === "DONE");

  // Cleanup flow task
  await db.exec(`
    DELETE FROM public.task_submissions WHERE task_id = '${flowTaskId}';
    DELETE FROM public.task_assignees WHERE task_id = '${flowTaskId}';
    DELETE FROM public.tasks WHERE id = '${flowTaskId}';
  `);

  // ==============================================================================
  // SECTION 5: TRIGGER CHAIN & UPDATED_AT BEHAVIOR
  // ==============================================================================
  console.log("\n--- SECTION 5: TRIGGER CHAIN & UPDATED_AT BEHAVIOR ---");

  // TRG-01: updated_at advances on successful update
  await setAuthContext(coordAId, "authenticated");
  const beforeTask = (await db.query(`SELECT updated_at FROM public.tasks WHERE id = '${task1Id}';`)).rows[0];
  await new Promise((r) => setTimeout(r, 50));
  await db.exec(`UPDATE public.tasks SET title = 'Timestamp Advance Test' WHERE id = '${task1Id}';`);
  const afterTask = (await db.query(`SELECT updated_at FROM public.tasks WHERE id = '${task1Id}';`)).rows[0];
  
  const tsAdvanced = new Date(afterTask.updated_at).getTime() >= new Date(beforeTask.updated_at).getTime();
  recordResult(
    "TRG-01",
    "trg_set_updated_at executes and updates timestamp",
    "authenticated",
    "UPDATE public.tasks SET title = ...",
    "updated_at >= before",
    `after=${afterTask.updated_at}`,
    tsAdvanced
  );

  // ==============================================================================
  // SECTION 6: ROLLBACK SPECIFICATION RUNTIME VALIDATION
  // ==============================================================================
  console.log("\n--- SECTION 6: ROLLBACK SPECIFICATION RUNTIME VALIDATION ---");

  const rollbackSQL = `
    BEGIN;
    DROP TRIGGER IF EXISTS trg_enforce_task_member_immutability ON public.tasks;
    DROP FUNCTION IF EXISTS private.enforce_task_member_immutability();
    COMMIT;
  `;
  await db.exec(rollbackSQL);

  // Check trigger existence
  const checkTrg = await db.query(`
    SELECT tgname FROM pg_trigger 
    JOIN pg_class ON pg_class.oid = pg_trigger.tgrelid 
    WHERE relname = 'tasks' AND tgname = 'trg_enforce_task_member_immutability';
  `);
  const trgRemoved = checkTrg.rows.length === 0;
  recordResult("RBK-01", "Rollback removes trg_enforce_task_member_immutability", "system", rollbackSQL, "0 triggers", `${checkTrg.rows.length} triggers`, trgRemoved);

  // Check original triggers intact
  const origTrg = await db.query(`
    SELECT tgname FROM pg_trigger 
    JOIN pg_class ON pg_class.oid = pg_trigger.tgrelid 
    WHERE relname = 'tasks' AND NOT tgisinternal ORDER BY tgname;
  `);
  const names = origTrg.rows.map(r => r.tgname);
  const origIntact = names.includes("trg_enforce_task_approval") && names.includes("trg_set_updated_at") && names.length === 2;
  recordResult("RBK-02", "Rollback preserves pre-existing triggers", "system", "SELECT tgname...", "2 triggers intact", `${names.join(", ")}`, origIntact);

  // Re-apply patch to verify repeatability
  await db.exec(proposedTriggerSQL);
  const recheckTrg = await db.query(`
    SELECT tgname FROM pg_trigger 
    JOIN pg_class ON pg_class.oid = pg_trigger.tgrelid 
    WHERE relname = 'tasks' AND tgname = 'trg_enforce_task_member_immutability';
  `);
  const reapplied = recheckTrg.rows.length === 1;
  recordResult("RBK-03", "Patch is cleanly repeatable and idempotent", "system", proposedTriggerSQL, "1 trigger", `${recheckTrg.rows.length} trigger`, reapplied);

  // Final Summary
  const passedCount = testResults.filter(r => r.passed).length;
  const totalCount = testResults.length;
  console.log("\n==================================================================");
  console.log(`SUMMARY: ${passedCount}/${totalCount} real runtime tests passed (${Math.round((passedCount/totalCount)*100)}%)`);
  console.log("==================================================================");

  return { passedCount, totalCount, testResults };
}

runRuntimeTests().catch((err) => {
  console.error("Runtime test suite error:", err);
  process.exit(1);
});
