"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, AuthorizationError } from "@/lib/auth/rbac";
import type { TaskPriority, TaskStatus } from "@/lib/data/tasks";

const TaskCreateSchema = z.object({
  title: z.string().min(3, "Le titre de la tâche doit comporter au moins 3 caractères").max(200),
  description: z.string().optional().nullable(),
  acceptance_criteria: z.string().optional().nullable(),
  project_id: z.string().uuid("ID de projet invalide").optional().nullable(),
  department_id: z.string().uuid("ID de département invalide"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  deadline: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
  assignee_ids: z.array(z.string().uuid()).default([]),
});

export interface ActionResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

/**
 * Server Action: Create a new Task
 * Authorization: SUPER_ADMIN or COORDINATOR of the target department.
 */
export async function createTaskAction(rawInput: unknown): Promise<ActionResponse> {
  try {
    const { user, profile, department } = await requireProfile();

    const parseResult = TaskCreateSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        message: "Erreur de validation de la tâche",
        errors: parseResult.error.flatten().fieldErrors,
      };
    }

    const data = parseResult.data;

    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const isDeptCoord = profile.role === "COORDINATOR" && department?.id === data.department_id;

    if (!isSuperAdmin && !isDeptCoord) {
      throw new AuthorizationError("FORBIDDEN: Seuls le Super Admin ou le Coordinateur du pôle peuvent créer des tâches.");
    }

    const supabase = await createClient();

    // Insert task
    const { data: newTask, error: insertErr } = await (supabase.from("tasks") as any)
      .insert({
        title: data.title,
        description: data.description || null,
        acceptance_criteria: data.acceptance_criteria || null,
        project_id: data.project_id || null,
        department_id: data.department_id,
        priority: data.priority,
        status: "TODO",
        start_date: data.start_date || null,
        deadline: data.deadline || null,
        created_by: user.id,
        coordinator_id: isDeptCoord ? user.id : null,
      })
      .select("id, title")
      .single();

    if (insertErr || !newTask) {
      return {
        success: false,
        message: `Erreur base de données: ${insertErr?.message}`,
      };
    }

    // Insert assignees if any
    if (data.assignee_ids && data.assignee_ids.length > 0) {
      const assigneeRows = data.assignee_ids.map((uid) => ({
        task_id: newTask.id,
        user_id: uid,
      }));

      await (supabase.from("task_assignees") as any).insert(assigneeRows);
    }

    // Log activity
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "TASK_CREATED",
      entity_type: "task",
      entity_id: newTask.id,
      details: { title: newTask.title },
    });

    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Tâche "${newTask.title}" créée avec succès.`,
      data: newTask,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Erreur lors de la création de la tâche.",
    };
  }
}

/**
 * Server Action: Update Task Status
 * Workflow security:
 * - Members can update to 'TODO' or 'IN_PROGRESS' for tasks assigned to them.
 * - Submissions must go through submitDeliverableAction.
 * - Final approval is exclusively reserved for SUPER_ADMIN.
 */
export async function updateTaskStatusAction(
  taskId: string,
  newStatus: TaskStatus
): Promise<ActionResponse> {
  try {
    const { user, profile, department } = await requireProfile();

    // Disallow setting 'APPROVED' directly without going through final approval workflow
    if (newStatus === "APPROVED" && profile.role !== "SUPER_ADMIN") {
      throw new AuthorizationError("FORBIDDEN: Seul le Super Administrateur peut approuver définitivement une tâche.");
    }

    const supabase = await createClient();

    // Check task ownership / assignment
    const { data: task, error: fetchErr } = await (supabase.from("tasks") as any)
      .select("id, department_id, status")
      .eq("id", taskId)
      .single();

    if (fetchErr || !task) {
      return { success: false, message: "Tâche introuvable" };
    }

    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const isDeptCoord = profile.role === "COORDINATOR" && department?.id === task.department_id;

    // Prevent regressing approved, locked or review tasks by non-super-admin
    const lockedStatuses: TaskStatus[] = ["COORDINATOR_REVIEW", "SUPER_ADMIN_APPROVAL", "APPROVED", "DONE", "CANCELLED"];
    if (lockedStatuses.includes(task.status as TaskStatus) && !isSuperAdmin) {
      throw new AuthorizationError(
        `FORBIDDEN: Cette tâche est en phase "${task.status}" et ne peut pas être modifiée unilatéralement.`
      );
    }

    if (!isSuperAdmin && !isDeptCoord) {
      // Check if user is an assigned member
      const { data: assignment } = await (supabase.from("task_assignees") as any)
        .select("id")
        .eq("task_id", taskId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!assignment) {
        throw new AuthorizationError("FORBIDDEN: Vous n'êtes pas assigné à cette tâche.");
      }

      // Member can only move between TODO and IN_PROGRESS
      if (newStatus !== "TODO" && newStatus !== "IN_PROGRESS") {
        throw new AuthorizationError(
          "FORBIDDEN: Pour soumettre ce travail à validation, utilisez le formulaire de dépôt de livrable."
        );
      }
    }

    const { error: updateErr } = await (supabase.from("tasks") as any)
      .update({ status: newStatus })
      .eq("id", taskId);

    if (updateErr) {
      return { success: false, message: updateErr.message };
    }

    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Statut de la tâche mis à jour (${newStatus}).`,
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

/**
 * Server Action: Submit a Work Deliverable
 * Submits work to the Coordinator for technical review.
 */
export async function submitDeliverableAction(
  taskId: string,
  title: string,
  description: string,
  fileUrls: string[] = []
): Promise<ActionResponse> {
  try {
    const { user, profile, department } = await requireProfile();

    if (!taskId || !title || !description) {
      return { success: false, message: "Tous les champs obligatoires doivent être renseignés." };
    }

    const supabase = await createClient();

    // Verify task exists and caller has authority (assigned, coordinator of dept, or super admin)
    const { data: task } = await (supabase.from("tasks") as any)
      .select("id, department_id, title, status")
      .eq("id", taskId)
      .single();

    if (!task) return { success: false, message: "Tâche introuvable" };

    if (task.status === "APPROVED" || task.status === "DONE" || task.status === "CANCELLED") {
      return {
        success: false,
        message: `FORBIDDEN: Impossible de soumettre un livrable pour une tâche au statut "${task.status}".`,
      };
    }

    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const isDeptCoord = profile.role === "COORDINATOR" && department?.id === task.department_id;

    if (!isSuperAdmin && !isDeptCoord) {
      const { data: assignment } = await (supabase.from("task_assignees") as any)
        .select("id")
        .eq("task_id", taskId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!assignment) {
        throw new AuthorizationError(
          "FORBIDDEN: Vous n'êtes pas assigné à cette tâche pour y déposer un livrable."
        );
      }
    }

    // Get highest version
    const { data: prevSubs } = await (supabase.from("task_submissions") as any)
      .select("version")
      .eq("task_id", taskId)
      .order("version", { ascending: false })
      .limit(1);

    const nextVersion = prevSubs && prevSubs.length > 0 ? prevSubs[0].version + 1 : 1;

    // Insert submission
    const { data: newSub, error: subErr } = await (supabase.from("task_submissions") as any)
      .insert({
        task_id: taskId,
        submitted_by: user.id,
        version: nextVersion,
        title,
        description,
        file_urls: fileUrls,
        status: "PENDING_COORDINATOR",
      })
      .select("id")
      .single();

    if (subErr || !newSub) {
      return { success: false, message: `Erreur lors du dépôt du livrable: ${subErr?.message}` };
    }

    // Update task status to COORDINATOR_REVIEW
    await (supabase.from("tasks") as any)
      .update({ status: "COORDINATOR_REVIEW" })
      .eq("id", taskId);

    // Log in approval history
    await (supabase.from("approval_history") as any).insert({
      submission_id: newSub.id,
      task_id: taskId,
      actor_id: user.id,
      action: "SUBMITTED",
      decision_reason: `Version ${nextVersion} soumise pour revue d'équipe : ${title}`,
    });

    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Livrable (v${nextVersion}) soumis avec succès au coordinateur pour revue technique.`,
      data: newSub,
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

/**
 * Server Action: Add Comment to Task
 */
export async function addTaskCommentAction(taskId: string, content: string): Promise<ActionResponse> {
  try {
    const { user, profile, department } = await requireProfile();

    if (!taskId || !content || content.trim().length === 0) {
      return { success: false, message: "Le commentaire ne peut être vide." };
    }

    const supabase = await createClient();

    // Verify task exists and user has access (Super Admin, dept coordinator, or assigned member)
    const { data: task } = await (supabase.from("tasks") as any)
      .select("id, department_id")
      .eq("id", taskId)
      .single();

    if (!task) return { success: false, message: "Tâche introuvable" };

    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const isDeptCoord = profile.role === "COORDINATOR" && department?.id === task.department_id;

    if (!isSuperAdmin && !isDeptCoord) {
      const { data: assignment } = await (supabase.from("task_assignees") as any)
        .select("id")
        .eq("task_id", taskId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!assignment) {
        throw new AuthorizationError("FORBIDDEN: Vous n'avez pas accès aux commentaires de cette tâche.");
      }
    }

    const { error } = await (supabase.from("task_comments") as any).insert({
      task_id: taskId,
      user_id: user.id,
      content: content.trim(),
    });

    if (error) {
      return { success: false, message: error.message };
    }

    revalidatePath(`/dashboard/tasks`);
    return { success: true, message: "Commentaire publié." };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
