"use server";

import { assertActionSuperAdmin, assertActionRole } from "@/lib/auth/rbac";
import { createClient } from "@/lib/supabase/server";

export interface ApprovalActionResult {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Server Action: Final Approval of a Submission
 * STRICT REQUIREMENT: Only authenticated SUPER_ADMIN can execute final approval.
 * Re-verifies identity and role from the database. Never trusts client parameters.
 */
export async function executeFinalApproval(
  submissionId: string,
  decisionNotes?: string
): Promise<ApprovalActionResult> {
  // 1. Server-side identity & role verification from trusted profiles record
  const { user, profile } = await assertActionSuperAdmin();

  if (!submissionId || typeof submissionId !== "string") {
    throw new Error("INVALID_INPUT: ID de soumission manquant");
  }

  const supabase = await createClient();

  // 2. Fetch the target submission to verify current status
  const { data: submission, error: fetchErr } = await (supabase.from("task_submissions") as any)
    .select("id, task_id, status, is_locked")
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
  };

  if (typedSubmission.is_locked) {
    return {
      success: false,
      message: "Ce livrable est déjà verrouillé et validé définitivement.",
    };
  }

  // 3. Execute update in PostgreSQL (Protected by check_task_submission_approval trigger and RLS)
  const { error: updateErr } = await (supabase.from("task_submissions") as any)
    .update({
      status: "APPROVED",
      super_admin_id: user.id,
      super_admin_notes: decisionNotes || "Validé définitivement par le Super Administrateur",
      approved_by_super_admin_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  if (updateErr) {
    return {
      success: false,
      message: `Erreur base de données: ${updateErr.message}`,
    };
  }

  // 4. Log in approval history
  await (supabase.from("approval_history") as any).insert({
    submission_id: submissionId,
    task_id: typedSubmission.task_id,
    actor_id: user.id,
    action: "APPROVED",
    decision_reason: decisionNotes || "Approbation finale officielle",
  });

  return {
    success: true,
    message: `Livrable ${submissionId} validé avec succès par le Super Admin (${profile.full_name}).`,
  };
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
  // 1. Role verification: Only COORDINATOR or SUPER_ADMIN
  const { user, profile } = await assertActionRole(["COORDINATOR", "SUPER_ADMIN"]);

  const supabase = await createClient();

  const { data: submission, error: fetchErr } = await (supabase.from("task_submissions") as any)
    .select("id, task_id, status")
    .eq("id", submissionId)
    .single();

  if (fetchErr || !submission) {
    return {
      success: false,
      message: "Soumission introuvable",
    };
  }

  const typedSubmission = submission as {
    id: string;
    task_id: string;
    status: string;
  };

  const newStatus = action === "SUBMIT_TO_SUPER_ADMIN" ? "SUPER_ADMIN_APPROVAL" : "REVISION_REQUIRED";

  const { error: updateErr } = await (supabase.from("task_submissions") as any)
    .update({
      status: newStatus,
      coordinator_id: user.id,
      coordinateur_notes: notes,
      reviewed_by_coordinator_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  if (updateErr) {
    return {
      success: false,
      message: `Erreur lors de la revue: ${updateErr.message}`,
    };
  }

  await (supabase.from("approval_history") as any).insert({
    submission_id: submissionId,
    task_id: typedSubmission.task_id,
    actor_id: user.id,
    action: newStatus,
    decision_reason: `Revue coordinateur (${profile.full_name}) : ${notes}`,
  });

  return {
    success: true,
    message: `Revue de conformité enregistrée (${newStatus}).`,
  };
}
