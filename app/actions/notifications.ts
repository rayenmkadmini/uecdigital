"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, AuthorizationError } from "@/lib/auth/rbac";

const UuidSchema = z.string().uuid("ID de notification invalide");

export interface ActionResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export async function markNotificationAsReadAction(notificationId: string): Promise<ActionResponse> {
  try {
    const validId = UuidSchema.safeParse(notificationId);
    if (!validId.success) {
      return { success: false, message: "ID de notification invalide" };
    }

    const { user } = await requireProfile();
    const supabase = await createClient();

    const { error } = await (supabase.from("notifications") as any)
      .update({ is_read: true })
      .eq("id", validId.data)
      .eq("user_id", user.id);

    if (error) {
      return { success: false, message: error.message };
    }

    revalidatePath("/dashboard");
    return { success: true, message: "Notification marquée comme lue" };
  } catch (err: any) {
    return { success: false, message: err.message || "Erreur interne" };
  }
}

export async function markAllNotificationsAsReadAction(): Promise<ActionResponse> {
  try {
    const { user } = await requireProfile();
    const supabase = await createClient();

    const { error } = await (supabase.from("notifications") as any)
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) {
      return { success: false, message: error.message };
    }

    revalidatePath("/dashboard");
    return { success: true, message: "Toutes les notifications sont marquées comme lues" };
  } catch (err: any) {
    return { success: false, message: err.message || "Erreur interne" };
  }
}

export async function deleteNotificationAction(notificationId: string): Promise<ActionResponse> {
  try {
    const validId = UuidSchema.safeParse(notificationId);
    if (!validId.success) {
      return { success: false, message: "ID de notification invalide" };
    }

    const { user } = await requireProfile();
    const supabase = await createClient();

    const { error } = await (supabase.from("notifications") as any)
      .delete()
      .eq("id", validId.data)
      .eq("user_id", user.id);

    if (error) {
      return { success: false, message: error.message };
    }

    revalidatePath("/dashboard");
    return { success: true, message: "Notification supprimée" };
  } catch (err: any) {
    return { success: false, message: err.message || "Erreur interne" };
  }
}

export async function clearAllNotificationsAction(): Promise<ActionResponse> {
  try {
    const { user } = await requireProfile();
    const supabase = await createClient();

    const { error } = await (supabase.from("notifications") as any)
      .delete()
      .eq("user_id", user.id);

    if (error) {
      return { success: false, message: error.message };
    }

    revalidatePath("/dashboard");
    return { success: true, message: "Historique des notifications effacé" };
  } catch (err: any) {
    return { success: false, message: err.message || "Erreur interne" };
  }
}

export async function sendBroadcastNotificationAction(
  title: string,
  message: string,
  link?: string
): Promise<ActionResponse> {
  try {
    const { user, profile } = await requireProfile();
    if (profile.role !== "SUPER_ADMIN") {
      throw new AuthorizationError("Action réservée aux Super Administrateurs");
    }

    const validTitle = z.string().min(2).max(100).safeParse(title);
    const validMessage = z.string().min(2).max(500).safeParse(message);

    if (!validTitle.success || !validMessage.success) {
      return { success: false, message: "Données de notification invalides" };
    }

    const supabase = await createClient();

    // Get all active user IDs
    const { data: users, error: userErr } = await (supabase.from("profiles") as any)
      .select("id")
      .eq("is_active", true);

    if (userErr || !users || users.length === 0) {
      return { success: false, message: "Aucun utilisateur destinataire trouvé" };
    }

    const rows = users.map((u: { id: string }) => ({
      user_id: u.id,
      title: validTitle.data,
      message: validMessage.data,
      type: "SYSTEM",
      link: link || null,
      is_read: false,
    }));

    await (supabase.from("notifications") as any).insert(rows);

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "BROADCAST_NOTIFICATION",
      entity_type: "notifications",
      entity_id: null,
      details: { title: validTitle.data, recipientsCount: users.length },
    });

    revalidatePath("/dashboard");
    return { success: true, message: `Notification diffusée à ${users.length} membres actifs.` };
  } catch (err: any) {
    return { success: false, message: err.message || "Erreur interne" };
  }
}
