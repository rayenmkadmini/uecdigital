import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export interface DepartmentWithStats {
  id: string;
  name: string;
  code: string;
  description: string | null;
  icon: string;
  color: string;
  coordinator_id: string | null;
  coordinator_name: string | null;
  is_active: boolean;
  member_count: number;
  project_count: number;
  active_task_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Server Data-Access: Retrieves all departments with aggregated counts.
 * Respects RLS (all authenticated users have SELECT permission on departments).
 */
export async function getDepartments(): Promise<DepartmentWithStats[]> {
  const supabase = await createClient();

  // 1. Fetch departments
  const { data: depts, error: deptErr } = await (supabase.from("departments") as any)
    .select(`
      id,
      name,
      code,
      description,
      icon,
      color,
      coordinator_id,
      is_active,
      created_at,
      updated_at
    `)
    .order("name", { ascending: true });

  if (deptErr || !depts) {
    console.error("Error fetching departments:", deptErr);
    return [];
  }

  // 2. Fetch coordinator profiles if any
  const coordinatorIds = depts
    .map((d: any) => d.coordinator_id)
    .filter(Boolean) as string[];

  let coordinatorMap: Record<string, string> = {};
  if (coordinatorIds.length > 0) {
    const { data: coords } = await (supabase.from("profiles") as any)
      .select("id, full_name")
      .in("id", coordinatorIds);

    if (coords) {
      coords.forEach((c: any) => {
        coordinatorMap[c.id] = c.full_name;
      });
    }
  }

  // 3. Fetch member counts per department
  const { data: memberCounts } = await (supabase.from("department_members") as any)
    .select("department_id");

  const memberCountMap: Record<string, number> = {};
  if (memberCounts) {
    memberCounts.forEach((m: any) => {
      memberCountMap[m.department_id] = (memberCountMap[m.department_id] || 0) + 1;
    });
  }

  // 4. Fetch project counts per department
  const { data: projectCounts } = await (supabase.from("projects") as any)
    .select("department_id, status");

  const projectCountMap: Record<string, number> = {};
  if (projectCounts) {
    projectCounts.forEach((p: any) => {
      projectCountMap[p.department_id] = (projectCountMap[p.department_id] || 0) + 1;
    });
  }

  // 5. Fetch active task counts per department
  const { data: taskCounts } = await (supabase.from("tasks") as any)
    .select("department_id, status");

  const taskCountMap: Record<string, number> = {};
  if (taskCounts) {
    taskCounts.forEach((t: any) => {
      if (t.status !== "DONE" && t.status !== "CANCELLED") {
        taskCountMap[t.department_id] = (taskCountMap[t.department_id] || 0) + 1;
      }
    });
  }

  return depts.map((d: any) => ({
    id: d.id,
    name: d.name,
    code: d.code,
    description: d.description,
    icon: d.icon,
    color: d.color,
    coordinator_id: d.coordinator_id,
    coordinator_name: d.coordinator_id ? coordinatorMap[d.coordinator_id] || "Non assigné" : "Non assigné",
    is_active: d.is_active,
    member_count: memberCountMap[d.id] || 0,
    project_count: projectCountMap[d.id] || 0,
    active_task_count: taskCountMap[d.id] || 0,
    created_at: d.created_at,
    updated_at: d.updated_at,
  }));
}

/**
 * Server Data-Access: Retrieves a single department by its ID or Code.
 */
export async function getDepartmentById(idOrCode: string): Promise<DepartmentWithStats | null> {
  const depts = await getDepartments();
  return depts.find((d) => d.id === idOrCode || d.code.toUpperCase() === idOrCode.toUpperCase()) || null;
}
