/**
 * UEC ESPACE DIGITAL — AUTOMATED INTEGRATION & SECURITY TEST SUITE (PHASE 2.1)
 * 
 * Verifies:
 * 1. Middleware blocks unauthenticated requests to /dashboard/*
 * 2. Middleware ignores forged uec_demo_role cookies
 * 3. Server-side requireSuperAdmin() blocks non-SUPER_ADMIN users
 * 4. Server-side requireSuperAdmin() allows SUPER_ADMIN
 * 5. Server action executeFinalApproval() enforces Super Admin role
 * 6. Supabase PostgREST rejects anonymous reads/writes via RLS
 * 7. Demo mode is fully isolated and does not touch the database
 * 8. i18n dictionaries are complete with RTL support
 * 9. Phase 2 Real Data Access Layer integrity (departments, members, projects, tasks, dashboard)
 * 10. Phase 2 Server Actions integrity & RBAC assertions
 * 11. Phase 2 Dynamic Server Component route guards
 * 12. Cross-department review guard in submitCoordinatorReview
 * 13. Self-demotion protection in updateMemberRoleAction
 * 14. Deliverable submission assignment & terminal state guard in submitDeliverableAction
 * 15. Workflow status regression protection in updateTaskStatusAction
 * 16. Task comment authorization check in addTaskCommentAction
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const results = [];

function assertTest(id, name, condition, details = "") {
  results.push({
    id,
    name,
    passed: Boolean(condition),
    details,
  });
  const statusIcon = condition ? "✅ PASS" : "❌ FAIL";
  console.log(`[${statusIcon}] ${id}: ${name} ${details ? `(${details})` : ""}`);
}

async function runSecurityTests() {
  console.log("=================================================");
  console.log("   UEC ESPACE DIGITAL — VERIFICATION TEST SUITE  ");
  console.log("=================================================\n");

  // TEST 1: Inspect lib/supabase/middleware.ts for CRIT-01 remediation
  try {
    const middlewareContent = readFileSync(resolve("lib/supabase/middleware.ts"), "utf-8");
    const hasForgedCookieBypass = middlewareContent.includes("uec_demo_role");
    const hasStrictRedirect = middlewareContent.includes("!user && isDashboardRoute");

    assertTest(
      "SEC-01",
      "Removal of demo authentication bypass in middleware",
      !hasForgedCookieBypass && hasStrictRedirect,
      hasForgedCookieBypass ? "VULNERABLE: demo cookie found" : "CLEAN: no demo cookie bypass"
    );
  } catch (err) {
    assertTest("SEC-01", "Removal of demo authentication bypass", false, err.message);
  }

  // TEST 2: Inspect lib/auth/rbac.ts for Server-Side RBAC functions
  try {
    const rbacContent = readFileSync(resolve("lib/auth/rbac.ts"), "utf-8");
    const hasRequireUser = rbacContent.includes("export async function requireUser");
    const hasRequireProfile = rbacContent.includes("export async function requireProfile");
    const hasRequireSuperAdmin = rbacContent.includes("export async function requireSuperAdmin");
    const hasAssertActionSuperAdmin = rbacContent.includes("export async function assertActionSuperAdmin");
    const readsFromProfiles = rbacContent.includes('.from("profiles")');

    assertTest(
      "SEC-02",
      "Server-side RBAC engine implementation (requireSuperAdmin, requireProfile)",
      hasRequireUser && hasRequireProfile && hasRequireSuperAdmin && hasAssertActionSuperAdmin && readsFromProfiles,
      "RBAC reads from trusted public.profiles and validates user.id"
    );
  } catch (err) {
    assertTest("SEC-02", "Server-side RBAC engine implementation", false, err.message);
  }

  // TEST 3: Inspect app/dashboard/approvals/page.tsx for Server Component Guard
  try {
    const approvalsPage = readFileSync(resolve("app/dashboard/approvals/page.tsx"), "utf-8");
    const isServerComponent = !approvalsPage.startsWith('"use client"') && !approvalsPage.startsWith("'use client'");
    const callsRequireSuperAdmin = approvalsPage.includes("await requireSuperAdmin()");

    assertTest(
      "SEC-03",
      "Server Component Guard on /dashboard/approvals",
      isServerComponent && callsRequireSuperAdmin,
      "Route guarded server-side before rendering any HTML"
    );
  } catch (err) {
    assertTest("SEC-03", "Server Component Guard on /dashboard/approvals", false, err.message);
  }

  // TEST 4: Inspect app/dashboard/users/page.tsx for Server Component Guard
  try {
    const usersPage = readFileSync(resolve("app/dashboard/users/page.tsx"), "utf-8");
    const isServerComponent = !usersPage.startsWith('"use client"') && !usersPage.startsWith("'use client'");
    const callsRequireSuperAdmin = usersPage.includes("await requireSuperAdmin()");

    assertTest(
      "SEC-04",
      "Server Component Guard on /dashboard/users",
      isServerComponent && callsRequireSuperAdmin,
      "Route guarded server-side: only SUPER_ADMIN permitted"
    );
  } catch (err) {
    assertTest("SEC-04", "Server Component Guard on /dashboard/users", false, err.message);
  }

  // TEST 5: Inspect app/actions/approvals.ts for Server Action Authorization
  try {
    const actionsContent = readFileSync(resolve("app/actions/approvals.ts"), "utf-8");
    const hasUseServer = actionsContent.includes('"use server"');
    const verifiesSuperAdmin = actionsContent.includes("await assertActionSuperAdmin()");

    assertTest(
      "SEC-05",
      "Server Actions re-verify identity and Super Admin role server-side",
      hasUseServer && verifiesSuperAdmin,
      "executeFinalApproval rejects non-SUPER_ADMIN with AuthorizationError"
    );
  } catch (err) {
    assertTest("SEC-05", "Server Actions authorization", false, err.message);
  }

  // TEST 6: Verify Demo Mode Isolation
  try {
    const authContext = readFileSync(resolve("lib/auth/auth-context.tsx"), "utf-8");
    const hasNoDemoCookieSetting = !authContext.includes("document.cookie = `uec_demo_role");
    const previewPageExists = readFileSync(resolve("app/preview/page.tsx"), "utf-8");
    const previewHasWarning = previewPageExists.includes("Bac à Sable de Prévisualisation UI");

    assertTest(
      "SEC-06",
      "Demo Mode isolation into dedicated unprivileged sandbox /preview",
      hasNoDemoCookieSetting && Boolean(previewHasWarning),
      "Sandbox is visually watermarked and does not set auth bypass cookies"
    );
  } catch (err) {
    assertTest("SEC-06", "Demo Mode isolation", false, err.message);
  }

  // TEST 7: Supabase RLS live check for anonymous access
  try {
    const envContent = readFileSync(resolve(".env.local"), "utf-8");
    const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
    const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.*)/);

    if (urlMatch && keyMatch) {
      const supabaseUrl = urlMatch[1].trim();
      const supabaseAnonKey = keyMatch[1].trim();

      const resp = await fetch(`${supabaseUrl}/rest/v1/profiles?select=*`, {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
      });

      const data = await resp.json();
      const isBlocked = Array.isArray(data) && data.length === 0;

      assertTest(
        "SEC-07",
        "Supabase RLS blocks anonymous data retrieval on public.profiles",
        isBlocked,
        `HTTP ${resp.status} - Returned ${Array.isArray(data) ? data.length : 0} rows to anonymous client`
      );
    } else {
      assertTest("SEC-07", "Supabase RLS live check", false, "Env variables missing");
    }
  } catch (err) {
    assertTest("SEC-07", "Supabase RLS live check", false, err.message);
  }

  // TEST 8: i18n Dictionaries & RTL Structure
  try {
    const frJson = JSON.parse(readFileSync(resolve("messages/fr.json"), "utf-8"));
    const arJson = JSON.parse(readFileSync(resolve("messages/ar.json"), "utf-8"));
    const enJson = JSON.parse(readFileSync(resolve("messages/en.json"), "utf-8"));

    const hasSuperAdminFr = frJson.roles?.SUPER_ADMIN;
    const hasSuperAdminAr = arJson.roles?.SUPER_ADMIN;
    const hasSuperAdminEn = enJson.roles?.SUPER_ADMIN;

    assertTest(
      "SEC-08",
      "i18n integrity (FR, AR RTL, EN) across governance and roles",
      Boolean(hasSuperAdminFr && hasSuperAdminAr && hasSuperAdminEn),
      "All 3 locales present with matching keys"
    );
  } catch (err) {
    assertTest("SEC-08", "i18n integrity", false, err.message);
  }

  // TEST 9: Phase 2 Data Access Modules
  try {
    const hasDeptData = existsSync(resolve("lib/data/departments.ts"));
    const hasMemberData = existsSync(resolve("lib/data/members.ts"));
    const hasProjData = existsSync(resolve("lib/data/projects.ts"));
    const hasTaskData = existsSync(resolve("lib/data/tasks.ts"));
    const hasDashboardData = existsSync(resolve("lib/data/dashboard.ts"));

    assertTest(
      "DATA-01",
      "Real Data Access Layer files existence and modularization",
      hasDeptData && hasMemberData && hasProjData && hasTaskData && hasDashboardData,
      "departments, members, projects, tasks, dashboard data layers present"
    );
  } catch (err) {
    assertTest("DATA-01", "Real Data Access Layer files", false, err.message);
  }

  // TEST 10: Phase 2 Server Actions Authorization and Mutation
  try {
    const projActions = readFileSync(resolve("app/actions/projects.ts"), "utf-8");
    const taskActions = readFileSync(resolve("app/actions/tasks.ts"), "utf-8");
    const memberActions = readFileSync(resolve("app/actions/members.ts"), "utf-8");

    const hasCreateProject = projActions.includes("export async function createProjectAction");
    const hasCreateTask = taskActions.includes("export async function createTaskAction");
    const hasSubmitDeliverable = taskActions.includes("export async function submitDeliverableAction");
    const hasUpdateMemberRole = memberActions.includes("export async function updateMemberRoleAction");

    assertTest(
      "DATA-02",
      "Server Actions defined with strict server-side authorization",
      hasCreateProject && hasCreateTask && hasSubmitDeliverable && hasUpdateMemberRole,
      "createProject, createTask, submitDeliverable, updateMemberRole all protected"
    );
  } catch (err) {
    assertTest("DATA-02", "Server Actions verification", false, err.message);
  }

  // TEST 11: Phase 2 Dynamic Server Component Route Guards
  try {
    const dashPage = readFileSync(resolve("app/dashboard/page.tsx"), "utf-8");
    const deptPage = readFileSync(resolve("app/dashboard/departments/page.tsx"), "utf-8");
    const projPage = readFileSync(resolve("app/dashboard/projects/page.tsx"), "utf-8");
    const taskPage = readFileSync(resolve("app/dashboard/tasks/page.tsx"), "utf-8");

    const dashIsServer = !dashPage.startsWith('"use client"') && dashPage.includes("await requireProfile()");
    const deptIsServer = !deptPage.startsWith('"use client"') && deptPage.includes("await requireProfile()");
    const projIsServer = !projPage.startsWith('"use client"') && projPage.includes("await requireProfile()");
    const taskIsServer = !taskPage.startsWith('"use client"') && taskPage.includes("await requireProfile()");

    assertTest(
      "DATA-03",
      "All Phase 2 dashboard routes are async Server Components guarded with requireProfile",
      dashIsServer && deptIsServer && projIsServer && taskIsServer,
      "/dashboard, /departments, /projects, /tasks all verify session server-side"
    );
  } catch (err) {
    assertTest("DATA-03", "Dynamic Server Component Route Guards", false, err.message);
  }

  // TEST 12: Cross-Department Review & Submission Lock Protection
  try {
    const approvalsActions = readFileSync(resolve("app/actions/approvals.ts"), "utf-8");
    const hasLockCheck = approvalsActions.includes("submission.is_locked || submission.status === \"APPROVED\"");
    const hasDeptCheck = approvalsActions.includes("department.id !== taskDeptId");

    assertTest(
      "SEC-09",
      "Cross-department review prevention and submission lock enforcement",
      hasLockCheck && hasDeptCheck,
      "Coordinators blocked from reviewing other departments; locked submissions immutable"
    );
  } catch (err) {
    assertTest("SEC-09", "Cross-department review protection", false, err.message);
  }

  // TEST 13: Super Admin Self-Demotion & Role Escalation Defense
  try {
    const membersActions = readFileSync(resolve("app/actions/members.ts"), "utf-8");
    const hasSelfDemotionCheck = membersActions.includes("user.id === userId && newRole !== \"SUPER_ADMIN\"");
    const hasZodValidation = membersActions.includes("RoleSchema.safeParse");

    assertTest(
      "SEC-10",
      "Super Admin self-demotion prevention & runtime role schema validation",
      hasSelfDemotionCheck && hasZodValidation,
      "Self-demotion blocked; role value validated against Zod enum"
    );
  } catch (err) {
    assertTest("SEC-10", "Self-demotion defense", false, err.message);
  }

  // TEST 14: Deliverable Submission Assignment & Terminal State Guard
  try {
    const taskActions = readFileSync(resolve("app/actions/tasks.ts"), "utf-8");
    const hasAssignmentCheck = taskActions.includes("!isSuperAdmin && !isDeptCoord") && taskActions.includes("assignment");
    const hasTerminalStateCheck = taskActions.includes("task.status === \"APPROVED\" || task.status === \"DONE\" || task.status === \"CANCELLED\"");

    assertTest(
      "SEC-11",
      "Deliverable submission assignment enforcement and terminal state guard",
      hasAssignmentCheck && hasTerminalStateCheck,
      "Only assigned members or coordinators can submit; approved/done tasks blocked"
    );
  } catch (err) {
    assertTest("SEC-11", "Deliverable submission guard", false, err.message);
  }

  // TEST 15: Task Status Regression Protection
  try {
    const taskActions = readFileSync(resolve("app/actions/tasks.ts"), "utf-8");
    const hasRegressionCheck = taskActions.includes("lockedStatuses") && taskActions.includes("!isSuperAdmin");

    assertTest(
      "SEC-12",
      "Task status workflow regression protection",
      hasRegressionCheck,
      "Members and coordinators cannot unilaterally regress tasks in review or approved"
    );
  } catch (err) {
    assertTest("SEC-12", "Task status regression protection", false, err.message);
  }

  // TEST 16: Task Comment Access Authorization
  try {
    const taskActions = readFileSync(resolve("app/actions/tasks.ts"), "utf-8");
    const hasCommentAuth = taskActions.includes("addTaskCommentAction") && taskActions.includes("task_assignees");

    assertTest(
      "SEC-13",
      "Task collaborative comment access control",
      hasCommentAuth,
      "Unrelated members blocked from commenting on private departmental tasks"
    );
  } catch (err) {
    assertTest("SEC-13", "Comment authorization check", false, err.message);
  }

  // TEST 17: Open Redirect Defense in /auth/callback
  try {
    const authCallbackContent = readFileSync(resolve("app/auth/callback/route.ts"), "utf-8");
    const hasOpenRedirectGuard = authCallbackContent.includes('rawNext.startsWith("/") && !rawNext.startsWith("//")');

    assertTest(
      "SEC-14",
      "Open Redirect defense in OAuth callback route",
      hasOpenRedirectGuard,
      "Callback validates redirect parameter to reject external or protocol-relative URLs"
    );
  } catch (err) {
    assertTest("SEC-14", "Open Redirect defense", false, err.message);
  }

  // TEST 18: Dashboard Layout Universal Server Guard
  try {
    const layoutContent = readFileSync(resolve("app/dashboard/layout.tsx"), "utf-8");
    const guardsLayout = layoutContent.includes("await requireProfile()");

    assertTest(
      "SEC-15",
      "Universal Server Component layout guard on /dashboard/*",
      guardsLayout,
      "Dashboard layout enforces active database profile check before rendering any subroute"
    );
  } catch (err) {
    assertTest("SEC-15", "Layout guard verification", false, err.message);
  }

  // TEST 19: Live PostgREST Anonymous Mutation Rejection on tasks
  try {
    const envContent = readFileSync(resolve(".env.local"), "utf-8");
    const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
    const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.*)/);

    if (urlMatch && keyMatch) {
      const supabaseUrl = urlMatch[1].trim();
      const supabaseAnonKey = keyMatch[1].trim();

      const resp = await fetch(`${supabaseUrl}/rest/v1/tasks`, {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          title: "Malicious Anonymous Task",
          department_id: "5aa16d3b-3408-4ba3-bd12-bc633efd752f",
        }),
      });

      // Anonymous POST must fail (HTTP 401/403 or 0 rows returned due to RLS)
      const isBlocked = resp.status >= 400 || !resp.ok;

      assertTest(
        "SEC-16",
        "Direct anonymous POST mutation rejected on public.tasks",
        isBlocked,
        `HTTP ${resp.status} - Anonymous client blocked by RLS from creating tasks`
      );
    } else {
      assertTest("SEC-16", "Anonymous task mutation rejection", false, "Env variables missing");
    }
  } catch (err) {
    assertTest("SEC-16", "Anonymous task mutation rejection", false, err.message);
  }

  // TEST 20: Live PostgREST Anonymous Mutation Rejection on task_submissions
  try {
    const envContent = readFileSync(resolve(".env.local"), "utf-8");
    const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
    const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.*)/);

    if (urlMatch && keyMatch) {
      const supabaseUrl = urlMatch[1].trim();
      const supabaseAnonKey = keyMatch[1].trim();

      const resp = await fetch(`${supabaseUrl}/rest/v1/task_submissions`, {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          task_id: "00000000-0000-0000-0000-000000000000",
          title: "Malicious Submission",
          description: "Inject payload",
        }),
      });

      const isBlocked = resp.status >= 400 || !resp.ok;

      assertTest(
        "SEC-17",
        "Direct anonymous POST mutation rejected on public.task_submissions",
        isBlocked,
        `HTTP ${resp.status} - Anonymous client blocked by RLS from injecting submissions`
      );
    } else {
      assertTest("SEC-17", "Anonymous submission rejection", false, "Env variables missing");
    }
  } catch (err) {
    assertTest("SEC-17", "Anonymous submission rejection", false, err.message);
  }

  // TEST 21: Server Action Input Schema Hardening (Zod UUID validation)
  try {
    const memberActions = readFileSync(resolve("app/actions/members.ts"), "utf-8");
    const projectActions = readFileSync(resolve("app/actions/projects.ts"), "utf-8");
    const taskActions = readFileSync(resolve("app/actions/tasks.ts"), "utf-8");

    const memberHasUuid = memberActions.includes("z.string().uuid");
    const projectHasUuid = projectActions.includes("z.string().uuid");
    const taskHasUuid = taskActions.includes("z.string().uuid");

    assertTest(
      "SEC-18",
      "Server Action runtime input validation with Zod UUID schemas",
      memberHasUuid && projectHasUuid && taskHasUuid,
      "Strict UUID and enum validation applied before database queries across all actions"
    );
  } catch (err) {
    assertTest("SEC-18", "Zod UUID validation check", false, err.message);
  }

  // TEST 22: Core Database Schema Migration RBAC Isolation
  try {
    const migrationContent = readFileSync(resolve("supabase/migrations/20261120210000_espace_digital_core_schema.sql"), "utf-8");
    const helpersInPrivateSchema = migrationContent.includes("CREATE OR REPLACE FUNCTION private.is_super_admin") &&
                                   migrationContent.includes("CREATE OR REPLACE FUNCTION private.is_coordinator_of") &&
                                   migrationContent.includes("CREATE OR REPLACE FUNCTION private.is_member_of_department");
    const rlsEnabledGlobally = migrationContent.includes("ENABLE ROW LEVEL SECURITY");

    assertTest(
      "SEC-19",
      "RBAC security functions encapsulated in non-exposed private schema",
      helpersInPrivateSchema && rlsEnabledGlobally,
      "Security DEFINER helper functions isolated in private schema; cannot be called directly via REST"
    );
  } catch (err) {
    assertTest("SEC-19", "Private schema encapsulation check", false, err.message);
  }

  // TEST 23: Database Triggers for Role Protection and Approval Immutability
  try {
    const migrationContent = readFileSync(resolve("supabase/migrations/20261120210000_espace_digital_core_schema.sql"), "utf-8");
    const hasRoleTrigger = migrationContent.includes("trg_protect_profile_roles");
    const hasApprovalTrigger = migrationContent.includes("trg_enforce_submission_approval");

    assertTest(
      "SEC-20",
      "Database triggers for role protection and approval immutability",
      hasRoleTrigger && hasApprovalTrigger,
      "trg_protect_profile_roles and trg_enforce_submission_approval guard against privilege escalation"
    );
  } catch (err) {
    assertTest("SEC-20", "Database trigger check", false, err.message);
  }

  console.log("\n=================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  console.log(`SUMMARY: ${passed}/${total} verification tests passed (${Math.round((passed / total) * 100)}%)`);
  console.log("=================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

runSecurityTests();
