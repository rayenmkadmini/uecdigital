"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, assertActionSuperAdmin, AuthorizationError } from "@/lib/auth/rbac";
import type { UserRole } from "@/lib/auth/rbac";

export interface MemberActionResponse {
  success: boolean;
  message: string;
}

const UuidSchema = z.string().uuid("Identifiant UUID invalide");
const RoleSchema = z.enum(["SUPER_ADMIN", "COORDINATOR", "MEMBER"]);

/**
 * Server Action: Assign a member to a department
 * Authorization: SUPER_ADMIN or COORDINATOR of the target department.
 */
export async function assignDepartmentMemberAction(
  departmentId: string,
  userId: string
): Promise<MemberActionResponse> {
  try {
    const validDept = UuidSchema.safeParse(departmentId);
    const validUser = UuidSchema.safeParse(userId);

    if (!validDept.success || !validUser.success) {
      return { success: false, message: "Identifiants de département ou d'utilisateur invalides." };
    }

    const { profile, department } = await requireProfile();

    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const isDeptCoord = profile.role === "COORDINATOR" && department?.id === departmentId;

    if (!isSuperAdmin && !isDeptCoord) {
      throw new AuthorizationError("FORBIDDEN: Vous n'avez pas l'autorité pour assigner des membres dans ce pôle.");
    }

    const supabase = await createClient();

    // Verify target user exists and is active
    const { data: targetProfile, error: targetErr } = await (supabase.from("profiles") as any)
      .select("id, is_active")
      .eq("id", userId)
      .single();

    if (targetErr || !targetProfile) {
      return { success: false, message: "Utilisateur cible introuvable." };
    }

    if (!targetProfile.is_active) {
      return { success: false, message: "Impossible d'assigner un membre désactivé ou inactif." };
    }

    const { error } = await (supabase.from("department_members") as any).upsert(
      {
        department_id: departmentId,
        user_id: userId,
      },
      { onConflict: "department_id,user_id" }
    );

    if (error) {
      return { success: false, message: error.message };
    }

    revalidatePath("/dashboard/users");
    revalidatePath("/dashboard/departments");
    revalidatePath("/dashboard");

    return { success: true, message: "Membre assigné au pôle avec succès." };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

/**
 * Server Action: Update a Member's Role
 * Authorization: STRICTLY SUPER_ADMIN ONLY.
 */
export async function updateMemberRoleAction(
  userId: string,
  newRole: UserRole
): Promise<MemberActionResponse> {
  try {
    // 1. Re-verify Super Admin role from trusted profiles record
    const { user } = await assertActionSuperAdmin();

    const validUser = UuidSchema.safeParse(userId);
    const validRole = RoleSchema.safeParse(newRole);

    if (!validUser.success || !validRole.success) {
      return { success: false, message: "Données de modification de rôle invalides." };
    }

    // 2. Prevent self-demotion of the acting Super Admin
    if (user.id === userId && newRole !== "SUPER_ADMIN") {
      throw new AuthorizationError(
        "FORBIDDEN: Vous ne pouvez pas rétrograder votre propre compte Super Administrateur.",
        403
      );
    }

    const supabase = await createClient();

    const { error } = await (supabase.from("profiles") as any)
      .update({ role: validRole.data })
      .eq("id", userId);

    if (error) {
      return { success: false, message: `Erreur lors de la modification du rôle: ${error.message}` };
    }

    revalidatePath("/dashboard/users");
    revalidatePath("/dashboard");

    return { success: true, message: `Rôle mis à jour (${validRole.data}) avec succès.` };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
