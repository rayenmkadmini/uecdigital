"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, AuthorizationError } from "@/lib/auth/rbac";
import type { MediaCategory } from "@/lib/data/media";

const MediaRecordSchema = z.object({
  title: z.string().min(2, "Le titre de l'asset doit comporter au moins 2 caractères").max(150),
  file_name: z.string().min(1),
  file_path: z.string().min(1),
  bucket_name: z.string().default("espace-digital-media"),
  file_size: z.number().min(1),
  mime_type: z.string().min(1),
  category: z.enum(["BRANDING", "PHOTO", "VIDEO", "DOCUMENT", "DESIGN_ASSET", "AUDIO", "AUTRE"]),
  department_id: z.string().uuid().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  is_public_within_team: z.boolean().default(true),
  metadata: z.record(z.any()).default({}),
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
        category: data.category,
        department_id: data.department_id || null,
        project_id: data.project_id || null,
        uploaded_by: user.id,
        is_public_within_team: data.is_public_within_team,
        metadata: data.metadata,
      })
      .select("id, title, file_path")
      .single();

    if (error) {
      console.error("Supabase insert media_files error:", error);
      return { success: false, message: `Erreur: ${error.message}` };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "UPLOAD_MEDIA_FILE",
      entity_type: "media_files",
      entity_id: inserted.id,
      details: { title: inserted.title, fileName: data.file_name, size: data.file_size },
    });

    revalidatePath("/dashboard/media");
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
