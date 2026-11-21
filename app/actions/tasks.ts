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

const TaskUpdateSchema = z.object({
  title: z.string().min(3, "Le titre de la tâche doit comporter au moins 3 caractères").max(200).optional(),
  description: z.string().optional().nullable(),
  acceptance_criteria: z.string().optional().nullable(),
  project_id: z.string().uuid("ID de projet invalide").optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  deadline: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
});

const TaskStatusEnum = z.enum([
  "TODO",
  "IN_PROGRESS",
  "COORDINATOR_REVIEW",
  "SUPER_ADMIN_APPROVAL",
  "APPROVED",
  "REVISION_REQUIRED",
  "DONE",
  "CANCELLED",
]);

const DeliverableSubmitSchema = z.object({
  taskId: z.string().uuid("ID de tâche invalide"),
  title: z.string().min(3, "Le titre du livrable doit comporter au moins 3 caractères").max(200),
  description: z.string().min(3, "La description doit comporter au moins 3 caractères"),
  fileUrls: z.array(z.string().min(1)).default([]),
});

const TaskCommentSchema = z.object({
  taskId: z.string().uuid("ID de tâche invalide"),
  content: z.string().min(1, "Le commentaire ne peut pas être vide").max(2000, "Commentaire trop long"),
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

      // Notify assignees
      const notificationRows = data.assignee_ids.map((uid) => ({
        user_id: uid,
        title: "Nouvelle tâche assignée",
        message: `Vous avez été assigné à la tâche: "${newTask.title}"`,
        type: "TASK",
        link: `/dashboard/tasks`,
      }));
      await (supabase.from("notifications") as any).insert(notificationRows);
    }

    // Log activity
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "TASK_CREATED",
      entity_type: "task",
      entity_id: newTask.id,
      details: { title: newTask.title, department_id: data.department_id },
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
 * Server Action: Update Task Details
 * Authorization: SUPER_ADMIN or COORDINATOR of the task's department.
 */
export async function updateTaskAction(taskId: string, rawInput: unknown): Promise<ActionResponse> {
  try {
    const validId = z.string().uuid("ID de tâche invalide").safeParse(taskId);
    if (!validId.success) {
      return { success: false, message: "ID de tâche invalide" };
    }

    const parseResult = TaskUpdateSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        message: "Données de modification invalides",
        errors: parseResult.error.flatten().fieldErrors,
      };
    }

    const { user, profile, department } = await requireProfile();
    const supabase = await createClient();

    const { data: task, error: fetchErr } = await (supabase.from("tasks") as any)
      .select("id, department_id, title")
      .eq("id", taskId)
      .single();

    if (fetchErr || !task) {
      return { success: false, message: "Tâche introuvable" };
    }

    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const isDeptCoord = profile.role === "COORDINATOR" && department?.id === task.department_id;

    if (!isSuperAdmin && !isDeptCoord) {
      throw new AuthorizationError("FORBIDDEN: Vous n'avez pas l'autorisation de modifier cette tâche.");
    }

    const data = parseResult.data;
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.acceptance_criteria !== undefined) updatePayload.acceptance_criteria = data.acceptance_criteria;
    if (data.project_id !== undefined) updatePayload.project_id = data.project_id;
    if (data.priority !== undefined) updatePayload.priority = data.priority;
    if (data.deadline !== undefined) updatePayload.deadline = data.deadline;
    if (data.start_date !== undefined) updatePayload.start_date = data.start_date;

    const { error: updateErr } = await (supabase.from("tasks") as any)
      .update(updatePayload)
      .eq("id", taskId);

    if (updateErr) {
      return { success: false, message: `Erreur: ${updateErr.message}` };
    }

    // Log activity
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "TASK_UPDATED",
      entity_type: "task",
      entity_id: taskId,
      details: { title: task.title, changes: updatePayload },
    });

    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/tasks/${taskId}`);
    revalidatePath("/dashboard");

    return {
      success: true,
      message: "Tâche mise à jour avec succès.",
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Erreur lors de la mise à jour." };
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
    const validId = z.string().uuid("ID de tâche invalide").safeParse(taskId);
    if (!validId.success) {
      return { success: false, message: "ID de tâche invalide" };
    }

    const validStatus = TaskStatusEnum.safeParse(newStatus);
    if (!validStatus.success) {
      return { success: false, message: "Statut de tâche invalide" };
    }

    const statusValue = validStatus.data;
    const { user, profile, department } = await requireProfile();

    // Disallow setting 'APPROVED' directly without going through final approval workflow
    if (statusValue === "APPROVED" && profile.role !== "SUPER_ADMIN") {
      throw new AuthorizationError("FORBIDDEN: Seul le Super Administrateur peut approuver définitivement une tâche.");
    }

    const supabase = await createClient();

    // Check task ownership / assignment
    const { data: task, error: fetchErr } = await (supabase.from("tasks") as any)
      .select("id, department_id, status, title, coordinator_id, created_by")
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
      if (statusValue !== "TODO" && statusValue !== "IN_PROGRESS") {
        throw new AuthorizationError(
          "FORBIDDEN: Pour soumettre ce travail à validation, utilisez le formulaire de dépôt de livrable."
        );
      }
    }

    const { error: updateErr } = await (supabase.from("tasks") as any)
      .update({ status: statusValue, updated_at: new Date().toISOString() })
      .eq("id", taskId);

    if (updateErr) {
      return { success: false, message: updateErr.message };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "TASK_STATUS_UPDATED",
      entity_type: "task",
      entity_id: taskId,
      details: { title: task.title, previousStatus: task.status, newStatus: statusValue },
    });

    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/tasks/${taskId}`);
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Statut de la tâche mis à jour (${statusValue}).`,
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
    const parseResult = DeliverableSubmitSchema.safeParse({
      taskId,
      title,
      description,
      fileUrls,
    });

    if (!parseResult.success) {
      return {
        success: false,
        message: "Erreur de validation du livrable",
        errors: parseResult.error.flatten().fieldErrors,
      };
    }

    const validData = parseResult.data;
    const { user, profile, department } = await requireProfile();
    const supabase = await createClient();

    // Verify task exists and caller has authority (assigned, coordinator of dept, or super admin)
    const { data: task, error: taskErr } = await (supabase.from("tasks") as any)
      .select("id, department_id, title, status, coordinator_id")
      .eq("id", validData.taskId)
      .single();

    if (taskErr || !task) return { success: false, message: "Tâche introuvable" };

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
        .eq("task_id", validData.taskId)
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
      .eq("task_id", validData.taskId)
      .order("version", { ascending: false })
      .limit(1);

    const nextVersion = prevSubs && prevSubs.length > 0 ? prevSubs[0].version + 1 : 1;

    // Insert submission
    const { data: newSub, error: subErr } = await (supabase.from("task_submissions") as any)
      .insert({
        task_id: validData.taskId,
        submitted_by: user.id,
        version: nextVersion,
        title: validData.title,
        description: validData.description,
        file_urls: validData.fileUrls,
        status: "PENDING_COORDINATOR",
      })
      .select("id")
      .single();

    if (subErr || !newSub) {
      return { success: false, message: `Erreur lors du dépôt du livrable: ${subErr?.message}` };
    }

    // Update task status to COORDINATOR_REVIEW
    await (supabase.from("tasks") as any)
      .update({ status: "COORDINATOR_REVIEW", updated_at: new Date().toISOString() })
      .eq("id", validData.taskId);

    // Log in approval history
    await (supabase.from("approval_history") as any).insert({
      submission_id: newSub.id,
      task_id: validData.taskId,
      actor_id: user.id,
      action: "SUBMITTED",
      decision_reason: `Version ${nextVersion} soumise pour revue d'équipe : ${validData.title}`,
    });

    // Log activity
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "DELIVERABLE_SUBMITTED",
      entity_type: "task_submissions",
      entity_id: newSub.id,
      details: { taskId: validData.taskId, taskTitle: task.title, version: nextVersion, title: validData.title },
    });

    // Notify coordinator if assigned, or target department coordinators
    if (task.coordinator_id) {
      await (supabase.from("notifications") as any).insert({
        user_id: task.coordinator_id,
        title: "Nouveau livrable à valider",
        message: `${profile.full_name} a déposé un livrable (v${nextVersion}) pour "${task.title}".`,
        type: "APPROVAL",
        link: `/dashboard/approvals`,
      });
    }

    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/tasks/${validData.taskId}`);
    revalidatePath("/dashboard/approvals");
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
    const parseResult = TaskCommentSchema.safeParse({ taskId, content });
    if (!parseResult.success) {
      return {
        success: false,
        message: "Commentaire invalide",
        errors: parseResult.error.flatten().fieldErrors,
      };
    }

    const { user, profile, department } = await requireProfile();
    const supabase = await createClient();

    // Verify task exists and user has access (Super Admin, dept coordinator, or assigned member)
    const { data: task } = await (supabase.from("tasks") as any)
      .select("id, department_id, title")
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

    const { data: comment, error } = await (supabase.from("task_comments") as any)
      .insert({
        task_id: taskId,
        user_id: user.id,
        content: content.trim(),
      })
      .select("id")
      .single();

    if (error) {
      return { success: false, message: error.message };
    }

    // Log activity
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "TASK_COMMENT_ADDED",
      entity_type: "task",
      entity_id: taskId,
      details: { taskTitle: task.title, commentId: comment?.id },
    });

    revalidatePath(`/dashboard/tasks`);
    revalidatePath(`/dashboard/tasks/${taskId}`);
    return { success: true, message: "Commentaire publié avec succès." };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

/**
 * Server Action: Delete Task
 * Authorization: SUPER_ADMIN or COORDINATOR of the task's department.
 */
export async function deleteTaskAction(taskId: string): Promise<ActionResponse> {
  try {
    const validId = z.string().uuid("ID de tâche invalide").safeParse(taskId);
    if (!validId.success) {
      return { success: false, message: "ID de tâche invalide" };
    }

    const { user, profile, department } = await requireProfile();
    const supabase = await createClient();

    const { data: task, error: fetchErr } = await (supabase.from("tasks") as any)
      .select("id, department_id, title, status")
      .eq("id", taskId)
      .single();

    if (fetchErr || !task) {
      return { success: false, message: "Tâche introuvable" };
    }

    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const isDeptCoord = profile.role === "COORDINATOR" && department?.id === task.department_id;

    if (!isSuperAdmin && !isDeptCoord) {
      throw new AuthorizationError("FORBIDDEN: Seuls le Super Admin ou le Coordinateur peuvent supprimer cette tâche.");
    }

    // Delete assignees and comments first
    await (supabase.from("task_assignees") as any).delete().eq("task_id", taskId);
    await (supabase.from("task_comments") as any).delete().eq("task_id", taskId);

    const { error: delErr } = await (supabase.from("tasks") as any)
      .delete()
      .eq("id", taskId);

    if (delErr) {
      return { success: false, message: `Erreur lors de la suppression: ${delErr.message}` };
    }

    // Log activity
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "TASK_DELETED",
      entity_type: "task",
      entity_id: taskId,
      details: { title: task.title },
    });

    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Tâche "${task.title}" supprimée avec succès.`,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Erreur lors de la suppression." };
  }
}

/**
 * Server Action: Assign Members to Task
 */
export async function assignTaskMembersAction(
  taskId: string,
  userIds: string[]
): Promise<ActionResponse> {
  try {
    const validTaskId = z.string().uuid("ID de tâche invalide").safeParse(taskId);
    const validUserIds = z.array(z.string().uuid()).safeParse(userIds);

    if (!validTaskId.success || !validUserIds.success) {
      return { success: false, message: "Paramètres d'assignation invalides" };
    }

    const { user, profile, department } = await requireProfile();
    const supabase = await createClient();

    const { data: task, error: fetchErr } = await (supabase.from("tasks") as any)
      .select("id, department_id, title")
      .eq("id", taskId)
      .single();

    if (fetchErr || !task) {
      return { success: false, message: "Tâche introuvable" };
    }

    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const isDeptCoord = profile.role === "COORDINATOR" && department?.id === task.department_id;

    if (!isSuperAdmin && !isDeptCoord) {
      throw new AuthorizationError("FORBIDDEN: Vous n'avez pas l'autorisation d'assigner des membres à cette tâche.");
    }

    // Remove existing assignments
    await (supabase.from("task_assignees") as any).delete().eq("task_id", taskId);

    // Insert new assignments
    if (validUserIds.data.length > 0) {
      const rows = validUserIds.data.map((uid) => ({
        task_id: taskId,
        user_id: uid,
      }));
      await (supabase.from("task_assignees") as any).insert(rows);

      // Notify
      const notificationRows = validUserIds.data.map((uid) => ({
        user_id: uid,
        title: "Tâche assignée",
        message: `Vous êtes affecté à la tâche: "${task.title}"`,
        type: "TASK",
        link: `/dashboard/tasks`,
      }));
      await (supabase.from("notifications") as any).insert(notificationRows);
    }

    // Log activity
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "TASK_MEMBERS_ASSIGNED",
      entity_type: "task",
      entity_id: taskId,
      details: { taskTitle: task.title, count: validUserIds.data.length },
    });

    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/tasks/${taskId}`);

    return {
      success: true,
      message: "Assignations de la tâche mises à jour.",
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
