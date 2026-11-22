"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, AuthorizationError } from "@/lib/auth/rbac";

const ProfileUpdateSchema = z.object({
  full_name: z.string().min(2, "Le nom doit comporter au moins 2 caractères").max(100),
  phone: z.string().optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  avatar_url: z.string().url().optional().nullable().or(z.literal("")),
});

const PreferencesUpdateSchema = z.object({
  language: z.enum(["fr", "ar", "en"]).default("fr"),
  theme: z.enum(["dark", "light"]).default("dark"),
  email_notifications: z.boolean().default(true),
  push_notifications: z.boolean().default(true),
});

export interface ActionResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export async function updateProfileSettingsAction(rawInput: unknown): Promise<ActionResponse> {
  try {
    const { user, profile } = await requireProfile();

    const parseResult = ProfileUpdateSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        message: "Validation échouée pour le profil",
        errors: parseResult.error.flatten().fieldErrors,
      };
    }

    const data = parseResult.data;
    const supabase = await createClient();

    const updatePayload: Record<string, any> = {
      full_name: data.full_name,
      phone: data.phone || null,
      bio: data.bio || null,
      updated_at: new Date().toISOString(),
    };

    if (data.avatar_url !== undefined) {
      updatePayload.avatar_url = data.avatar_url || null;
    }

    const { data: updated, error } = await (supabase.from("profiles") as any)
      .update(updatePayload)
      .eq("id", user.id)
      .select("id, full_name, phone, bio, avatar_url")
      .single();

    if (error || !updated) {
      console.error("Supabase update profile error:", error);
      return { success: false, message: `Erreur: ${error?.message}` };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "UPDATE_PROFILE_SETTINGS",
      entity_type: "profiles",
      entity_id: user.id,
      details: { full_name: updated.full_name },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    return {
      success: true,
      message: "Profil membre mis à jour avec succès",
      data: updated,
    };
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: err.message || "Erreur interne" };
  }
}

export async function updateUserPreferencesAction(rawInput: unknown): Promise<ActionResponse> {
  try {
    const { user, profile } = await requireProfile();

    const parseResult = PreferencesUpdateSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        message: "Préférences invalides",
        errors: parseResult.error.flatten().fieldErrors,
      };
    }

    const data = parseResult.data;
    const supabase = await createClient();

    const { error } = await (supabase.from("user_preferences") as any).upsert({
      user_id: user.id,
      language: data.language,
      theme: data.theme,
      email_notifications: data.email_notifications,
      push_notifications: data.push_notifications,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Supabase upsert preferences error:", error);
      return { success: false, message: `Erreur: ${error.message}` };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "UPDATE_USER_PREFERENCES",
      entity_type: "user_preferences",
      entity_id: user.id,
      details: { theme: data.theme, language: data.language },
    });

    revalidatePath("/dashboard/settings");
    return {
      success: true,
      message: "Préférences d'application enregistrées",
    };
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: err.message || "Erreur interne" };
  }
}
