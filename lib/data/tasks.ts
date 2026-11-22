import { createClient } from "@/lib/supabase/server";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TaskStatus =
  | "BACKLOG"
  | "TODO"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "COORDINATOR_REVIEW"
  | "SUPER_ADMIN_APPROVAL"
  | "APPROVED"
  | "REVISION_REQUIRED"
  | "REJECTED"
  | "DONE"
  | "CANCELLED";

export interface TaskAssigneeInfo {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface TaskListItem {
  id: string;
  project_id: string | null;
  project_title: string | null;
  project_code: string | null;
  department_id: string;
  department_name: string;
  department_code: string;
  department_color: string;
  title: string;
  description: string | null;
  acceptance_criteria: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  start_date: string | null;
  deadline: string | null;
  created_by: string | null;
  creator_name: string | null;
  coordinator_id: string | null;
  created_at: string;
  updated_at: string;
  assignees: TaskAssigneeInfo[];
}

export interface TaskFilter {
  projectId?: string;
  departmentId?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  search?: string;
}

/**
 * Server Data-Access: Retrieves tasks with assignees, project, and department.
 * RLS scopes access:
 * - SUPER_ADMIN: sees all tasks
 * - COORDINATOR / MEMBER: sees tasks in their department or tasks assigned to them
 */
export async function getTasks(filter?: TaskFilter): Promise<TaskListItem[]> {
  const supabase = await createClient();

  // 1. Fetch tasks
  let query = (supabase.from("tasks") as any)
    .select(`
      id,
      project_id,
      department_id,
      title,
      description,
      acceptance_criteria,
      priority,
      status,
      start_date,
      deadline,
      created_by,
      coordinator_id,
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
  if (filter?.projectId && filter.projectId !== "ALL") {
    query = query.eq("project_id", filter.projectId);
  }

  const { data: tasks, error: taskErr } = await query;
  if (taskErr || !tasks) {
    console.error("Error fetching tasks:", taskErr);
    return [];
  }

  if (tasks.length === 0) {
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

  // 3. Fetch projects
  const projectIds = tasks.map((t: any) => t.project_id).filter(Boolean);
  const projectMap: Record<string, { title: string; code: string }> = {};
  if (projectIds.length > 0) {
    const { data: projects } = await (supabase.from("projects") as any)
      .select("id, title, code")
      .in("id", projectIds);

    if (projects) {
      projects.forEach((p: any) => {
        projectMap[p.id] = { title: p.title, code: p.code };
      });
    }
  }

  // 4. Fetch task assignees with user profiles
  const taskIds = tasks.map((t: any) => t.id);
  const { data: assignees } = await (supabase.from("task_assignees") as any)
    .select(`
      id,
      task_id,
      user_id,
      profiles (
        id,
        full_name,
        avatar_url
      )
    `)
    .in("task_id", taskIds);

  const assigneesByTask: Record<string, TaskAssigneeInfo[]> = {};
  if (assignees) {
    assignees.forEach((a: any) => {
      if (!assigneesByTask[a.task_id]) {
        assigneesByTask[a.task_id] = [];
      }
      if (a.profiles) {
        assigneesByTask[a.task_id].push({
          id: a.id,
          user_id: a.user_id,
          full_name: a.profiles.full_name,
          avatar_url: a.profiles.avatar_url,
        });
      }
    });
  }

  let list: TaskListItem[] = tasks.map((t: any) => {
    const dept = deptMap[t.department_id] || { name: "Pôle Inconnu", code: "UEC", color: "#2563EB" };
    const proj = t.project_id ? projectMap[t.project_id] : null;

    return {
      id: t.id,
      project_id: t.project_id,
      project_title: proj?.title || null,
      project_code: proj?.code || null,
      department_id: t.department_id,
      department_name: dept.name,
      department_code: dept.code,
      department_color: dept.color,
      title: t.title,
      description: t.description,
      acceptance_criteria: t.acceptance_criteria,
      priority: t.priority as TaskPriority,
      status: t.status as TaskStatus,
      start_date: t.start_date,
      deadline: t.deadline,
      created_by: t.created_by,
      creator_name: null,
      coordinator_id: t.coordinator_id,
      created_at: t.created_at,
      updated_at: t.updated_at,
      assignees: assigneesByTask[t.id] || [],
    };
  });

  if (filter?.assigneeId) {
    list = list.filter((t) => t.assignees.some((a) => a.user_id === filter.assigneeId));
  }

  if (filter?.search) {
    const s = filter.search.toLowerCase().trim();
    list = list.filter(
      (t) =>
        t.title.toLowerCase().includes(s) ||
        (t.description && t.description.toLowerCase().includes(s)) ||
        (t.project_title && t.project_title.toLowerCase().includes(s)) ||
        t.department_name.toLowerCase().includes(s) ||
        t.assignees.some((a) => a.full_name.toLowerCase().includes(s))
    );
  }

  return list;
}

/**
 * Server Data-Access: Retrieves single task by ID with comments and submissions.
 */
export async function getTaskById(taskId: string) {
  const supabase = await createClient();

  const { data: task, error } = await (supabase.from("tasks") as any)
    .select(`
      *,
      departments (id, name, code, color),
      projects (id, title, code)
    `)
    .eq("id", taskId)
    .single();

  if (error || !task) {
    return null;
  }

  // Fetch assignees
  const { data: assignees } = await (supabase.from("task_assignees") as any)
    .select(`
      id,
      user_id,
      profiles (id, full_name, avatar_url, role)
    `)
    .eq("task_id", taskId);

  // Fetch comments
  const { data: comments } = await (supabase.from("task_comments") as any)
    .select(`
      id,
      content,
      created_at,
      user_id,
      profiles (id, full_name, avatar_url, role)
    `)
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  // Fetch submissions
  const { data: submissions } = await (supabase.from("task_submissions") as any)
    .select(`
      *,
      profiles:submitted_by (id, full_name)
    `)
    .eq("task_id", taskId)
    .order("version", { ascending: false });

  return {
    ...task,
    assignees: assignees || [],
    comments: comments || [],
    submissions: submissions || [],
  };
}
