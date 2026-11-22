import { createClient } from "@/lib/supabase/server";

export type RequestCategory =
  | "DESIGN"
  | "VIDEO"
  | "WEB"
  | "PHOTO"
  | "LOGISTICS"
  | "COMMUNICATION"
  | "GENERAL";

export type RequestPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type RequestStatus =
  | "NEW"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "REJECTED"
  | "CONVERTED_TO_TASK";

export function toDbRequestCategory(cat: string): string {
  switch (cat) {
    case "DESIGN":
      return "DESIGN_REQUEST";
    case "VIDEO":
      return "VIDEO_REQUEST";
    case "PHOTO":
      return "PHOTOGRAPHY_REQUEST";
    case "WEB":
      return "DEVELOPMENT_REQUEST";
    case "LOGISTICS":
      return "TECHNICAL_SUPPORT";
    case "COMMUNICATION":
      return "DIGITAL_STRATEGY";
    case "GENERAL":
      return "OTHER";
    default:
      return cat;
  }
}

export function fromDbRequestCategory(cat: string): RequestCategory {
  switch (cat) {
    case "DESIGN_REQUEST":
      return "DESIGN";
    case "VIDEO_REQUEST":
      return "VIDEO";
    case "PHOTOGRAPHY_REQUEST":
      return "PHOTO";
    case "DEVELOPMENT_REQUEST":
      return "WEB";
    case "TECHNICAL_SUPPORT":
      return "LOGISTICS";
    case "DIGITAL_STRATEGY":
      return "COMMUNICATION";
    case "OTHER":
      return "GENERAL";
    default:
      return (cat as RequestCategory) || "GENERAL";
  }
}

export function toDbRequestStatus(st: string): string {
  switch (st) {
    case "CONVERTED_TO_TASK":
      return "ASSIGNED";
    case "PENDING_REVIEW":
      return "UNDER_REVIEW";
    case "CANCELLED":
      return "CLOSED";
    default:
      return st;
  }
}

export function fromDbRequestStatus(st: string): RequestStatus {
  switch (st) {
    case "ASSIGNED":
      return "CONVERTED_TO_TASK";
    case "UNDER_REVIEW":
      return "ACCEPTED";
    case "CLOSED":
      return "COMPLETED";
    default:
      return (st as RequestStatus) || "NEW";
  }
}

export interface ServiceRequestListItem {
  id: string;
  code: string;
  title: string;
  description: string;
  category: RequestCategory;
  requesting_department_id: string | null;
  requesting_department_name: string | null;
  target_department_id: string;
  target_department_name: string;
  target_department_code: string;
  requester_id: string;
  requester_name: string;
  priority: RequestPriority;
  desired_deadline: string | null;
  attachments: Array<{ name: string; url: string; size?: number }> | null;
  status: RequestStatus;
  assigned_coordinator_id: string | null;
  assigned_coordinator_name: string | null;
  converted_task_id: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequestFilter {
  status?: string;
  category?: string;
  priority?: string;
  targetDepartmentId?: string;
  search?: string;
}

export async function getServiceRequests(filter?: RequestFilter): Promise<ServiceRequestListItem[]> {
  const supabase = await createClient();

  let query = (supabase.from("service_requests") as any)
    .select(`
      id,
      code,
      title,
      description,
      category,
      requesting_department_id,
      target_department_id,
      requester_id,
      priority,
      desired_deadline,
      attachments,
      status,
      assigned_coordinator_id,
      converted_task_id,
      rejection_reason,
      created_at,
      updated_at
    `)
    .order("created_at", { ascending: false });

  if (filter?.status && filter.status !== "ALL") {
    query = query.eq("status", toDbRequestStatus(filter.status));
  }

  if (filter?.category && filter.category !== "ALL") {
    query = query.eq("category", toDbRequestCategory(filter.category));
  }

  if (filter?.priority && filter.priority !== "ALL") {
    query = query.eq("priority", filter.priority);
  }

  if (filter?.targetDepartmentId && filter.targetDepartmentId !== "ALL") {
    query = query.eq("target_department_id", filter.targetDepartmentId);
  }

  if (filter?.search?.trim()) {
    query = query.or(`title.ilike.%${filter.search.trim()}%,code.ilike.%${filter.search.trim()}%`);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error("Error fetching service_requests:", error);
    return [];
  }

  // Fetch departments and profiles for mapping
  const deptIds = new Set<string>();
  const userIds = new Set<string>();

  for (const item of data) {
    if (item.target_department_id) deptIds.add(item.target_department_id);
    if (item.requesting_department_id) deptIds.add(item.requesting_department_id);
    if (item.requester_id) userIds.add(item.requester_id);
    if (item.assigned_coordinator_id) userIds.add(item.assigned_coordinator_id);
  }

  const deptMap = new Map<string, { name: string; code: string }>();
  if (deptIds.size > 0) {
    const { data: depts } = await (supabase.from("departments") as any)
      .select("id, name, code")
      .in("id", Array.from(deptIds));
    for (const d of depts || []) {
      deptMap.set(d.id, { name: d.name, code: d.code });
    }
  }

  const userMap = new Map<string, string>();
  if (userIds.size > 0) {
    const { data: profiles } = await (supabase.from("profiles") as any)
      .select("id, full_name")
      .in("id", Array.from(userIds));
    for (const p of profiles || []) {
      userMap.set(p.id, p.full_name);
    }
  }

  return data.map((item: any) => {
    const targetDept = deptMap.get(item.target_department_id);
    const reqDept = item.requesting_department_id ? deptMap.get(item.requesting_department_id) : null;

    return {
      id: item.id,
      code: item.code,
      title: item.title,
      description: item.description,
      category: fromDbRequestCategory(item.category),
      requesting_department_id: item.requesting_department_id,
      requesting_department_name: reqDept?.name || null,
      target_department_id: item.target_department_id,
      target_department_name: targetDept?.name || "Département",
      target_department_code: targetDept?.code || "UEC",
      requester_id: item.requester_id,
      requester_name: userMap.get(item.requester_id) || "Membre",
      priority: item.priority as RequestPriority,
      desired_deadline: item.desired_deadline,
      attachments: Array.isArray(item.attachments) ? item.attachments : [],
      status: fromDbRequestStatus(item.status),
      assigned_coordinator_id: item.assigned_coordinator_id,
      assigned_coordinator_name: item.assigned_coordinator_id
        ? userMap.get(item.assigned_coordinator_id) || null
        : null,
      converted_task_id: item.converted_task_id,
      rejection_reason: item.rejection_reason,
      created_at: item.created_at,
      updated_at: item.updated_at,
    };
  });
}
