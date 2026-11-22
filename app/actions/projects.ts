"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, AuthorizationError } from "@/lib/auth/rbac";

const ProjectCreateSchema = z.object({
  code: z
    .string()
    .min(2, "Le code doit comporter au moins 2 caractères")
    .max(20, "Le code ne peut excéder 20 caractères")
    .regex(/^[A-Z0-9_-]+$/, "Le code doit être en majuscules sans espaces (ex: DERBY-26)"),
  title: z.string().min(3, "Le titre doit comporter au moins 3 caractères").max(150),
  description: z.string().optional().nullable(),
  department_id: z.string().uuid("ID de département invalide"),
  manager_id: z.string().uuid().optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "IN_REVIEW", "COMPLETED", "CANCELLED"]).default("PLANNING"),
  start_date: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
});

const ProjectUpdateSchema = z.object({
  title: z.string().min(3, "Le titre doit comporter au moins 3 caractères").max(150).optional(),
  description: z.string().optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "IN_REVIEW", "COMPLETED", "CANCELLED"]).optional(),
  start_date: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
  progress: z.number().min(0).max(100).optional(),
});

const ProjectMemberRoleSchema = z.enum(["LEAD", "CONTRIBUTOR", "VIEWER"]);

export interface ActionResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

/**
 * Server Action: Create a new Project
 * Authorization: SUPER_ADMIN or COORDINATOR of the target department.
 */
export async function createProjectAction(rawInput: unknown): Promise<ActionResponse> {
  try {
    const { user, profile, department } = await requireProfile();

    const parseResult = ProjectCreateSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        message: "Erreur de validation des champs du projet",
        errors: parseResult.error.flatten().fieldErrors,
      };
    }

    const data = parseResult.data;

    // RBAC Check: Only Super Admin or Coordinator of that specific department
    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const isDeptCoord = profile.role === "COORDINATOR" && department?.id === data.department_id;

    if (!isSuperAdmin && !isDeptCoord) {
      throw new AuthorizationError(
        "FORBIDDEN: Vous n'avez pas l'autorisation de créer un projet dans ce département."
      );
    }

    const supabase = await createClient();

    // Check code uniqueness
    const { data: existing } = await (supabase.from("projects") as any)
      .select("id")
      .eq("code", data.code.toUpperCase())
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        message: `Un projet avec le code "${data.code.toUpperCase()}" existe déjà.`,
      };
    }

    // Insert project
    const { data: newProject, error: insertErr } = await (supabase.from("projects") as any)
      .insert({
        code: data.code.toUpperCase(),
        title: data.title,
        description: data.description || null,
        department_id: data.department_id,
        manager_id: data.manager_id || user.id,
        priority: data.priority,
        status: data.status,
        start_date: data.start_date || null,
        deadline: data.deadline || null,
        created_by: user.id,
        progress: 0,
      })
      .select("id, code, title")
      .single();

    if (insertErr || !newProject) {
      return {
        success: false,
        message: `Erreur lors de l'enregistrement: ${insertErr?.message}`,
      };
    }

    // Add creator to project_members
    await (supabase.from("project_members") as any).insert({
      project_id: newProject.id,
      user_id: user.id,
      role_in_project: "LEAD",
    });

    // Log activity
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "PROJECT_CREATED",
      entity_type: "project",
      entity_id: newProject.id,
      details: { title: newProject.title, code: newProject.code },
    });

    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Projet "${newProject.title}" (${newProject.code}) créé avec succès.`,
      data: newProject,
    };
  } catch (err: any) {
    console.error("createProjectAction error:", err);
    return {
      success: false,
      message: err.message || "Une erreur est survenue lors de la création du projet.",
    };
  }
}

/**
 * Server Action: Update Project Details
 */
export async function updateProjectAction(
  projectId: string,
  rawInput: unknown
): Promise<ActionResponse> {
  try {
    const validId = z.string().uuid("ID de projet invalide").safeParse(projectId);
    if (!validId.success) {
      return { success: false, message: "ID de projet invalide" };
    }

    const parsed = ProjectUpdateSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message: "Erreur de validation des champs du projet",
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    const data = parsed.data;
    const { user, profile, department } = await requireProfile();

    const supabase = await createClient();

    // Fetch existing project to verify authorization
    const { data: project, error: fetchErr } = await (supabase.from("projects") as any)
      .select("id, department_id, manager_id, title")
      .eq("id", projectId)
      .single();

    if (fetchErr || !project) {
      return { success: false, message: "Projet introuvable" };
    }

    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const isDeptCoord = profile.role === "COORDINATOR" && department?.id === project.department_id;
    const isManager = project.manager_id === user.id;

    if (!isSuperAdmin && !isDeptCoord && !isManager) {
      throw new AuthorizationError("FORBIDDEN: Vous n'avez pas les droits de modification sur ce projet.");
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (data.title) updatePayload.title = data.title;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.status) updatePayload.status = data.status;
    if (data.priority) updatePayload.priority = data.priority;
    if (data.start_date !== undefined) updatePayload.start_date = data.start_date;
    if (data.deadline !== undefined) updatePayload.deadline = data.deadline;
    if (data.progress !== undefined) updatePayload.progress = data.progress;

    const { error: updateErr } = await (supabase.from("projects") as any)
      .update(updatePayload)
      .eq("id", projectId);

    if (updateErr) {
      return { success: false, message: updateErr.message };
    }

    // Log activity
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "PROJECT_UPDATED",
      entity_type: "project",
      entity_id: projectId,
      details: { title: project.title, changes: updatePayload },
    });

    revalidatePath("/dashboard/projects");
    revalidatePath(`/dashboard/projects/${projectId}`);
    revalidatePath("/dashboard");

    return {
      success: true,
      message: "Projet mis à jour avec succès.",
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Erreur lors de la mise à jour du projet.",
    };
  }
}

/**
 * Server Action: Delete / Cancel a Project
 * Authorization: SUPER_ADMIN or COORDINATOR of the project's department.
 */
export async function deleteProjectAction(projectId: string): Promise<ActionResponse> {
  try {
    const validId = z.string().uuid("ID de projet invalide").safeParse(projectId);
    if (!validId.success) {
      return { success: false, message: "ID de projet invalide" };
    }

    const { user, profile, department } = await requireProfile();
    const supabase = await createClient();

    const { data: project, error: fetchErr } = await (supabase.from("projects") as any)
      .select("id, department_id, title, code")
      .eq("id", projectId)
      .single();

    if (fetchErr || !project) {
      return { success: false, message: "Projet introuvable" };
    }

    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const isDeptCoord = profile.role === "COORDINATOR" && department?.id === project.department_id;

    if (!isSuperAdmin && !isDeptCoord) {
      throw new AuthorizationError("FORBIDDEN: Vous n'avez pas l'autorisation de supprimer ce projet.");
    }

    // Delete members association first, then project
    await (supabase.from("project_members") as any).delete().eq("project_id", projectId);

    const { error: delErr } = await (supabase.from("projects") as any)
      .delete()
      .eq("id", projectId);

    if (delErr) {
      return { success: false, message: `Erreur lors de la suppression: ${delErr.message}` };
    }

    // Log activity
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "PROJECT_DELETED",
      entity_type: "project",
      entity_id: projectId,
      details: { title: project.title, code: project.code },
    });

    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Projet "${project.title}" (${project.code}) supprimé avec succès.`,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Erreur lors de la suppression du projet." };
  }
}

/**
 * Server Action: Assign a member to a project
 */
export async function assignProjectMemberAction(
  projectId: string,
  userId: string,
  roleInProject = "CONTRIBUTOR"
): Promise<ActionResponse> {
  try {
    const validProj = z.string().uuid("ID de projet invalide").safeParse(projectId);
    const validUser = z.string().uuid("ID d'utilisateur invalide").safeParse(userId);
    const validRole = ProjectMemberRoleSchema.safeParse(roleInProject);

    if (!validProj.success || !validUser.success || !validRole.success) {
      return { success: false, message: "Paramètres d'assignation de projet invalides." };
    }

    const { user, profile, department } = await requireProfile();
    const supabase = await createClient();

    const { data: project } = await (supabase.from("projects") as any)
      .select("id, department_id, title")
      .eq("id", projectId)
      .single();

    if (!project) return { success: false, message: "Projet introuvable" };

    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const isDeptCoord = profile.role === "COORDINATOR" && department?.id === project.department_id;

    if (!isSuperAdmin && !isDeptCoord) {
      throw new AuthorizationError("FORBIDDEN: Vous n'avez pas le droit d'assigner des membres à ce projet.");
    }

    const { error } = await (supabase.from("project_members") as any).upsert(
      {
        project_id: projectId,
        user_id: userId,
        role_in_project: validRole.data,
      },
      { onConflict: "project_id,user_id" }
    );

    if (error) {
      return { success: false, message: error.message };
    }

    // Log activity
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "PROJECT_MEMBER_ASSIGNED",
      entity_type: "project",
      entity_id: projectId,
      details: { targetUserId: userId, roleInProject: validRole.data },
    });

    revalidatePath("/dashboard/projects");
    revalidatePath(`/dashboard/projects/${projectId}`);
    return { success: true, message: "Membre assigné au projet avec succès." };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

/**
 * Server Action: Remove a member from a project
 */
export async function removeProjectMemberAction(
  projectId: string,
  userId: string
): Promise<ActionResponse> {
  try {
    const validProj = z.string().uuid("ID de projet invalide").safeParse(projectId);
    const validUser = z.string().uuid("ID d'utilisateur invalide").safeParse(userId);

    if (!validProj.success || !validUser.success) {
      return { success: false, message: "Paramètres invalides." };
    }

    const { user, profile, department } = await requireProfile();
    const supabase = await createClient();

    const { data: project } = await (supabase.from("projects") as any)
      .select("id, department_id, title")
      .eq("id", projectId)
      .single();

    if (!project) return { success: false, message: "Projet introuvable" };

    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const isDeptCoord = profile.role === "COORDINATOR" && department?.id === project.department_id;

    if (!isSuperAdmin && !isDeptCoord && user.id !== userId) {
      throw new AuthorizationError("FORBIDDEN: Vous n'avez pas le droit de retirer des membres de ce projet.");
    }

    const { error } = await (supabase.from("project_members") as any)
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", userId);

    if (error) {
      return { success: false, message: error.message };
    }

    // Log activity
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "PROJECT_MEMBER_REMOVED",
      entity_type: "project",
      entity_id: projectId,
      details: { targetUserId: userId },
    });

    revalidatePath("/dashboard/projects");
    revalidatePath(`/dashboard/projects/${projectId}`);
    return { success: true, message: "Membre retiré du projet avec succès." };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
