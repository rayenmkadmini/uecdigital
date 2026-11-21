"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, AuthorizationError } from "@/lib/auth/rbac";

const AnnouncementCreateSchema = z.object({
  title: z.string().min(3, "Le titre doit comporter au moins 3 caractères").max(150),
  content: z.string().min(10, "Le contenu de l'annonce doit comporter au moins 10 caractères"),
  target_audience: z.string().default("ALL"),
  department_id: z.string().uuid().optional().nullable(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]).default("NORMAL"),
  is_pinned: z.boolean().default(false),
});

export interface ActionResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export async function createAnnouncementAction(rawInput: unknown): Promise<ActionResponse> {
  try {
    const { user, profile, department } = await requireProfile();
    if (profile.role !== "SUPER_ADMIN" && profile.role !== "COORDINATOR") {
      return { success: false, message: "Action réservée aux Coordinateurs et Super Administrateurs" };
    }

    const parseResult = AnnouncementCreateSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        message: "Validation de l'annonce échouée",
        errors: parseResult.error.flatten().fieldErrors,
      };
    }

    const data = parseResult.data;

    // Coordinators can only post announcements for their own department
    if (profile.role === "COORDINATOR" && data.department_id && department?.id !== data.department_id) {
      throw new AuthorizationError("FORBIDDEN: Vous ne pouvez publier une annonce que pour votre propre département.");
    }

    const supabase = await createClient();

    const { data: inserted, error } = await (supabase.from("announcements") as any)
      .insert({
        title: data.title,
        content: data.content,
        author_id: user.id,
        target_audience: data.target_audience,
        department_id: data.department_id || null,
        priority: data.priority,
        is_pinned: profile.role === "SUPER_ADMIN" ? data.is_pinned : false,
      })
      .select("id, title")
      .single();

    if (error) {
      console.error("Supabase insert announcements error:", error);
      return { success: false, message: `Erreur: ${error.message}` };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "CREATE_ANNOUNCEMENT",
      entity_type: "announcements",
      entity_id: inserted.id,
      details: { title: inserted.title, priority: data.priority, audience: data.target_audience },
    });

    revalidatePath("/dashboard/announcements");
    return {
      success: true,
      message: "Annonce officielle publiée avec succès",
      data: inserted,
    };
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: err.message || "Erreur interne" };
  }
}

export async function togglePinAnnouncementAction(
  announcementId: string,
  isPinned: boolean
): Promise<ActionResponse> {
  try {
    const validId = z.string().uuid("ID d'annonce invalide").safeParse(announcementId);
    if (!validId.success) {
      return { success: false, message: "ID d'annonce invalide" };
    }

    const { profile } = await requireProfile();
    if (profile.role !== "SUPER_ADMIN") {
      return { success: false, message: "Action réservée aux Super Administrateurs" };
    }

    const supabase = await createClient();

    await (supabase.from("announcements") as any)
      .update({ is_pinned: Boolean(isPinned), updated_at: new Date().toISOString() })
      .eq("id", validId.data);

    revalidatePath("/dashboard/announcements");
    return { success: true, message: isPinned ? "Annonce épinglée en tête" : "Épinglage retiré" };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
