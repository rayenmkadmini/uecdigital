"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, AuthorizationError } from "@/lib/auth/rbac";
import { type MediaCategory, toDbMediaCategory } from "@/lib/data/media";

const UuidSchema = z.string().uuid("ID invalide");

const MediaCategoryEnum = z.enum(["BRANDING", "PHOTO", "VIDEO", "DOCUMENT", "DESIGN_ASSET", "AUDIO", "AUTRE"]);

const MediaRecordSchema = z.object({
  title: z.string().min(2, "Le titre de l'asset doit comporter au moins 2 caractères").max(150),
  file_name: z.string().min(1),
  file_path: z.string().min(1),
  bucket_name: z.string().default("espace-digital-media"),
  file_size: z.number().min(1),
  mime_type: z.string().min(1),
  category: MediaCategoryEnum,
  department_id: z.string().uuid().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  is_public_within_team: z.boolean().default(true),
  metadata: z.record(z.any()).default({}),
});

const MediaUpdateSchema = z.object({
  title: z.string().min(2).max(150).optional(),
  category: MediaCategoryEnum.optional(),
  department_id: z.string().uuid().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  is_public_within_team: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

export interface ActionResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export async function recordMediaFileAction(rawInput: unknown): Promise<ActionResponse> {
  try {
    const { user, profile } = await requireProfile();

    const parseResult = MediaRecordSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        message: "Erreur de validation des métadonnées du fichier",
        errors: parseResult.error.flatten().fieldErrors,
      };
    }

    const data = parseResult.data;
    const supabase = await createClient();

    const { data: inserted, error } = await (supabase.from("media_files") as any)
      .insert({
        title: data.title,
        file_name: data.file_name,
        file_path: data.file_path,
        bucket_name: data.bucket_name,
        file_size: data.file_size,
        mime_type: data.mime_type,
        category: toDbMediaCategory(data.category),
        department_id: data.department_id || null,
        project_id: data.project_id || null,
        uploaded_by: user.id,
        is_public_within_team: data.is_public_within_team,
        metadata: data.metadata,
      })
      .select("id, title, file_path")
      .single();

    if (error || !inserted) {
      console.error("Supabase insert media_files error:", error);
      return { success: false, message: `Erreur: ${error?.message}` };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "UPLOAD_MEDIA_FILE",
      entity_type: "media_files",
      entity_id: inserted.id,
      details: { title: inserted.title, fileName: data.file_name, size: data.file_size, category: data.category },
    });

    revalidatePath("/dashboard/media");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: "Fichier indexé avec succès dans la médiathèque",
      data: inserted,
    };
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: err.message || "Erreur interne" };
  }
}

export async function updateMediaFileAction(mediaId: string, rawInput: unknown): Promise<ActionResponse> {
  try {
    const validId = UuidSchema.safeParse(mediaId);
    if (!validId.success) {
      return { success: false, message: "ID de fichier média invalide" };
    }

    const { user, profile, department } = await requireProfile();

    const parseResult = MediaUpdateSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        message: "Données de modification invalides",
        errors: parseResult.error.flatten().fieldErrors,
      };
    }

    const supabase = await createClient();

    const { data: media, error: fetchErr } = await (supabase.from("media_files") as any)
      .select("id, title, uploaded_by, department_id")
      .eq("id", validId.data)
      .single();

    if (fetchErr || !media) {
      return { success: false, message: "Fichier média introuvable" };
    }

    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const isDeptCoord = profile.role === "COORDINATOR" && department?.id === media.department_id;
    const isUploader = media.uploaded_by === user.id;

    if (!isSuperAdmin && !isDeptCoord && !isUploader) {
      throw new AuthorizationError("FORBIDDEN: Vous n'avez pas l'autorisation de modifier ce fichier.");
    }

    const data = parseResult.data;
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.category !== undefined) updatePayload.category = toDbMediaCategory(data.category);
    if (data.department_id !== undefined) updatePayload.department_id = data.department_id;
    if (data.project_id !== undefined) updatePayload.project_id = data.project_id;
    if (data.is_public_within_team !== undefined) updatePayload.is_public_within_team = data.is_public_within_team;
    if (data.metadata !== undefined) updatePayload.metadata = data.metadata;

    const { data: updated, error: updateErr } = await (supabase.from("media_files") as any)
      .update(updatePayload)
      .eq("id", validId.data)
      .select("id, title")
      .single();

    if (updateErr) {
      return { success: false, message: `Erreur: ${updateErr.message}` };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "UPDATE_MEDIA_FILE",
      entity_type: "media_files",
      entity_id: validId.data,
      details: { title: media.title, changes: updatePayload },
    });

    revalidatePath("/dashboard/media");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: "Fichier média mis à jour avec succès",
      data: updated,
    };
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: err.message || "Erreur interne" };
  }
}

export async function deleteMediaFileAction(mediaId: string): Promise<ActionResponse> {
  try {
    const validId = UuidSchema.safeParse(mediaId);
    if (!validId.success) {
      return { success: false, message: "ID de fichier média invalide" };
    }

    const { user, profile, department } = await requireProfile();
    const supabase = await createClient();

    const { data: media, error: fetchErr } = await (supabase.from("media_files") as any)
      .select("id, title, uploaded_by, department_id, file_path, bucket_name")
      .eq("id", validId.data)
      .single();

    if (fetchErr || !media) {
      return { success: false, message: "Fichier média introuvable" };
    }

    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const isDeptCoord = profile.role === "COORDINATOR" && department?.id === media.department_id;
    const isUploader = media.uploaded_by === user.id;

    if (!isSuperAdmin && !isDeptCoord && !isUploader) {
      throw new AuthorizationError("FORBIDDEN: Vous n'avez pas l'autorisation de supprimer ce fichier.");
    }

    // Attempt to remove from Supabase Storage if file_path is present
    if (media.file_path && media.bucket_name) {
      try {
        await supabase.storage.from(media.bucket_name).remove([media.file_path]);
      } catch (storageErr) {
        console.warn("Storage deletion warning:", storageErr);
      }
    }

    const { error: delErr } = await (supabase.from("media_files") as any)
      .delete()
      .eq("id", validId.data);

    if (delErr) {
      return { success: false, message: `Erreur lors de la suppression: ${delErr.message}` };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "DELETE_MEDIA_FILE",
      entity_type: "media_files",
      entity_id: validId.data,
      details: { title: media.title, filePath: media.file_path },
    });

    revalidatePath("/dashboard/media");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Fichier "${media.title}" supprimé de la médiathèque.`,
    };
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: err.message || "Erreur interne" };
  }
}
