"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/rbac";

const UuidSchema = z.string().uuid("ID de département invalide");

const DepartmentCreateSchema = z.object({
  name: z.string().min(2, "Le nom du pôle doit comporter au moins 2 caractères").max(100),
  code: z
    .string()
    .min(2, "Le code doit comporter au moins 2 caractères")
    .max(12, "Le code ne peut dépasser 12 caractères")
    .regex(/^[A-Z0-9_-]+$/, "Le code doit être en majuscules sans espaces (ex: DESIGN, WEB)"),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().default("Building2"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Format de couleur hexadécimal invalide (#RRGGBB)").default("#E01E26"),
  coordinator_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().default(true),
});

const DepartmentUpdateSchema = z.object({
  id: UuidSchema,
  name: z.string().min(2).max(100).optional(),
  code: z
    .string()
    .min(2)
    .max(12)
    .regex(/^[A-Z0-9_-]+$/)
    .optional(),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  coordinator_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
});

export interface ActionResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export async function createDepartmentAction(rawInput: unknown): Promise<ActionResponse> {
  try {
    const { user, profile } = await requireProfile();
    if (profile.role !== "SUPER_ADMIN") {
      return { success: false, message: "Action réservée aux Super Administrateurs" };
    }

    const parseResult = DepartmentCreateSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        message: "Données de formulaire invalides",
        errors: parseResult.error.flatten().fieldErrors,
      };
    }

    const data = parseResult.data;
    const supabase = await createClient();

    // Check if code or name already exists
    const { data: existing } = await (supabase.from("departments") as any)
      .select("id, code, name")
      .or(`code.eq.${data.code},name.eq.${data.name}`)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        message: existing.code === data.code
          ? `Le code '${data.code}' est déjà utilisé par un autre pôle.`
          : `Le nom '${data.name}' est déjà utilisé.`,
      };
    }

    const insertPayload: any = {
      name: data.name.trim(),
      code: data.code.toUpperCase().trim(),
      description: data.description?.trim() || null,
      icon: data.icon || "Building2",
      color: data.color || "#E01E26",
      coordinator_id: data.coordinator_id || null,
      is_active: data.is_active ?? true,
    };

    const { data: inserted, error } = await (supabase.from("departments") as any)
      .insert(insertPayload)
      .select()
      .single();

    if (error || !inserted) {
      console.error("Error creating department:", error);
      return { success: false, message: "Échec de l'enregistrement du département." };
    }

    // Activity log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "CREATE_DEPARTMENT",
      entity_type: "departments",
      entity_id: inserted.id,
      details: { name: inserted.name, code: inserted.code, coordinator_id: inserted.coordinator_id },
    });

    revalidatePath("/dashboard/departments");
    return {
      success: true,
      message: `Pôle '${inserted.name}' créé avec succès.`,
      data: inserted,
    };
  } catch (err: any) {
    console.error("createDepartmentAction exception:", err);
    return { success: false, message: err?.message || "Erreur interne du serveur" };
  }
}

export async function updateDepartmentAction(rawInput: unknown): Promise<ActionResponse> {
  try {
    const { user, profile } = await requireProfile();
    if (profile.role !== "SUPER_ADMIN") {
      return { success: false, message: "Action réservée aux Super Administrateurs" };
    }

    const parseResult = DepartmentUpdateSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        message: "Données de modification invalides",
        errors: parseResult.error.flatten().fieldErrors,
      };
    }

    const { id, ...updates } = parseResult.data;
    const supabase = await createClient();

    // Check existing
    const { data: current, error: fetchErr } = await (supabase.from("departments") as any)
      .select("id, name, code")
      .eq("id", id)
      .single();

    if (fetchErr || !current) {
      return { success: false, message: "Pôle introuvable" };
    }

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updatePayload.name = updates.name.trim();
    if (updates.code !== undefined) updatePayload.code = updates.code.toUpperCase().trim();
    if (updates.description !== undefined) updatePayload.description = updates.description ? updates.description.trim() : null;
    if (updates.icon !== undefined) updatePayload.icon = updates.icon;
    if (updates.color !== undefined) updatePayload.color = updates.color;
    if (updates.coordinator_id !== undefined) updatePayload.coordinator_id = updates.coordinator_id || null;
    if (updates.is_active !== undefined) updatePayload.is_active = updates.is_active;

    const { data: updated, error: updateErr } = await (supabase.from("departments") as any)
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updateErr || !updated) {
      console.error("Error updating department:", updateErr);
      return { success: false, message: "Échec de la mise à jour du département." };
    }

    // Activity log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "UPDATE_DEPARTMENT",
      entity_type: "departments",
      entity_id: id,
      details: { name: updated.name, code: updated.code, changes: updatePayload },
    });

    revalidatePath("/dashboard/departments");
    return {
      success: true,
      message: `Pôle '${updated.name}' mis à jour avec succès.`,
      data: updated,
    };
  } catch (err: any) {
    console.error("updateDepartmentAction exception:", err);
    return { success: false, message: err?.message || "Erreur interne du serveur" };
  }
}
