import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/auth/rbac";

export interface MemberListItem {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  phone: string | null;
  bio: string | null;
  department_id: string | null;
  department_name: string | null;
  department_code: string | null;
  created_at: string;
  joined_at: string | null;
}

export interface GetMembersFilter {
  departmentId?: string;
  role?: UserRole;
  search?: string;
  isActive?: boolean;
}

/**
 * Server Data-Access: Retrieves profiles with department affiliations.
 * Respects RLS and current user permissions.
 */
export async function getMembers(filter?: GetMembersFilter): Promise<MemberListItem[]> {
  const supabase = await createClient();

  // 1. Query profiles
  let query = (supabase.from("profiles") as any)
    .select(`
      id,
      email,
      full_name,
      avatar_url,
      role,
      is_active,
      phone,
      bio,
      created_at
    `)
    .order("full_name", { ascending: true });

  if (filter?.role) {
    query = query.eq("role", filter.role);
  }
  if (filter?.isActive !== undefined) {
    query = query.eq("is_active", filter.isActive);
  }

  const { data: profiles, error: profileErr } = await query;
  if (profileErr || !profiles) {
    console.error("Error fetching profiles:", profileErr);
    return [];
  }

  // 2. Fetch department memberships
  const { data: deptMembers } = await (supabase.from("department_members") as any)
    .select(`
      user_id,
      joined_at,
      department_id,
      departments (
        id,
        name,
        code
      )
    `);

  const deptMap: Record<string, { id: string; name: string; code: string; joined_at: string }> = {};
  if (deptMembers) {
    deptMembers.forEach((dm: any) => {
      if (dm.departments) {
        deptMap[dm.user_id] = {
          id: dm.department_id,
          name: dm.departments.name,
          code: dm.departments.code,
          joined_at: dm.joined_at,
        };
      }
    });
  }

  // 3. Assemble and apply memory/text filters
  let list: MemberListItem[] = profiles.map((p: any) => {
    const deptInfo = deptMap[p.id];
    return {
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      role: p.role as UserRole,
      is_active: p.is_active,
      phone: p.phone,
      bio: p.bio,
      department_id: deptInfo?.id || null,
      department_name: deptInfo?.name || "Sans département",
      department_code: deptInfo?.code || null,
      created_at: p.created_at,
      joined_at: deptInfo?.joined_at || null,
    };
  });

  if (filter?.departmentId) {
    list = list.filter((m) => m.department_id === filter.departmentId);
  }

  if (filter?.search) {
    const s = filter.search.toLowerCase().trim();
    list = list.filter(
      (m) =>
        m.full_name.toLowerCase().includes(s) ||
        m.email.toLowerCase().includes(s) ||
        (m.department_name && m.department_name.toLowerCase().includes(s))
    );
  }

  return list;
}

/**
 * Server Data-Access: Retrieves a single member's profile by ID.
 */
export async function getMemberById(userId: string): Promise<MemberListItem | null> {
  const members = await getMembers();
  return members.find((m) => m.id === userId) || null;
}
