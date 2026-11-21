import { createClient } from "@/lib/supabase/server";

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  is_read: boolean;
  metadata: Record<string, any>;
  created_at: string;
}

export async function getUserNotifications(limit = 20): Promise<NotificationItem[]> {
  const supabase = await createClient();

  const { data, error } = await (supabase.from("notifications") as any)
    .select(`
      id,
      user_id,
      title,
      message,
      type,
      link,
      is_read,
      metadata,
      created_at
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data.map((n: any) => ({
    id: n.id,
    user_id: n.user_id,
    title: n.title,
    message: n.message,
    type: n.type,
    link: n.link,
    is_read: n.is_read,
    metadata: n.metadata || {},
    created_at: n.created_at,
  }));
}

export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await (supabase.from("notifications") as any)
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);

  if (error || typeof count !== "number") {
    return 0;
  }

  return count;
}
