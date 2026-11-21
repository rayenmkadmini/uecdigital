"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, AuthorizationError } from "@/lib/auth/rbac";
import type { CalendarWorkflowStatus, ContentPlatform, ContentType } from "@/lib/data/calendar";

const CalendarItemCreateSchema = z.object({
  title: z.string().min(3, "Le titre doit comporter au moins 3 caractères").max(150),
  description: z.string().optional().nullable(),
  platform: z.enum(["INSTAGRAM", "FACEBOOK", "TIKTOK", "LINKEDIN", "TWITTER", "WEBSITE", "OTHER"]),
  content_type: z.enum(["POST", "REEL", "STORY", "ARTICLE", "COMMUNIQUE", "VIDEO", "CAROUSEL"]).default("POST"),
  scheduled_date: z.string().min(1, "La date de diffusion est requise"),
  designer_id: z.string().uuid().optional().nullable(),
  writer_id: z.string().uuid().optional().nullable(),
  status: z
    .enum(["IDEA", "DRAFT", "IN_DESIGN", "IN_REVIEW", "APPROVED", "SCHEDULED", "PUBLISHED", "CANCELLED"])
    .default("IDEA"),
});

const CalendarItemUpdateSchema = z.object({
  title: z.string().min(3).max(150).optional(),
  description: z.string().optional().nullable(),
  platform: z.enum(["INSTAGRAM", "FACEBOOK", "TIKTOK", "LINKEDIN", "TWITTER", "WEBSITE", "OTHER"]).optional(),
  content_type: z.enum(["POST", "REEL", "STORY", "ARTICLE", "COMMUNIQUE", "VIDEO", "CAROUSEL"]).optional(),
  scheduled_date: z.string().optional(),
  published_url: z.string().url().optional().nullable().or(z.literal("")),
  designer_id: z.string().uuid().optional().nullable(),
  writer_id: z.string().uuid().optional().nullable(),
  status: z
    .enum(["IDEA", "DRAFT", "IN_DESIGN", "IN_REVIEW", "APPROVED", "SCHEDULED", "PUBLISHED", "CANCELLED"])
    .optional(),
});

export interface ActionResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export async function createCalendarItemAction(rawInput: unknown): Promise<ActionResponse> {
  try {
    const { user, profile } = await requireProfile();

    const parseResult = CalendarItemCreateSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        message: "Validation échouée pour le contenu éditorial",
        errors: parseResult.error.flatten().fieldErrors,
      };
    }

    const data = parseResult.data;
    const supabase = await createClient();

    const insertPayload: any = {
      title: data.title,
      description: data.description || null,
      platform: data.platform,
      content_type: data.content_type,
      scheduled_date: new Date(data.scheduled_date).toISOString(),
      designer_id: data.designer_id || null,
      writer_id: data.writer_id || null,
      status: data.status,
      created_by: user.id,
      attachments: [],
    };

    const { data: inserted, error } = await (supabase.from("content_calendar") as any)
      .insert(insertPayload)
      .select("id, title")
      .single();

    if (error) {
      console.error("Supabase insert content_calendar error:", error);
      return { success: false, message: `Erreur lors de la création: ${error.message}` };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "CREATE_CALENDAR_ITEM",
      entity_type: "content_calendar",
      entity_id: inserted.id,
      details: { title: inserted.title, platform: data.platform, scheduled_date: insertPayload.scheduled_date },
    });

    revalidatePath("/dashboard/calendar");
    return {
      success: true,
      message: "Publication planifiée avec succès",
      data: inserted,
    };
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: err.message || "Erreur interne" };
  }
}

export async function updateCalendarItemAction(itemId: string, rawInput: unknown): Promise<ActionResponse> {
  try {
    const { user, profile } = await requireProfile();

    const parseResult = CalendarItemUpdateSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        message: "Données de modification invalides",
        errors: parseResult.error.flatten().fieldErrors,
      };
    }

    const data = parseResult.data;
    const supabase = await createClient();

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.platform !== undefined) updatePayload.platform = data.platform;
    if (data.content_type !== undefined) updatePayload.content_type = data.content_type;
    if (data.scheduled_date !== undefined) updatePayload.scheduled_date = new Date(data.scheduled_date).toISOString();
    if (data.published_url !== undefined) updatePayload.published_url = data.published_url || null;
    if (data.designer_id !== undefined) updatePayload.designer_id = data.designer_id;
    if (data.writer_id !== undefined) updatePayload.writer_id = data.writer_id;
    if (data.status !== undefined) {
      updatePayload.status = data.status;
      if (data.status === "PUBLISHED" && !updatePayload.published_date) {
        updatePayload.published_date = new Date().toISOString();
      }
      if (data.status === "APPROVED") {
        updatePayload.approved_by = user.id;
      }
    }

    const { data: updated, error } = await (supabase.from("content_calendar") as any)
      .update(updatePayload)
      .eq("id", itemId)
      .select("id, title, status")
      .single();

    if (error) {
      console.error("Supabase update content_calendar error:", error);
      return { success: false, message: `Erreur lors de la mise à jour: ${error.message}` };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "UPDATE_CALENDAR_ITEM",
      entity_type: "content_calendar",
      entity_id: itemId,
      details: updatePayload,
    });

    revalidatePath("/dashboard/calendar");
    return {
      success: true,
      message: "Contenu éditorial mis à jour",
      data: updated,
    };
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: err.message || "Erreur interne" };
  }
}

export async function updateCalendarStatusAction(
  itemId: string,
  newStatus: CalendarWorkflowStatus,
  publishedUrl?: string
): Promise<ActionResponse> {
  return updateCalendarItemAction(itemId, {
    status: newStatus,
    published_url: publishedUrl || undefined,
  });
}
