import { createClient } from "@/lib/supabase/server";

export type ProjectStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "IN_REVIEW" | "COMPLETED" | "CANCELLED";
export type ProjectPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ProjectListItem {
  id: string;
  code: string;
  title: string;
  description: string | null;
  department_id: string;
  department_name: string;
  department_code: string;
  department_color: string;
  manager_id: string | null;
  manager_name: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  start_date: string | null;
  deadline: string | null;
  progress: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  member_count: number;
  task_count: number;
  completed_task_count: number;
}

export interface ProjectFilter {
  status?: string;
  priority?: string;
  departmentId?: string;
  search?: string;
}

/**
 * Server Data-Access: Retrieves projects with department, manager, and counts.
 * RLS automatically scopes access:
 * - SUPER_ADMIN: sees all projects
 * - COORDINATOR / MEMBER: sees projects in their department or projects they belong to
 */
export async function getProjects(filter?: ProjectFilter): Promise<ProjectListItem[]> {
  const supabase = await createClient();

  // 1. Fetch projects
  let query = (supabase.from("projects") as any)
    .select(`
      id,
      code,
      title,
      description,
      department_id,
      manager_id,
      status,
      priority,
      start_date,
      deadline,
      progress,
      created_by,
      created_at,
      updated_at
    `)
    .order("created_at", { ascending: false });

  if (filter?.status && filter.status !== "ALL") {
    query = query.eq("status", filter.status);
  }
  if (filter?.priority && filter.priority !== "ALL") {
    query = query.eq("priority", filter.priority);
  }
  if (filter?.departmentId && filter.departmentId !== "ALL") {
    query = query.eq("department_id", filter.departmentId);
  }

  const { data: projects, error: projErr } = await query;
  if (projErr || !projects) {
    console.error("Error fetching projects:", projErr);
    return [];
  }

  if (projects.length === 0) {
    return [];
  }

  // 2. Fetch departments
  const { data: depts } = await (supabase.from("departments") as any)
    .select("id, name, code, color");

  const deptMap: Record<string, { name: string; code: string; color: string }> = {};
  if (depts) {
    depts.forEach((d: any) => {
      deptMap[d.id] = { name: d.name, code: d.code, color: d.color };
    });
  }

  // 3. Fetch managers
  const managerIds = projects.map((p: any) => p.manager_id).filter(Boolean);
  const managerMap: Record<string, string> = {};
  if (managerIds.length > 0) {
    const { data: managers } = await (supabase.from("profiles") as any)
      .select("id, full_name")
      .in("id", managerIds);

    if (managers) {
      managers.forEach((m: any) => {
        managerMap[m.id] = m.full_name;
      });
    }
  }

  // 4. Fetch project member counts
  const { data: projMembers } = await (supabase.from("project_members") as any)
    .select("project_id");

  const memberCountMap: Record<string, number> = {};
  if (projMembers) {
    projMembers.forEach((pm: any) => {
      memberCountMap[pm.project_id] = (memberCountMap[pm.project_id] || 0) + 1;
    });
  }

  // 5. Fetch project tasks counts
  const { data: tasks } = await (supabase.from("tasks") as any)
    .select("project_id, status");

  const taskCountMap: Record<string, { total: number; completed: number }> = {};
  if (tasks) {
    tasks.forEach((t: any) => {
      if (!t.project_id) return;
      if (!taskCountMap[t.project_id]) {
        taskCountMap[t.project_id] = { total: 0, completed: 0 };
      }
      taskCountMap[t.project_id].total += 1;
      if (t.status === "DONE" || t.status === "APPROVED") {
        taskCountMap[t.project_id].completed += 1;
      }
    });
  }

  let list: ProjectListItem[] = projects.map((p: any) => {
    const dept = deptMap[p.department_id] || { name: "Pôle Inconnu", code: "UEC", color: "#2563EB" };
    const taskStats = taskCountMap[p.id] || { total: 0, completed: 0 };

    return {
      id: p.id,
      code: p.code,
      title: p.title,
      description: p.description,
      department_id: p.department_id,
      department_name: dept.name,
      department_code: dept.code,
      department_color: dept.color,
      manager_id: p.manager_id,
      manager_name: p.manager_id ? managerMap[p.manager_id] || "Non assigné" : "Non assigné",
      status: p.status as ProjectStatus,
      priority: p.priority as ProjectPriority,
      start_date: p.start_date,
      deadline: p.deadline,
      progress: p.progress,
      created_by: p.created_by,
      created_at: p.created_at,
      updated_at: p.updated_at,
      member_count: memberCountMap[p.id] || 0,
      task_count: taskStats.total,
      completed_task_count: taskStats.completed,
    };
  });

  if (filter?.search) {
    const s = filter.search.toLowerCase().trim();
    list = list.filter(
      (p) =>
        p.title.toLowerCase().includes(s) ||
        p.code.toLowerCase().includes(s) ||
        (p.description && p.description.toLowerCase().includes(s)) ||
        p.department_name.toLowerCase().includes(s)
    );
  }

  return list;
}

/**
 * Server Data-Access: Retrieves single project by ID with members list.
 */
export async function getProjectById(projectId: string) {
  const supabase = await createClient();

  const { data: project, error } = await (supabase.from("projects") as any)
    .select(`
      *,
      departments (id, name, code, color)
    `)
    .eq("id", projectId)
    .single();

  if (error || !project) {
    return null;
  }

  // Fetch project members
  const { data: members } = await (supabase.from("project_members") as any)
    .select(`
      id,
      role_in_project,
      assigned_at,
      user_id,
      profiles (id, full_name, email, role, avatar_url)
    `)
    .eq("project_id", projectId);

  return {
    ...project,
    members: members || [],
  };
}
