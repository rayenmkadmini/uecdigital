"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, AuthorizationError } from "@/lib/auth/rbac";
import type { MeetingStatus } from "@/lib/data/meetings";

const MeetingCreateSchema = z.object({
  title: z.string().min(3, "L'intitulé doit comporter au moins 3 caractères").max(150),
  description: z.string().optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  scheduled_at: z.string().min(1, "La date et l'heure de réunion sont requises"),
  duration_min: z.number().min(15).max(360).default(60),
  location: z.string().optional().nullable(),
  meeting_link: z.string().url().optional().nullable().or(z.literal("")),
  agenda: z.array(z.string()).default([]),
  attendee_ids: z.array(z.string().uuid()).default([]),
});

const MeetingMinutesSchema = z.object({
  content: z.string().min(10, "Le contenu du PV doit comporter au moins 10 caractères"),
  decisions: z.array(z.string()).default([]),
  action_items: z
    .array(
      z.object({
        text: z.string().min(1),
        assignee: z.string().optional(),
        due_date: z.string().optional(),
      })
    )
    .default([]),
});

export interface ActionResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export async function createMeetingAction(rawInput: unknown): Promise<ActionResponse> {
  try {
    const { user, profile } = await requireProfile();

    const parseResult = MeetingCreateSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        message: "Validation échouée pour la réunion",
        errors: parseResult.error.flatten().fieldErrors,
      };
    }

    const data = parseResult.data;
    const supabase = await createClient();

    const { data: meeting, error: meetErr } = await (supabase.from("meetings") as any)
      .insert({
        title: data.title,
        description: data.description || null,
        department_id: data.department_id || null,
        scheduled_at: new Date(data.scheduled_at).toISOString(),
        duration_min: data.duration_min,
        location: data.location || null,
        meeting_link: data.meeting_link || null,
        agenda: data.agenda,
        status: "SCHEDULED",
        created_by: user.id,
      })
      .select("id, title")
      .single();

    if (meetErr || !meeting) {
      console.error("Supabase insert meetings error:", meetErr);
      return { success: false, message: `Erreur lors de la création: ${meetErr?.message}` };
    }

    // Insert attendees
    if (data.attendee_ids.length > 0) {
      const attendeePayloads = data.attendee_ids.map((uid) => ({
        meeting_id: meeting.id,
        user_id: uid,
        status: "INVITED",
      }));
      await (supabase.from("meeting_attendees") as any).insert(attendeePayloads);
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "CREATE_MEETING",
      entity_type: "meetings",
      entity_id: meeting.id,
      details: { title: meeting.title, attendeesCount: data.attendee_ids.length },
    });

    revalidatePath("/dashboard/meetings");
    return {
      success: true,
      message: "Réunion planifiée et convocations enregistrées",
      data: meeting,
    };
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: err.message || "Erreur interne" };
  }
}

export async function updateMeetingStatusAction(
  meetingId: string,
  newStatus: MeetingStatus
): Promise<ActionResponse> {
  try {
    const { user, profile } = await requireProfile();
    const supabase = await createClient();

    const { data: updated, error } = await (supabase.from("meetings") as any)
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", meetingId)
      .select("id, title, status")
      .single();

    if (error) {
      return { success: false, message: `Erreur: ${error.message}` };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "UPDATE_MEETING_STATUS",
      entity_type: "meetings",
      entity_id: meetingId,
      details: { newStatus },
    });

    revalidatePath("/dashboard/meetings");
    return {
      success: true,
      message: `Statut de la réunion : ${newStatus}`,
      data: updated,
    };
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: err.message || "Erreur interne" };
  }
}

export async function saveMeetingMinutesAction(
  meetingId: string,
  rawInput: unknown
): Promise<ActionResponse> {
  try {
    const { user, profile } = await requireProfile();

    const parseResult = MeetingMinutesSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        message: "Erreur de validation du PV",
        errors: parseResult.error.flatten().fieldErrors,
      };
    }

    const data = parseResult.data;
    const supabase = await createClient();

    // Check if minutes already exist
    const { data: existing } = await (supabase.from("meeting_minutes") as any)
      .select("id")
      .eq("meeting_id", meetingId)
      .maybeSingle();

    if (existing) {
      await (supabase.from("meeting_minutes") as any)
        .update({
          content: data.content,
          decisions: data.decisions,
          action_items: data.action_items,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await (supabase.from("meeting_minutes") as any).insert({
        meeting_id: meetingId,
        recorded_by: user.id,
        content: data.content,
        decisions: data.decisions,
        action_items: data.action_items,
      });
    }

    // Mark meeting as completed if was scheduled
    await (supabase.from("meetings") as any)
      .update({ status: "COMPLETED", updated_at: new Date().toISOString() })
      .eq("id", meetingId);

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "SAVE_MEETING_MINUTES",
      entity_type: "meeting_minutes",
      entity_id: meetingId,
      details: { decisionsCount: data.decisions.length, actionItemsCount: data.action_items.length },
    });

    revalidatePath("/dashboard/meetings");
    return {
      success: true,
      message: "Procès-verbal de réunion (PV) enregistré avec succès",
    };
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: err.message || "Erreur interne" };
  }
}
