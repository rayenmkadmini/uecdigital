import { createClient } from "@/lib/supabase/server";
import { getDepartments } from "./departments";

export interface DepartmentMetric {
  id: string;
  name: string;
  code: string;
  color: string;
  memberCount: number;
  projectCount: number;
  taskCount: number;
  completedTaskCount: number;
  completionRate: number;
}

export interface ActivityLogItem {
  id: string;
  actor_id: string | null;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, any>;
  created_at: string;
}

export interface AnalyticsData {
  tasks: {
    total: number;
    todo: number;
    inProgress: number;
    inReview: number;
    completed: number;
    overdue: number;
    completionRate: number;
  };
  projects: {
    total: number;
    active: number;
    planning: number;
    completed: number;
  };
  approvals: {
    pendingCoordinator: number;
    pendingSuperAdmin: number;
    approved: number;
    rejected: number;
  };
  equipment: {
    total: number;
    available: number;
    loaned: number;
  };
  departments: DepartmentMetric[];
  recentActivity: ActivityLogItem[];
}

export async function getAnalyticsData(): Promise<AnalyticsData> {
  const supabase = await createClient();

  // 1. Fetch tasks
  const { data: tasksData } = await (supabase.from("tasks") as any).select(
    "id, status, deadline, department_id"
  );
  const tasks = tasksData || [];

  const now = new Date();
  let overdueCount = 0;
  let todoCount = 0;
  let inProgressCount = 0;
  let inReviewCount = 0;
  let completedCount = 0;

  for (const t of tasks) {
    if (t.status === "DONE" || t.status === "APPROVED") {
      completedCount++;
    } else {
      if (t.status === "TODO") todoCount++;
      else if (t.status === "IN_PROGRESS") inProgressCount++;
      else if (t.status === "IN_REVIEW") inReviewCount++;

      if (t.deadline && new Date(t.deadline) < now) {
        overdueCount++;
      }
    }
  }

  const completionRate =
    tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  // 2. Fetch projects
  const { data: projectsData } = await (supabase.from("projects") as any).select(
    "id, status"
  );
  const projects = projectsData || [];

  const activeProjects = projects.filter((p: any) => p.status === "ACTIVE").length;
  const planningProjects = projects.filter((p: any) => p.status === "PLANNING").length;
  const completedProjects = projects.filter((p: any) => p.status === "COMPLETED").length;

  // 3. Fetch submissions
  const { data: submissionsData } = await (supabase.from("task_submissions") as any).select(
    "id, status"
  );
  const subs = submissionsData || [];

  const pendingCoord = subs.filter((s: any) => s.status === "PENDING_COORDINATOR").length;
  const pendingAdmin = subs.filter((s: any) => s.status === "PENDING_SUPER_ADMIN").length;
  const approvedSubs = subs.filter((s: any) => s.status === "APPROVED").length;
  const rejectedSubs = subs.filter((s: any) => s.status === "REJECTED").length;

  // 4. Fetch equipment
  const { data: equipData } = await (supabase.from("equipment") as any).select(
    "id, status"
  );
  const equip = equipData || [];
  const availableEquip = equip.filter((e: any) => e.status === "AVAILABLE").length;
  const loanedEquip = equip.filter((e: any) => e.status === "LOANED" || e.status === "BORROWED").length;

  // 5. Department metrics
  const depts = await getDepartments();
  const departmentMetrics: DepartmentMetric[] = depts.map((d) => {
    const deptTasks = tasks.filter((t: any) => t.department_id === d.id);
    const deptDone = deptTasks.filter(
      (t: any) => t.status === "DONE" || t.status === "APPROVED"
    ).length;
    const rate = deptTasks.length > 0 ? Math.round((deptDone / deptTasks.length) * 100) : 0;

    return {
      id: d.id,
      name: d.name,
      code: d.code,
      color: d.color,
      memberCount: d.member_count,
      projectCount: d.project_count,
      taskCount: deptTasks.length,
      completedTaskCount: deptDone,
      completionRate: rate,
    };
  });

  // 6. Recent activity logs
  const { data: logsData } = await (supabase.from("activity_logs") as any)
    .select(`
      id,
      actor_id,
      action,
      entity_type,
      entity_id,
      details,
      created_at
    `)
    .order("created_at", { ascending: false })
    .limit(15);

  const actorIds = Array.from(new Set((logsData || []).map((l: any) => l.actor_id).filter(Boolean)));
  const profileMap = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await (supabase.from("profiles") as any)
      .select("id, full_name")
      .in("id", actorIds);
    for (const p of profiles || []) {
      profileMap.set(p.id, p.full_name);
    }
  }

  const recentActivity: ActivityLogItem[] = (logsData || []).map((l: any) => ({
    id: l.id,
    actor_id: l.actor_id,
    actor_name: l.actor_id ? profileMap.get(l.actor_id) || "Membre" : "Système UEC",
    action: l.action,
    entity_type: l.entity_type,
    entity_id: l.entity_id,
    details: l.details || {},
    created_at: l.created_at,
  }));

  return {
    tasks: {
      total: tasks.length,
      todo: todoCount,
      inProgress: inProgressCount,
      inReview: inReviewCount,
      completed: completedCount,
      overdue: overdueCount,
      completionRate,
    },
    projects: {
      total: projects.length,
      active: activeProjects,
      planning: planningProjects,
      completed: completedProjects,
    },
    approvals: {
      pendingCoordinator: pendingCoord,
      pendingSuperAdmin: pendingAdmin,
      approved: approvedSubs,
      rejected: rejectedSubs,
    },
    equipment: {
      total: equip.length,
      available: availableEquip,
      loaned: loanedEquip,
    },
    departments: departmentMetrics,
    recentActivity,
  };
}
