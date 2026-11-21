"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, AuthorizationError } from "@/lib/auth/rbac";
import type { MeetingStatus } from "@/lib/data/meetings";

const UuidSchema = z.string().uuid("ID de réunion invalide");

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

const MeetingStatusEnum = z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);

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

const RsvpStatusEnum = z.enum(["INVITED", "ACCEPTED", "DECLINED", "TENTATIVE"]);

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
      .select("id, title, scheduled_at")
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
        status: uid === user.id ? "ACCEPTED" : "INVITED",
      }));
      await (supabase.from("meeting_attendees") as any).insert(attendeePayloads);

      // Notify invited attendees (except creator)
      const notifyRows = data.attendee_ids
        .filter((uid) => uid !== user.id)
        .map((uid) => ({
          user_id: uid,
          title: "Convocation à une réunion",
          message: `Vous êtes convoqué à la réunion "${meeting.title}" le ${new Date(meeting.scheduled_at).toLocaleDateString("fr-FR")}.`,
          type: "MEETING",
          link: `/dashboard/meetings`,
        }));

      if (notifyRows.length > 0) {
        await (supabase.from("notifications") as any).insert(notifyRows);
      }
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "CREATE_MEETING",
      entity_type: "meetings",
      entity_id: meeting.id,
      details: { title: meeting.title, attendeesCount: data.attendee_ids.length, scheduled_at: meeting.scheduled_at },
    });

    revalidatePath("/dashboard/meetings");
    revalidatePath("/dashboard");

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
    const validId = UuidSchema.safeParse(meetingId);
    if (!validId.success) {
      return { success: false, message: "ID de réunion invalide" };
    }

    const validStatus = MeetingStatusEnum.safeParse(newStatus);
    if (!validStatus.success) {
      return { success: false, message: "Statut de réunion invalide" };
    }

    const { user, profile, department } = await requireProfile();
    const supabase = await createClient();

    const { data: meeting, error: fetchErr } = await (supabase.from("meetings") as any)
      .select("id, title, department_id, created_by")
      .eq("id", validId.data)
      .single();

    if (fetchErr || !meeting) {
      return { success: false, message: "Réunion introuvable" };
    }

    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const isDeptCoord = profile.role === "COORDINATOR" && department?.id === meeting.department_id;
    const isCreator = meeting.created_by === user.id;

    if (!isSuperAdmin && !isDeptCoord && !isCreator) {
      throw new AuthorizationError("FORBIDDEN: Vous n'avez pas l'autorisation de modifier le statut de cette réunion.");
    }

    const { data: updated, error } = await (supabase.from("meetings") as any)
      .update({
        status: validStatus.data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", validId.data)
      .select("id, title, status")
      .single();

    if (error || !updated) {
      return { success: false, message: `Erreur: ${error?.message}` };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "UPDATE_MEETING_STATUS",
      entity_type: "meetings",
      entity_id: validId.data,
      details: { title: meeting.title, newStatus: validStatus.data },
    });

    revalidatePath("/dashboard/meetings");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Statut de la réunion : ${validStatus.data}`,
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
    const validId = UuidSchema.safeParse(meetingId);
    if (!validId.success) {
      return { success: false, message: "ID de réunion invalide" };
    }

    const { user, profile, department } = await requireProfile();

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

    const { data: meeting, error: fetchErr } = await (supabase.from("meetings") as any)
      .select("id, title, department_id, created_by")
      .eq("id", validId.data)
      .single();

    if (fetchErr || !meeting) {
      return { success: false, message: "Réunion introuvable" };
    }

    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const isDeptCoord = profile.role === "COORDINATOR" && department?.id === meeting.department_id;
    const isCreator = meeting.created_by === user.id;

    if (!isSuperAdmin && !isDeptCoord && !isCreator) {
      throw new AuthorizationError("FORBIDDEN: Vous n'avez pas l'autorisation d'enregistrer le PV de cette réunion.");
    }

    // Check if minutes already exist
    const { data: existing } = await (supabase.from("meeting_minutes") as any)
      .select("id")
      .eq("meeting_id", validId.data)
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
        meeting_id: validId.data,
        recorded_by: user.id,
        content: data.content,
        decisions: data.decisions,
        action_items: data.action_items,
      });
    }

    // Mark meeting as completed if was scheduled or in progress
    await (supabase.from("meetings") as any)
      .update({ status: "COMPLETED", updated_at: new Date().toISOString() })
      .eq("id", validId.data);

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "SAVE_MEETING_MINUTES",
      entity_type: "meeting_minutes",
      entity_id: validId.data,
      details: { title: meeting.title, decisionsCount: data.decisions.length, actionItemsCount: data.action_items.length },
    });

    revalidatePath("/dashboard/meetings");
    revalidatePath("/dashboard");

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

/**
 * Server Action: RSVP to a Meeting
 */
export async function rsvpMeetingAction(
  meetingId: string,
  status: "ACCEPTED" | "DECLINED" | "TENTATIVE"
): Promise<ActionResponse> {
  try {
    const validId = UuidSchema.safeParse(meetingId);
    if (!validId.success) {
      return { success: false, message: "ID de réunion invalide" };
    }

    const validStatus = RsvpStatusEnum.safeParse(status);
    if (!validStatus.success) {
      return { success: false, message: "Réponse RSVP invalide" };
    }

    const { user, profile } = await requireProfile();
    const supabase = await createClient();

    const { data: meeting, error: meetErr } = await (supabase.from("meetings") as any)
      .select("id, title")
      .eq("id", validId.data)
      .single();

    if (meetErr || !meeting) {
      return { success: false, message: "Réunion introuvable" };
    }

    const { data: existing } = await (supabase.from("meeting_attendees") as any)
      .select("id")
      .eq("meeting_id", validId.data)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      await (supabase.from("meeting_attendees") as any)
        .update({ status: validStatus.data })
        .eq("id", existing.id);
    } else {
      await (supabase.from("meeting_attendees") as any).insert({
        meeting_id: validId.data,
        user_id: user.id,
        status: validStatus.data,
      });
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "MEETING_RSVP",
      entity_type: "meetings",
      entity_id: validId.data,
      details: { meetingTitle: meeting.title, status: validStatus.data },
    });

    revalidatePath("/dashboard/meetings");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Votre présence a été mise à jour : ${validStatus.data}`,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Erreur lors de la mise à jour RSVP." };
  }
}

/**
 * Server Action: Delete Meeting
 */
export async function deleteMeetingAction(meetingId: string): Promise<ActionResponse> {
  try {
    const validId = UuidSchema.safeParse(meetingId);
    if (!validId.success) {
      return { success: false, message: "ID de réunion invalide" };
    }

    const { user, profile, department } = await requireProfile();
    const supabase = await createClient();

    const { data: meeting, error: fetchErr } = await (supabase.from("meetings") as any)
      .select("id, title, department_id, created_by")
      .eq("id", validId.data)
      .single();

    if (fetchErr || !meeting) {
      return { success: false, message: "Réunion introuvable" };
    }

    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const isDeptCoord = profile.role === "COORDINATOR" && department?.id === meeting.department_id;
    const isCreator = meeting.created_by === user.id;

    if (!isSuperAdmin && !isDeptCoord && !isCreator) {
      throw new AuthorizationError("FORBIDDEN: Vous n'avez pas l'autorisation d'annuler/supprimer cette réunion.");
    }

    // Delete attendees and minutes first
    await (supabase.from("meeting_attendees") as any).delete().eq("meeting_id", validId.data);
    await (supabase.from("meeting_minutes") as any).delete().eq("meeting_id", validId.data);

    const { error: delErr } = await (supabase.from("meetings") as any)
      .delete()
      .eq("id", validId.data);

    if (delErr) {
      return { success: false, message: `Erreur: ${delErr.message}` };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "DELETE_MEETING",
      entity_type: "meetings",
      entity_id: validId.data,
      details: { title: meeting.title },
    });

    revalidatePath("/dashboard/meetings");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Réunion "${meeting.title}" supprimée avec succès.`,
    };
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: err.message || "Erreur interne" };
  }
}
