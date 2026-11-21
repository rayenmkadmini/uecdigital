"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, AuthorizationError } from "@/lib/auth/rbac";

const UuidSchema = z.string().uuid("ID d'annonce invalide");

const AnnouncementCreateSchema = z.object({
  title: z.string().min(3, "Le titre doit comporter au moins 3 caractères").max(150),
  content: z.string().min(10, "Le contenu de l'annonce doit comporter au moins 10 caractères"),
  target_audience: z.string().default("ALL"),
  department_id: z.string().uuid().optional().nullable(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]).default("NORMAL"),
  is_pinned: z.boolean().default(false),
});

const AnnouncementUpdateSchema = z.object({
  title: z.string().min(3).max(150).optional(),
  content: z.string().min(10).optional(),
  target_audience: z.string().optional(),
  department_id: z.string().uuid().optional().nullable(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]).optional(),
  is_pinned: z.boolean().optional(),
});

export interface ActionResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export async function createAnnouncementAction(rawInput: unknown): Promise<ActionResponse> {
  try {
    const { user, profile } = await requireProfile();
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
    const supabase = await createClient();

    // Map UI priority to PostgreSQL CHECK constraint values: ('NORMAL', 'IMPORTANT', 'URGENT')
    const dbPriority =
      data.priority === "CRITICAL"
        ? "URGENT"
        : data.priority === "HIGH"
        ? "IMPORTANT"
        : "NORMAL";

    const { data: inserted, error } = await (supabase.from("announcements") as any)
      .insert({
        title: data.title,
        content: data.content,
        author_id: user.id,
        target_audience: data.target_audience,
        department_id: data.department_id || null,
        priority: dbPriority,
        is_pinned: data.is_pinned,
      })
      .select("id, title")
      .single();

    if (error || !inserted) {
      console.error("Supabase insert announcements error:", error);
      return { success: false, message: `Erreur: ${error?.message}` };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "CREATE_ANNOUNCEMENT",
      entity_type: "announcements",
      entity_id: inserted.id,
      details: { title: inserted.title, priority: data.priority, audience: data.target_audience },
    });

    // Notify all active users if HIGH or CRITICAL
    if (data.priority === "HIGH" || data.priority === "CRITICAL") {
      const { data: users } = await (supabase.from("profiles") as any)
        .select("id")
        .eq("is_active", true)
        .neq("id", user.id);

      if (users && users.length > 0) {
        const notifRows = users.map((u: { id: string }) => ({
          user_id: u.id,
          title: `COMMUNIQUÉ OFFICIEL : ${data.title}`,
          message: data.content.slice(0, 120) + (data.content.length > 120 ? "..." : ""),
          type: "SYSTEM",
          link: `/dashboard/announcements`,
        }));
        await (supabase.from("notifications") as any).insert(notifRows);
      }
    }

    revalidatePath("/dashboard/announcements");
    revalidatePath("/dashboard");

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

export async function updateAnnouncementAction(
  announcementId: string,
  rawInput: unknown
): Promise<ActionResponse> {
  try {
    const validId = UuidSchema.safeParse(announcementId);
    if (!validId.success) {
      return { success: false, message: "ID d'annonce invalide" };
    }

    const { user, profile } = await requireProfile();
    const supabase = await createClient();

    const { data: existing, error: fetchErr } = await (supabase.from("announcements") as any)
      .select("id, author_id, title")
      .eq("id", validId.data)
      .single();

    if (fetchErr || !existing) {
      return { success: false, message: "Annonce introuvable" };
    }

    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const isAuthor = existing.author_id === user.id;

    if (!isSuperAdmin && !isAuthor) {
      throw new AuthorizationError("FORBIDDEN: Vous n'avez pas l'autorisation de modifier cette annonce.");
    }

    const parseResult = AnnouncementUpdateSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        message: "Données de modification invalides",
        errors: parseResult.error.flatten().fieldErrors,
      };
    }

    const data = parseResult.data;
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.content !== undefined) updatePayload.content = data.content;
    if (data.target_audience !== undefined) updatePayload.target_audience = data.target_audience;
    if (data.department_id !== undefined) updatePayload.department_id = data.department_id;
    if (data.priority !== undefined) {
      updatePayload.priority =
        data.priority === "CRITICAL"
          ? "URGENT"
          : data.priority === "HIGH"
          ? "IMPORTANT"
          : "NORMAL";
    }
    if (data.is_pinned !== undefined) updatePayload.is_pinned = data.is_pinned;

    const { data: updated, error } = await (supabase.from("announcements") as any)
      .update(updatePayload)
      .eq("id", validId.data)
      .select("id, title")
      .single();

    if (error || !updated) {
      return { success: false, message: `Erreur: ${error?.message}` };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "UPDATE_ANNOUNCEMENT",
      entity_type: "announcements",
      entity_id: validId.data,
      details: { title: updated.title, changes: updatePayload },
    });

    revalidatePath("/dashboard/announcements");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: "Annonce mise à jour avec succès",
      data: updated,
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
    const validId = UuidSchema.safeParse(announcementId);
    if (!validId.success) {
      return { success: false, message: "ID d'annonce invalide" };
    }

    const { user, profile } = await requireProfile();
    if (profile.role !== "SUPER_ADMIN") {
      return { success: false, message: "Action réservée aux Super Administrateurs" };
    }

    const supabase = await createClient();

    const { data: updated, error } = await (supabase.from("announcements") as any)
      .update({ is_pinned: isPinned, updated_at: new Date().toISOString() })
      .eq("id", validId.data)
      .select("id, title")
      .single();

    if (error) {
      return { success: false, message: `Erreur: ${error.message}` };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: isPinned ? "PIN_ANNOUNCEMENT" : "UNPIN_ANNOUNCEMENT",
      entity_type: "announcements",
      entity_id: validId.data,
      details: { title: updated?.title, isPinned },
    });

    revalidatePath("/dashboard/announcements");
    revalidatePath("/dashboard");

    return { success: true, message: isPinned ? "Annonce épinglée en tête" : "Épinglage retiré" };
  } catch (err: any) {
    return { success: false, message: err.message || "Erreur interne" };
  }
}

export async function deleteAnnouncementAction(announcementId: string): Promise<ActionResponse> {
  try {
    const validId = UuidSchema.safeParse(announcementId);
    if (!validId.success) {
      return { success: false, message: "ID d'annonce invalide" };
    }

    const { user, profile } = await requireProfile();
    const supabase = await createClient();

    const { data: existing, error: fetchErr } = await (supabase.from("announcements") as any)
      .select("id, author_id, title")
      .eq("id", validId.data)
      .single();

    if (fetchErr || !existing) {
      return { success: false, message: "Annonce introuvable" };
    }

    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const isAuthor = existing.author_id === user.id;

    if (!isSuperAdmin && !isAuthor) {
      throw new AuthorizationError("FORBIDDEN: Vous n'avez pas l'autorisation de supprimer cette annonce.");
    }

    const { error: delErr } = await (supabase.from("announcements") as any)
      .delete()
      .eq("id", validId.data);

    if (delErr) {
      return { success: false, message: `Erreur: ${delErr.message}` };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "DELETE_ANNOUNCEMENT",
      entity_type: "announcements",
      entity_id: validId.data,
      details: { title: existing.title },
    });

    revalidatePath("/dashboard/announcements");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Annonce "${existing.title}" supprimée avec succès.`,
    };
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: err.message || "Erreur interne" };
  }
}
