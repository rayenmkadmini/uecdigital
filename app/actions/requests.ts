"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, AuthorizationError } from "@/lib/auth/rbac";
import type { RequestCategory, RequestPriority, RequestStatus } from "@/lib/data/requests";

const RequestCreateSchema = z.object({
  title: z.string().min(3, "Le titre doit comporter au moins 3 caractères").max(150),
  description: z.string().min(5, "Veuillez fournir une description détaillée du besoin"),
  category: z.enum(["DESIGN", "VIDEO", "WEB", "PHOTO", "LOGISTICS", "COMMUNICATION", "GENERAL"]),
  target_department_id: z.string().uuid("Veuillez sélectionner un pôle destinataire valide"),
  requesting_department_id: z.string().uuid().optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  desired_deadline: z.string().optional().nullable(),
});

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
      desired_deadline: data.desired_deadline || null,
      status: "NEW",
      attachments: [],
    };

    const { data: inserted, error } = await (supabase.from("service_requests") as any)
      .insert(insertPayload)
      .select("id, code, title")
      .single();

    if (error) {
      console.error("Supabase insert service_requests error:", error);
      return { success: false, message: `Erreur lors de la création: ${error.message}` };
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
    const { user, profile } = await requireProfile();
    const supabase = await createClient();

    const updatePayload: any = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === "ACCEPTED") {
      updatePayload.assigned_coordinator_id = user.id;
    }

    if (newStatus === "REJECTED" && reason) {
      updatePayload.rejection_reason = reason;
    }

    const { data: updated, error } = await (supabase.from("service_requests") as any)
      .update(updatePayload)
      .eq("id", requestId)
      .select("id, code, title, status")
      .single();

    if (error) {
      console.error("Supabase update service_requests error:", error);
      return { success: false, message: `Erreur lors de la mise à jour: ${error.message}` };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "UPDATE_SERVICE_REQUEST_STATUS",
      entity_type: "service_requests",
      entity_id: requestId,
      details: { newStatus, reason: reason || null },
    });

    revalidatePath("/dashboard/requests");
    return {
      success: true,
      message: `Statut de la demande mis à jour : ${newStatus}`,
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
    const { user, profile } = await requireProfile();
    const supabase = await createClient();

    // 1. Fetch the request
    const { data: req, error: reqErr } = await (supabase.from("service_requests") as any)
      .select("*")
      .eq("id", requestId)
      .single();

    if (reqErr || !req) {
      return { success: false, message: "Demande introuvable" };
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
      .eq("id", requestId);

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "CONVERT_REQUEST_TO_TASK",
      entity_type: "service_requests",
      entity_id: requestId,
      details: { taskId: task.id, taskTitle: task.title },
    });

    revalidatePath("/dashboard/requests");
    revalidatePath("/dashboard/tasks");

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
