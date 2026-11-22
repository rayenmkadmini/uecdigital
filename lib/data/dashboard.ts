import { createClient } from "@/lib/supabase/server";

export interface SuperAdminDashboardData {
  totalActiveMembers: number;
  totalDepartments: number;
  totalProjects: number;
  pendingApprovalsCount: number;
  pendingApprovals: {
    id: string;
    taskTitle: string;
    projectTitle: string;
    department: string;
    submittedBy: string;
    submittedAt: string;
    version: number;
    notes: string;
  }[];
  departmentBreakdown: {
    code: string;
    name: string;
    coordinator: string;
    activeProjects: number;
    pendingTasks: number;
    progress: number;
    color: string;
  }[];
}

export interface CoordinatorDashboardData {
  departmentName: string;
  departmentCode: string;
  memberCount: number;
  activeProjectCount: number;
  tasksAwaitingReviewCount: number;
  teamSubmissions: {
    id: string;
    taskTitle: string;
    assignee: string;
    submittedAt: string;
    version: number;
    description: string;
  }[];
  teamMembers: {
    id: string;
    name: string;
    role: string;
    email: string;
    avatarUrl: string | null;
    activeTaskCount: number;
  }[];
}

export interface MemberDashboardData {
  assignedTaskCount: number;
  upcomingDeadlineCount: number;
  submittedCount: number;
  approvedCount: number;
  revisionRequiredCount: number;
  myTasks: {
    id: string;
    title: string;
    project: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    dueDate: string;
    status: string;
  }[];
}

/**
 * Server Data-Access: Aggregates REAL database metrics for Super Admin.
 */
export async function getSuperAdminDashboardData(): Promise<SuperAdminDashboardData> {
  const supabase = await createClient();

  // 1. Total active members
  const { count: memberCount } = await (supabase.from("profiles") as any)
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  // 2. Total departments
  const { count: deptCount } = await (supabase.from("departments") as any)
    .select("*", { count: "exact", head: true });

  // 3. Total active projects
  const { count: projCount } = await (supabase.from("projects") as any)
    .select("*", { count: "exact", head: true })
    .in("status", ["PLANNING", "ACTIVE", "IN_REVIEW"]);

  // 4. Pending final approvals from task_submissions (status = 'PENDING_SUPER_ADMIN')
  const { data: rawSubmissions } = await (supabase.from("task_submissions") as any)
    .select(`
      id,
      title,
      description,
      version,
      status,
      created_at,
      coordinateur_notes,
      submitted_by,
      tasks:task_id (
        id,
        title,
        project_id,
        department_id,
        projects:project_id (title),
        departments:department_id (name)
      ),
      profiles:submitted_by (full_name)
    `)
    .in("status", ["PENDING_SUPER_ADMIN", "SUPER_ADMIN_APPROVAL"])
    .order("created_at", { ascending: false });

  const pendingApprovals = (rawSubmissions || []).map((sub: any) => ({
    id: sub.id,
    taskTitle: sub.tasks?.title || sub.title,
    projectTitle: sub.tasks?.projects?.title || "Projet Général",
    department: sub.tasks?.departments?.name || "Département Digital",
    submittedBy: sub.profiles?.full_name || "Membre UEC",
    submittedAt: new Date(sub.created_at).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
    version: sub.version,
    notes: sub.coordinateur_notes || sub.description || "Soumis pour validation finale",
  }));

  // 5. Department breakdown from departments table
  const { data: depts } = await (supabase.from("departments") as any)
    .select(`
      id,
      code,
      name,
      color,
      coordinator:coordinator_id (full_name)
    `);

  const { data: allProjects } = await (supabase.from("projects") as any)
    .select("id, department_id, status, progress");

  const { data: allTasks } = await (supabase.from("tasks") as any)
    .select("id, department_id, status");

  const departmentBreakdown = (depts || []).map((d: any) => {
    const deptProjects = (allProjects || []).filter((p: any) => p.department_id === d.id);
    const activeProjects = deptProjects.filter((p: any) => p.status === "ACTIVE" || p.status === "IN_REVIEW").length;
    const avgProgress =
      deptProjects.length > 0
        ? Math.round(deptProjects.reduce((acc: number, p: any) => acc + (p.progress || 0), 0) / deptProjects.length)
        : 0;

    const deptTasks = (allTasks || []).filter((t: any) => t.department_id === d.id);
    const pendingTasks = deptTasks.filter((t: any) => t.status !== "DONE" && t.status !== "CANCELLED").length;

    return {
      code: d.code,
      name: d.name,
      coordinator: d.coordinator?.full_name || "Non assigné",
      activeProjects,
      pendingTasks,
      progress: avgProgress,
      color: d.color,
    };
  });

  return {
    totalActiveMembers: memberCount || 0,
    totalDepartments: deptCount || 0,
    totalProjects: projCount || 0,
    pendingApprovalsCount: pendingApprovals.length,
    pendingApprovals,
    departmentBreakdown,
  };
}

/**
 * Server Data-Access: Aggregates REAL database metrics for a Coordinator.
 */
export async function getCoordinatorDashboardData(
  departmentId: string,
  deptName: string,
  deptCode: string
): Promise<CoordinatorDashboardData> {
  const supabase = await createClient();

  // 1. Department members count & list
  const { data: rawDeptMembers } = await (supabase.from("department_members") as any)
    .select(`
      user_id,
      profiles:user_id (id, full_name, email, role, avatar_url)
    `)
    .eq("department_id", departmentId);

  // 2. Active projects in department
  const { count: activeProjCount } = await (supabase.from("projects") as any)
    .select("*", { count: "exact", head: true })
    .eq("department_id", departmentId)
    .in("status", ["PLANNING", "ACTIVE", "IN_REVIEW"]);

  // 3. Submissions awaiting coordinator review (status = 'COORDINATOR_REVIEW')
  const { data: rawSubmissions } = await (supabase.from("task_submissions") as any)
    .select(`
      id,
      title,
      description,
      version,
      status,
      created_at,
      submitted_by,
      tasks:task_id!inner (
        id,
        title,
        department_id
      ),
      profiles:submitted_by (full_name)
    `)
    .eq("tasks.department_id", departmentId)
    .in("status", ["PENDING_COORDINATOR", "COORDINATOR_REVIEW"])
    .order("created_at", { ascending: false });

  const teamSubmissions = (rawSubmissions || []).map((sub: any) => ({
    id: sub.id,
    taskTitle: sub.tasks?.title || sub.title,
    assignee: sub.profiles?.full_name || "Membre",
    submittedAt: new Date(sub.created_at).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
    version: sub.version,
    description: sub.description || "Livrable prêt pour revue technique",
  }));

  // 4. Tasks assigned per member in this department
  const { data: rawAssignees } = await (supabase.from("task_assignees") as any)
    .select(`
      user_id,
      tasks:task_id!inner (department_id, status)
    `)
    .eq("tasks.department_id", departmentId);

  const activeTaskCountByMember: Record<string, number> = {};
  if (rawAssignees) {
    rawAssignees.forEach((a: any) => {
      if (a.tasks?.status !== "DONE" && a.tasks?.status !== "CANCELLED") {
        activeTaskCountByMember[a.user_id] = (activeTaskCountByMember[a.user_id] || 0) + 1;
      }
    });
  }

  const teamMembers = (rawDeptMembers || []).map((dm: any) => ({
    id: dm.profiles?.id || dm.user_id,
    name: dm.profiles?.full_name || "Membre UEC",
    role: dm.profiles?.role || "MEMBER",
    email: dm.profiles?.email || "",
    avatarUrl: dm.profiles?.avatar_url || null,
    activeTaskCount: activeTaskCountByMember[dm.user_id] || 0,
  }));

  return {
    departmentName: deptName,
    departmentCode: deptCode,
    memberCount: teamMembers.length,
    activeProjectCount: activeProjCount || 0,
    tasksAwaitingReviewCount: teamSubmissions.length,
    teamSubmissions,
    teamMembers,
  };
}

/**
 * Server Data-Access: Aggregates REAL database metrics for a Member.
 */
export async function getMemberDashboardData(userId: string): Promise<MemberDashboardData> {
  const supabase = await createClient();

  // 1. My assigned tasks
  const { data: rawTasks } = await (supabase.from("task_assignees") as any)
    .select(`
      task_id,
      tasks:task_id (
        id,
        title,
        priority,
        status,
        deadline,
        projects:project_id (title)
      )
    `)
    .eq("user_id", userId);

  const myTasksList = (rawTasks || [])
    .map((rt: any) => rt.tasks)
    .filter(Boolean);

  const activeTasks = myTasksList.filter((t: any) => t.status !== "DONE" && t.status !== "CANCELLED");
  const completedTasks = myTasksList.filter((t: any) => t.status === "DONE" || t.status === "APPROVED");

  // Upcoming deadlines in next 48 hours
  const now = new Date();
  const next48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const upcomingDeadlines = activeTasks.filter((t: any) => {
    if (!t.deadline) return false;
    const d = new Date(t.deadline);
    return d >= now && d <= next48h;
  });

  // 2. My submissions
  const { data: submissions } = await (supabase.from("task_submissions") as any)
    .select("id, status")
    .eq("submitted_by", userId);

  const submittedCount = (submissions || []).filter(
    (s: any) =>
      s.status === "PENDING_COORDINATOR" ||
      s.status === "COORDINATOR_REVIEW" ||
      s.status === "PENDING_SUPER_ADMIN" ||
      s.status === "SUPER_ADMIN_APPROVAL"
  ).length;

  const revisionCount = (submissions || []).filter((s: any) => s.status === "REVISION_REQUIRED").length;

  const formattedTasks = activeTasks.slice(0, 10).map((t: any) => ({
    id: t.id,
    title: t.title,
    project: t.projects?.title || "Projet Général",
    priority: t.priority as any,
    dueDate: t.deadline
      ? new Date(t.deadline).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Non définie",
    status: t.status,
  }));

  return {
    assignedTaskCount: activeTasks.length,
    upcomingDeadlineCount: upcomingDeadlines.length,
    submittedCount,
    approvedCount: completedTasks.length,
    revisionRequiredCount: revisionCount,
    myTasks: formattedTasks,
  };
}
