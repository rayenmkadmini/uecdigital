"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertActionSuperAdmin, assertActionRole, AuthorizationError } from "@/lib/auth/rbac";
import { createClient } from "@/lib/supabase/server";

export interface ApprovalActionResult {
  success: boolean;
  message: string;
  data?: any;
  errors?: Record<string, string[]>;
}

const SubmissionIdSchema = z.string().uuid("ID de soumission invalide");
const ReviewActionSchema = z.enum(["SUBMIT_TO_SUPER_ADMIN", "REQUEST_REVISION"]);
const NotesSchema = z.string().min(1, "Les notes de décision sont obligatoires").max(1000);

/**
 * Server Action: Final Approval of a Submission
 * STRICT REQUIREMENT: Only authenticated SUPER_ADMIN can execute final approval.
 * Re-verifies identity and role from the database. Never trusts client parameters.
 */
export async function executeFinalApproval(
  submissionId: string,
  decisionNotes?: string
): Promise<ApprovalActionResult> {
  try {
    // 1. Server-side identity & role verification from trusted profiles record
    const { user, profile } = await assertActionSuperAdmin();

    const validId = SubmissionIdSchema.safeParse(submissionId);
    if (!validId.success) {
      return { success: false, message: "ID de soumission invalide" };
    }

    const validNotes = decisionNotes ? decisionNotes.trim().slice(0, 1000) : "Validé définitivement par le Super Administrateur";

    const supabase = await createClient();

    // 2. Fetch the target submission to verify current status
    const { data: submission, error: fetchErr } = await (supabase.from("task_submissions") as any)
      .select("id, task_id, status, is_locked, submitted_by, title")
      .eq("id", submissionId)
      .single();

    if (fetchErr || !submission) {
      return {
        success: false,
        message: "Soumission introuvable ou accès refusé",
      };
    }

    const typedSubmission = submission as {
      id: string;
      task_id: string;
      status: string;
      is_locked: boolean;
      submitted_by: string;
      title: string;
    };

    if (typedSubmission.is_locked) {
      return {
        success: false,
        message: "Ce livrable est déjà verrouillé et validé définitivement.",
      };
    }

    // 3. Execute update in PostgreSQL
    const { error: updateErr } = await (supabase.from("task_submissions") as any)
      .update({
        status: "APPROVED",
        is_locked: true,
        super_admin_id: user.id,
        super_admin_notes: validNotes,
        approved_by_super_admin_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", submissionId);

    if (updateErr) {
      return {
        success: false,
        message: `Erreur base de données: ${updateErr.message}`,
      };
    }

    // Also update parent task to APPROVED
    await (supabase.from("tasks") as any)
      .update({ status: "APPROVED", updated_at: new Date().toISOString() })
      .eq("id", typedSubmission.task_id);

    // 4. Log in approval history
    await (supabase.from("approval_history") as any).insert({
      submission_id: submissionId,
      task_id: typedSubmission.task_id,
      actor_id: user.id,
      action: "SUPER_ADMIN_APPROVED",
      decision_reason: validNotes,
    });

    // 5. Operational Audit Log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "SUBMISSION_FINAL_APPROVED",
      entity_type: "task_submissions",
      entity_id: submissionId,
      details: { taskId: typedSubmission.task_id, deliverableTitle: typedSubmission.title, notes: validNotes },
    });

    // 6. Notify Submitter
    if (typedSubmission.submitted_by) {
      await (supabase.from("notifications") as any).insert({
        user_id: typedSubmission.submitted_by,
        title: "Livrable validé avec succès !",
        message: `Votre livrable "${typedSubmission.title}" a reçu la validation officielle du Super Admin.`,
        type: "APPROVAL",
        link: `/dashboard/tasks`,
      });
    }

    revalidatePath("/dashboard/approvals");
    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/tasks/${typedSubmission.task_id}`);
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Livrable validé avec succès par le Super Admin (${profile.full_name}).`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Erreur lors de la validation finale.",
    };
  }
}

/**
 * Server Action: Coordinator Intermediate Review
 * Allowed for COORDINATOR (in their department) or SUPER_ADMIN.
 * Members are rejected with 403.
 */
export async function submitCoordinatorReview(
  submissionId: string,
  action: "SUBMIT_TO_SUPER_ADMIN" | "REQUEST_REVISION",
  notes: string
): Promise<ApprovalActionResult> {
  try {
    // 1. Role verification: Only COORDINATOR or SUPER_ADMIN
    const { user, profile, department } = await assertActionRole(["COORDINATOR", "SUPER_ADMIN"]);

    const validId = SubmissionIdSchema.safeParse(submissionId);
    const validAction = ReviewActionSchema.safeParse(action);
    const validNotes = NotesSchema.safeParse(notes);

    if (!validId.success) {
      return { success: false, message: "ID de soumission invalide" };
    }
    if (!validAction.success) {
      return { success: false, message: "Action de revue non valide" };
    }
    if (!validNotes.success) {
      return { success: false, message: "Les remarques de revue sont obligatoires (1 à 1000 caractères)" };
    }

    const supabase = await createClient();

    // 2. Fetch submission with parent task to verify lock status and department ownership
    const { data: submission, error: fetchErr } = await (supabase.from("task_submissions") as any)
      .select(`
        id,
        task_id,
        status,
        is_locked,
        submitted_by,
        title,
        tasks:task_id (
          id,
          title,
          department_id,
          status
        )
      `)
      .eq("id", submissionId)
      .single();

    if (fetchErr || !submission) {
      return {
        success: false,
        message: "Soumission introuvable",
      };
    }

    // Prevent modifying locked/approved submissions
    if (submission.is_locked || submission.status === "APPROVED") {
      return {
        success: false,
        message: "FORBIDDEN: Ce livrable est déjà verrouillé et validé définitivement.",
      };
    }

    // Cross-department check: Coordinators can ONLY review submissions from their own department
    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const taskDeptId = submission.tasks?.department_id;

    if (!isSuperAdmin && (!department || department.id !== taskDeptId)) {
      throw new AuthorizationError(
        "FORBIDDEN: Vous n'avez pas l'autorité pour réviser un livrable d'un autre pôle.",
        403
      );
    }

    const typedSubmission = submission as {
      id: string;
      task_id: string;
      status: string;
      submitted_by: string;
      title: string;
      tasks: { id: string; title: string; department_id: string; status: string } | null;
    };

    const newSubStatus = validAction.data === "SUBMIT_TO_SUPER_ADMIN" ? "PENDING_SUPER_ADMIN" : "REVISION_REQUIRED";
    const newTaskStatus = validAction.data === "SUBMIT_TO_SUPER_ADMIN" ? "SUPER_ADMIN_APPROVAL" : "REVISION_REQUIRED";

    const { error: updateErr } = await (supabase.from("task_submissions") as any)
      .update({
        status: newSubStatus,
        coordinator_id: user.id,
        coordinateur_notes: validNotes.data,
        reviewed_by_coordinator_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", submissionId);

    if (updateErr) {
      return {
        success: false,
        message: `Erreur lors de la revue: ${updateErr.message}`,
      };
    }

    // Also update parent task status
    await (supabase.from("tasks") as any)
      .update({ status: newTaskStatus, updated_at: new Date().toISOString() })
      .eq("id", typedSubmission.task_id);

    // Approval history
    const historyAction =
      validAction.data === "SUBMIT_TO_SUPER_ADMIN"
        ? "COORDINATOR_FORWARDED"
        : "COORDINATOR_REQUESTED_REVISION";

    await (supabase.from("approval_history") as any).insert({
      submission_id: submissionId,
      task_id: typedSubmission.task_id,
      actor_id: user.id,
      action: historyAction,
      decision_reason: `Revue coordinateur (${profile.full_name}) : ${validNotes.data}`,
    });

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: `COORDINATOR_REVIEW_${validAction.data}`,
      entity_type: "task_submissions",
      entity_id: submissionId,
      details: {
        taskId: typedSubmission.task_id,
        deliverableTitle: typedSubmission.title,
        status: newSubStatus,
        notes: validNotes.data,
      },
    });

    // Notifications
    if (validAction.data === "REQUEST_REVISION" && typedSubmission.submitted_by) {
      await (supabase.from("notifications") as any).insert({
        user_id: typedSubmission.submitted_by,
        title: "Demande de révision sur votre livrable",
        message: `Le coordinateur demande des retouches sur "${typedSubmission.title}": ${validNotes.data}`,
        type: "TASK",
        link: `/dashboard/tasks`,
      });
    }

    revalidatePath("/dashboard/approvals");
    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/tasks/${typedSubmission.task_id}`);
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Revue de conformité enregistrée (${newSubStatus}).`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Erreur lors de la revue de conformité.",
    };
  }
}

/**
 * Server Action: Super Admin Reject Submission
 * Authorization: STRICTLY SUPER_ADMIN ONLY.
 */
export async function rejectSubmissionAction(
  submissionId: string,
  rejectionReason: string
): Promise<ApprovalActionResult> {
  try {
    const { user, profile } = await assertActionSuperAdmin();

    const validId = SubmissionIdSchema.safeParse(submissionId);
    const validReason = NotesSchema.safeParse(rejectionReason);

    if (!validId.success || !validReason.success) {
      return { success: false, message: "Données de rejet invalides (motif obligatoire)" };
    }

    const supabase = await createClient();

    const { data: submission, error: fetchErr } = await (supabase.from("task_submissions") as any)
      .select("id, task_id, title, submitted_by, is_locked")
      .eq("id", submissionId)
      .single();

    if (fetchErr || !submission) {
      return { success: false, message: "Soumission introuvable" };
    }

    if (submission.is_locked) {
      return { success: false, message: "Ce livrable est déjà clôturé." };
    }

    await (supabase.from("task_submissions") as any)
      .update({
        status: "REJECTED",
        super_admin_id: user.id,
        super_admin_notes: validReason.data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", submissionId);

    await (supabase.from("tasks") as any)
      .update({ status: "REVISION_REQUIRED", updated_at: new Date().toISOString() })
      .eq("id", submission.task_id);

    await (supabase.from("approval_history") as any).insert({
      submission_id: submissionId,
      task_id: submission.task_id,
      actor_id: user.id,
      action: "SUPER_ADMIN_REJECTED",
      decision_reason: validReason.data,
    });

    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "SUBMISSION_REJECTED",
      entity_type: "task_submissions",
      entity_id: submissionId,
      details: { taskId: submission.task_id, deliverableTitle: submission.title, reason: validReason.data },
    });

    if (submission.submitted_by) {
      await (supabase.from("notifications") as any).insert({
        user_id: submission.submitted_by,
        title: "Livrable refusé par le Super Admin",
        message: `Motif du refus pour "${submission.title}": ${validReason.data}`,
        type: "APPROVAL",
        link: `/dashboard/tasks`,
      });
    }

    revalidatePath("/dashboard/approvals");
    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: "Livrable refusé et renvoyé à l'équipe.",
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Erreur lors du rejet du livrable." };
  }
}
