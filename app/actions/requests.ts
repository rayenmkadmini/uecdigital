"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, AuthorizationError } from "@/lib/auth/rbac";
import type { RequestCategory, RequestPriority, RequestStatus } from "@/lib/data/requests";

const UuidSchema = z.string().uuid("ID invalide");

const RequestCreateSchema = z.object({
  title: z.string().min(3, "Le titre doit comporter au moins 3 caractères").max(150),
  description: z.string().min(5, "Veuillez fournir une description détaillée du besoin"),
  category: z.enum(["DESIGN", "VIDEO", "WEB", "PHOTO", "LOGISTICS", "COMMUNICATION", "GENERAL"]),
  target_department_id: z.string().uuid("Veuillez sélectionner un pôle destinataire valide"),
  requesting_department_id: z.string().uuid().optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  desired_deadline: z.string().optional().nullable(),
});

const RequestUpdateSchema = z.object({
  title: z.string().min(3).max(150).optional(),
  description: z.string().min(5).optional(),
  category: z.enum(["DESIGN", "VIDEO", "WEB", "PHOTO", "LOGISTICS", "COMMUNICATION", "GENERAL"]).optional(),
  target_department_id: z.string().uuid().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  desired_deadline: z.string().optional().nullable(),
});

const RequestStatusEnum = z.enum([
  "NEW",
  "ACCEPTED",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
  "CONVERTED_TO_TASK",
]);

export interface ActionResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export async function createServiceRequestAction(rawInput: unknown): Promise<ActionResponse> {
  try {
    const { user, profile } = await requireProfile();

    const parseResult = RequestCreateSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        message: "Erreur de validation de la demande",
        errors: parseResult.error.flatten().fieldErrors,
      };
    }

    const data = parseResult.data;
    const supabase = await createClient();

    // Generate readable code: REQ-YYYY-XXXX
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const code = `REQ-${new Date().getFullYear()}-${randomSuffix}`;

    const insertPayload: any = {
      code,
      title: data.title,
      description: data.description,
      category: data.category,
      target_department_id: data.target_department_id,
      requesting_department_id: data.requesting_department_id || null,
      requester_id: user.id,
      priority: data.priority,
      desired_deadline: data.desired_deadline ? new Date(data.desired_deadline).toISOString() : null,
      status: "NEW",
      attachments: [],
    };

    const { data: inserted, error } = await (supabase.from("service_requests") as any)
      .insert(insertPayload)
      .select("id, code, title")
      .single();

    if (error || !inserted) {
      console.error("Supabase insert service_requests error:", error);
      return { success: false, message: `Erreur lors de la création: ${error?.message}` };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "CREATE_SERVICE_REQUEST",
      entity_type: "service_requests",
      entity_id: inserted.id,
      details: { code: inserted.code, title: inserted.title, target_department_id: data.target_department_id },
    });

    revalidatePath("/dashboard/requests");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Demande ${inserted.code} soumise avec succès`,
      data: inserted,
    };
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: err.message || "Erreur interne" };
  }
}

export async function updateRequestStatusAction(
  requestId: string,
  newStatus: RequestStatus,
  reason?: string
): Promise<ActionResponse> {
  try {
    const validId = UuidSchema.safeParse(requestId);
    if (!validId.success) {
      return { success: false, message: "ID de demande invalide" };
    }

    const validStatus = RequestStatusEnum.safeParse(newStatus);
    if (!validStatus.success) {
      return { success: false, message: "Statut de demande non reconnu" };
    }

    const { user, profile, department } = await requireProfile();
    const supabase = await createClient();

    const { data: req, error: fetchErr } = await (supabase.from("service_requests") as any)
      .select("id, code, title, requester_id, target_department_id, status")
      .eq("id", validId.data)
      .single();

    if (fetchErr || !req) {
      return { success: false, message: "Demande introuvable" };
    }

    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const isTargetCoord = profile.role === "COORDINATOR" && department?.id === req.target_department_id;
    const isRequester = req.requester_id === user.id;

    // RBAC: Accepting / Rejecting can only be done by Super Admin or Coordinator of the target department
    if ((validStatus.data === "ACCEPTED" || validStatus.data === "REJECTED" || validStatus.data === "IN_PROGRESS" || validStatus.data === "COMPLETED") && !isSuperAdmin && !isTargetCoord) {
      throw new AuthorizationError("FORBIDDEN: Seuls le coordinateur du pôle cible ou le Super Admin peuvent traiter cette demande.");
    }

    // Requester can only cancel their own request if not yet completed/accepted
    if (!isSuperAdmin && !isTargetCoord && !isRequester) {
      throw new AuthorizationError("FORBIDDEN: Vous n'avez pas l'autorisation de modifier cette demande.");
    }

    const updatePayload: any = {
      status: validStatus.data,
      updated_at: new Date().toISOString(),
    };

    if (validStatus.data === "ACCEPTED") {
      updatePayload.assigned_coordinator_id = user.id;
    }

    if (validStatus.data === "REJECTED" && reason) {
      updatePayload.rejection_reason = reason.trim();
    }

    const { data: updated, error } = await (supabase.from("service_requests") as any)
      .update(updatePayload)
      .eq("id", validId.data)
      .select("id, code, title, status")
      .single();

    if (error || !updated) {
      console.error("Supabase update service_requests error:", error);
      return { success: false, message: `Erreur lors de la mise à jour: ${error?.message}` };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "UPDATE_SERVICE_REQUEST_STATUS",
      entity_type: "service_requests",
      entity_id: validId.data,
      details: { code: req.code, title: req.title, previousStatus: req.status, newStatus: validStatus.data, reason: reason || null },
    });

    // Notify requester if status changed by coordinator/admin
    if (req.requester_id && req.requester_id !== user.id) {
      await (supabase.from("notifications") as any).insert({
        user_id: req.requester_id,
        title: `Mise à jour demande [${req.code}]`,
        message: `Votre demande "${req.title}" est maintenant: ${validStatus.data}${reason ? ` (${reason})` : ""}.`,
        type: "SYSTEM",
        link: `/dashboard/requests`,
      });
    }

    revalidatePath("/dashboard/requests");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Statut de la demande mis à jour : ${validStatus.data}`,
      data: updated,
    };
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: err.message || "Erreur interne" };
  }
}

export async function convertRequestToTaskAction(requestId: string): Promise<ActionResponse> {
  try {
    const validId = UuidSchema.safeParse(requestId);
    if (!validId.success) {
      return { success: false, message: "ID de demande invalide" };
    }

    const { user, profile, department } = await requireProfile();
    const supabase = await createClient();

    // 1. Fetch the request
    const { data: req, error: reqErr } = await (supabase.from("service_requests") as any)
      .select("*")
      .eq("id", validId.data)
      .single();

    if (reqErr || !req) {
      return { success: false, message: "Demande introuvable" };
    }

    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const isTargetCoord = profile.role === "COORDINATOR" && department?.id === req.target_department_id;

    if (!isSuperAdmin && !isTargetCoord) {
      throw new AuthorizationError("FORBIDDEN: Seuls le Super Admin ou le Coordinateur du pôle destinataire peuvent convertir une demande en tâche.");
    }

    // 2. Create the task
    const { data: task, error: taskErr } = await (supabase.from("tasks") as any)
      .insert({
        title: `[${req.code}] ${req.title}`,
        description: req.description,
        department_id: req.target_department_id,
        priority: req.priority,
        status: "TODO",
        deadline: req.desired_deadline ? new Date(req.desired_deadline).toISOString() : null,
        created_by: user.id,
        coordinator_id: user.id,
      })
      .select("id, title")
      .single();

    if (taskErr || !task) {
      console.error("Error creating task from request:", taskErr);
      return { success: false, message: `Impossible de convertir en tâche: ${taskErr?.message}` };
    }

    // 3. Update the request
    await (supabase.from("service_requests") as any)
      .update({
        status: "CONVERTED_TO_TASK",
        converted_task_id: task.id,
        assigned_coordinator_id: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", validId.data);

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "CONVERT_REQUEST_TO_TASK",
      entity_type: "service_requests",
      entity_id: validId.data,
      details: { code: req.code, taskId: task.id, taskTitle: task.title },
    });

    // Notify requester
    if (req.requester_id && req.requester_id !== user.id) {
      await (supabase.from("notifications") as any).insert({
        user_id: req.requester_id,
        title: `Demande [${req.code}] acceptée et planifiée`,
        message: `Votre demande a été convertie en tâche opérationnelle "${task.title}".`,
        type: "TASK",
        link: `/dashboard/tasks`,
      });
    }

    revalidatePath("/dashboard/requests");
    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Demande convertie avec succès en tâche opérationnelle`,
      data: task,
    };
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: err.message || "Erreur interne" };
  }
}

export async function deleteServiceRequestAction(requestId: string): Promise<ActionResponse> {
  try {
    const validId = UuidSchema.safeParse(requestId);
    if (!validId.success) {
      return { success: false, message: "ID de demande invalide" };
    }

    const { user, profile } = await requireProfile();
    const supabase = await createClient();

    const { data: req, error: fetchErr } = await (supabase.from("service_requests") as any)
      .select("id, code, title, requester_id, status")
      .eq("id", validId.data)
      .single();

    if (fetchErr || !req) {
      return { success: false, message: "Demande introuvable" };
    }

    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const isRequester = req.requester_id === user.id && req.status === "NEW";

    if (!isSuperAdmin && !isRequester) {
      throw new AuthorizationError("FORBIDDEN: Vous n'avez pas l'autorisation de supprimer cette demande.");
    }

    const { error: delErr } = await (supabase.from("service_requests") as any)
      .delete()
      .eq("id", validId.data);

    if (delErr) {
      return { success: false, message: `Erreur: ${delErr.message}` };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "DELETE_SERVICE_REQUEST",
      entity_type: "service_requests",
      entity_id: validId.data,
      details: { code: req.code, title: req.title },
    });

    revalidatePath("/dashboard/requests");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Demande ${req.code} supprimée avec succès.`,
    };
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: err.message || "Erreur interne" };
  }
}
