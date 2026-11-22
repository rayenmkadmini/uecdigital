import { createClient } from "@/lib/supabase/server";

export type MeetingStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type AttendeeStatus = "INVITED" | "ACCEPTED" | "DECLINED" | "ATTENDED";

export interface MeetingAttendeeItem {
  id: string;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  status: AttendeeStatus;
}

export interface MeetingMinutesItem {
  id: string;
  meeting_id: string;
  recorded_by: string;
  recorder_name: string;
  content: string;
  decisions: string[];
  action_items: Array<{ text: string; assignee?: string; due_date?: string }>;
  created_at: string;
  updated_at: string;
}

export interface MeetingListItem {
  id: string;
  title: string;
  description: string | null;
  department_id: string | null;
  department_name: string | null;
  department_code: string | null;
  scheduled_at: string;
  duration_min: number;
  location: string | null;
  meeting_link: string | null;
  agenda: string[];
  status: MeetingStatus;
  created_by: string;
  creator_name: string;
  created_at: string;
  updated_at: string;
  attendees: MeetingAttendeeItem[];
  minutes: MeetingMinutesItem | null;
}

export interface MeetingFilter {
  status?: string;
  departmentId?: string;
  upcomingOnly?: boolean;
  search?: string;
}

export async function getMeetings(filter?: MeetingFilter): Promise<MeetingListItem[]> {
  const supabase = await createClient();

  let query = (supabase.from("meetings") as any)
    .select(`
      id,
      title,
      description,
      department_id,
      scheduled_at,
      duration_min,
      location,
      meeting_link,
      agenda,
      status,
      created_by,
      created_at,
      updated_at
    `)
    .order("scheduled_at", { ascending: true });

  if (filter?.status && filter.status !== "ALL") {
    query = query.eq("status", filter.status);
  }

  if (filter?.departmentId && filter.departmentId !== "ALL") {
    query = query.eq("department_id", filter.departmentId);
  }

  if (filter?.search?.trim()) {
    query = query.ilike("title", `%${filter.search.trim()}%`);
  }

  const { data: rawMeetings, error } = await query;
  if (error || !rawMeetings) {
    console.error("Error fetching meetings:", error);
    return [];
  }

  const meetingIds = rawMeetings.map((m: any) => m.id);
  const deptIds = Array.from(new Set(rawMeetings.map((m: any) => m.department_id).filter(Boolean)));
  const userIds = new Set<string>();

  for (const m of rawMeetings) {
    if (m.created_by) userIds.add(m.created_by);
  }

  // Fetch attendees
  let rawAttendees: any[] = [];
  if (meetingIds.length > 0) {
    const { data: attendeesData } = await (supabase.from("meeting_attendees") as any)
      .select("id, meeting_id, user_id, status")
      .in("meeting_id", meetingIds);
    if (attendeesData) {
      rawAttendees = attendeesData;
      for (const a of attendeesData) {
        if (a.user_id) userIds.add(a.user_id);
      }
    }
  }

  // Fetch minutes
  let rawMinutes: any[] = [];
  if (meetingIds.length > 0) {
    const { data: minutesData } = await (supabase.from("meeting_minutes") as any)
      .select("id, meeting_id, recorded_by, content, decisions, action_items, created_at, updated_at")
      .in("meeting_id", meetingIds);
    if (minutesData) {
      rawMinutes = minutesData;
      for (const min of minutesData) {
        if (min.recorded_by) userIds.add(min.recorded_by);
      }
    }
  }

  // Fetch department names
  const deptMap = new Map<string, { name: string; code: string }>();
  if (deptIds.length > 0) {
    const { data: depts } = await (supabase.from("departments") as any)
      .select("id, name, code")
      .in("id", deptIds);
    for (const d of depts || []) {
      deptMap.set(d.id, { name: d.name, code: d.code });
    }
  }

  // Fetch profiles
  const profileMap = new Map<string, { full_name: string; avatar_url: string | null }>();
  if (userIds.size > 0) {
    const { data: profiles } = await (supabase.from("profiles") as any)
      .select("id, full_name, avatar_url")
      .in("id", Array.from(userIds));
    for (const p of profiles || []) {
      profileMap.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url });
    }
  }

  // Assemble meetings
  return rawMeetings.map((m: any) => {
    const dept = m.department_id ? deptMap.get(m.department_id) : null;
    const creator = profileMap.get(m.created_by);

    const mAttendees: MeetingAttendeeItem[] = rawAttendees
      .filter((a) => a.meeting_id === m.id)
      .map((a) => {
        const u = profileMap.get(a.user_id);
        return {
          id: a.id,
          user_id: a.user_id,
          user_name: u?.full_name || "Membre",
          avatar_url: u?.avatar_url || null,
          status: a.status as AttendeeStatus,
        };
      });

    const mMin = rawMinutes.find((min) => min.meeting_id === m.id);
    let minutesItem: MeetingMinutesItem | null = null;
    if (mMin) {
      const rec = profileMap.get(mMin.recorded_by);
      minutesItem = {
        id: mMin.id,
        meeting_id: mMin.meeting_id,
        recorded_by: mMin.recorded_by,
        recorder_name: rec?.full_name || "Secrétaire",
        content: mMin.content,
        decisions: Array.isArray(mMin.decisions) ? mMin.decisions : [],
        action_items: Array.isArray(mMin.action_items) ? mMin.action_items : [],
        created_at: mMin.created_at,
        updated_at: mMin.updated_at,
      };
    }

    return {
      id: m.id,
      title: m.title,
      description: m.description,
      department_id: m.department_id,
      department_name: dept?.name || null,
      department_code: dept?.code || null,
      scheduled_at: m.scheduled_at,
      duration_min: m.duration_min || 60,
      location: m.location,
      meeting_link: m.meeting_link,
      agenda: Array.isArray(m.agenda) ? m.agenda : [],
      status: m.status as MeetingStatus,
      created_by: m.created_by,
      creator_name: creator?.full_name || "Organisateur",
      created_at: m.created_at,
      updated_at: m.updated_at,
      attendees: mAttendees,
      minutes: minutesItem,
    };
  });
}
