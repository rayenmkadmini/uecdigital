import { createClient } from "@/lib/supabase/server";

export type ContentPlatform =
  | "INSTAGRAM"
  | "FACEBOOK"
  | "TIKTOK"
  | "LINKEDIN"
  | "TWITTER"
  | "YOUTUBE"
  | "WEBSITE"
  | "OTHER";

export type ContentType =
  | "POST"
  | "REEL"
  | "STORY"
  | "ARTICLE"
  | "COMMUNIQUE"
  | "VIDEO"
  | "CAROUSEL";

export type CalendarWorkflowStatus =
  | "IDEA"
  | "DRAFT"
  | "IN_DESIGN"
  | "IN_REVIEW"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHED"
  | "CANCELLED";

export function toDbCalendarStatus(status: string): string {
  switch (status) {
    case "IN_DESIGN":
      return "DESIGN";
    case "IN_REVIEW":
      return "REVIEW";
    case "APPROVED":
      return "SUPER_ADMIN_APPROVAL";
    default:
      return status;
  }
}

export function fromDbCalendarStatus(status: string): CalendarWorkflowStatus {
  switch (status) {
    case "DESIGN":
      return "IN_DESIGN";
    case "REVIEW":
      return "IN_REVIEW";
    case "SUPER_ADMIN_APPROVAL":
      return "APPROVED";
    default:
      return (status as CalendarWorkflowStatus) || "IDEA";
  }
}

export function toDbPlatform(platform: string): string {
  if (platform === "TWITTER") return "OTHER";
  return platform;
}

export interface CalendarItem {
  id: string;
  title: string;
  description: string | null;
  platform: ContentPlatform;
  content_type: ContentType;
  scheduled_date: string;
  published_date: string | null;
  published_url: string | null;
  designer_id: string | null;
  designer_name: string | null;
  writer_id: string | null;
  writer_name: string | null;
  status: CalendarWorkflowStatus;
  attachments: Array<{ name: string; url: string; size?: number }> | null;
  approved_by: string | null;
  approver_name: string | null;
  created_by: string;
  creator_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarFilter {
  platform?: string;
  status?: string;
  contentType?: string;
  month?: number; // 1-12
  year?: number;
  search?: string;
}

export async function getCalendarItems(filter?: CalendarFilter): Promise<CalendarItem[]> {
  const supabase = await createClient();

  let query = (supabase.from("content_calendar") as any)
    .select(`
      id,
      title,
      description,
      platform,
      content_type,
      scheduled_date,
      published_date,
      published_url,
      designer_id,
      writer_id,
      status,
      attachments,
      approved_by,
      created_by,
      created_at,
      updated_at
    `)
    .order("scheduled_date", { ascending: true });

  if (filter?.platform && filter.platform !== "ALL") {
    query = query.eq("platform", filter.platform);
  }

  if (filter?.status && filter.status !== "ALL") {
    query = query.eq("status", toDbCalendarStatus(filter.status));
  }

  if (filter?.contentType && filter.contentType !== "ALL") {
    query = query.eq("content_type", filter.contentType);
  }

  if (filter?.search?.trim()) {
    query = query.ilike("title", `%${filter.search.trim()}%`);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error("Error fetching content_calendar:", error);
    return [];
  }

  // Collect distinct profile IDs for name resolution
  const userIds = new Set<string>();
  for (const item of data) {
    if (item.designer_id) userIds.add(item.designer_id);
    if (item.writer_id) userIds.add(item.writer_id);
    if (item.approved_by) userIds.add(item.approved_by);
    if (item.created_by) userIds.add(item.created_by);
  }

  const profileMap = new Map<string, string>();
  if (userIds.size > 0) {
    const { data: profiles } = await (supabase.from("profiles") as any)
      .select("id, full_name")
      .in("id", Array.from(userIds));

    for (const p of profiles || []) {
      profileMap.set(p.id, p.full_name);
    }
  }

  return data.map((item: any) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    platform: item.platform as ContentPlatform,
    content_type: (item.content_type || "POST") as ContentType,
    scheduled_date: item.scheduled_date,
    published_date: item.published_date,
    published_url: item.published_url,
    designer_id: item.designer_id,
    designer_name: item.designer_id ? profileMap.get(item.designer_id) || null : null,
    writer_id: item.writer_id,
    writer_name: item.writer_id ? profileMap.get(item.writer_id) || null : null,
    status: fromDbCalendarStatus(item.status),
    attachments: Array.isArray(item.attachments) ? item.attachments : [],
    approved_by: item.approved_by,
    approver_name: item.approved_by ? profileMap.get(item.approved_by) || null : null,
    created_by: item.created_by,
    creator_name: item.created_by ? profileMap.get(item.created_by) || null : null,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }));
}

export async function getCalendarStats(): Promise<{
  total: number;
  scheduled: number;
  published: number;
  inReview: number;
}> {
  const items = await getCalendarItems();
  return {
    total: items.length,
    scheduled: items.filter((i) => i.status === "SCHEDULED").length,
    published: items.filter((i) => i.status === "PUBLISHED").length,
    inReview: items.filter((i) => i.status === "IN_REVIEW" || i.status === "IN_DESIGN").length,
  };
}
