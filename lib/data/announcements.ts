import { createClient } from "@/lib/supabase/server";

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  target_audience: string;
  department_id: string | null;
  department_name: string | null;
  priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  is_pinned: boolean;
  published_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getAnnouncements(): Promise<AnnouncementItem[]> {
  const supabase = await createClient();

  const { data: rawAnnouncements, error } = await (supabase.from("announcements") as any)
    .select(`
      id,
      title,
      content,
      author_id,
      target_audience,
      department_id,
      priority,
      is_pinned,
      published_at,
      expires_at,
      created_at,
      updated_at
    `)
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false });

  if (error || !rawAnnouncements) {
    console.error("Error fetching announcements:", error);
    return [];
  }

  const authorIds = Array.from(new Set(rawAnnouncements.map((a: any) => a.author_id)));
  const deptIds = Array.from(new Set(rawAnnouncements.map((a: any) => a.department_id).filter(Boolean)));

  const profileMap = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: profiles } = await (supabase.from("profiles") as any)
      .select("id, full_name")
      .in("id", authorIds);
    for (const p of profiles || []) {
      profileMap.set(p.id, p.full_name);
    }
  }

  const deptMap = new Map<string, string>();
  if (deptIds.length > 0) {
    const { data: depts } = await (supabase.from("departments") as any)
      .select("id, name")
      .in("id", deptIds);
    for (const d of depts || []) {
      deptMap.set(d.id, d.name);
    }
  }

  return rawAnnouncements.map((a: any) => ({
    id: a.id,
    title: a.title,
    content: a.content,
    author_id: a.author_id,
    author_name: profileMap.get(a.author_id) || "Direction UEC",
    target_audience: a.target_audience,
    department_id: a.department_id,
    department_name: a.department_id ? deptMap.get(a.department_id) || null : null,
    priority: a.priority,
    is_pinned: a.is_pinned,
    published_at: a.published_at,
    expires_at: a.expires_at,
    created_at: a.created_at,
    updated_at: a.updated_at,
  }));
}
