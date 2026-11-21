"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, assertActionSuperAdmin, AuthorizationError } from "@/lib/auth/rbac";
import type { UserRole } from "@/lib/auth/rbac";

export interface MemberActionResponse {
  success: boolean;
  message: string;
}

/**
 * Server Action: Assign a member to a department
 * Authorization: SUPER_ADMIN or COORDINATOR of the target department.
 */
export async function assignDepartmentMemberAction(
  departmentId: string,
  userId: string
): Promise<MemberActionResponse> {
  try {
    const { profile, department } = await requireProfile();

    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const isDeptCoord = profile.role === "COORDINATOR" && department?.id === departmentId;

    if (!isSuperAdmin && !isDeptCoord) {
      throw new AuthorizationError("FORBIDDEN: Vous n'avez pas l'autorité pour assigner des membres dans ce pôle.");
    }

    const supabase = await createClient();

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
    // Re-verify Super Admin role from trusted profiles record
    await assertActionSuperAdmin();

    const supabase = await createClient();

    const { error } = await (supabase.from("profiles") as any)
      .update({ role: newRole })
      .eq("id", userId);

    if (error) {
      return { success: false, message: `Erreur lors de la modification du rôle: ${error.message}` };
    }

    revalidatePath("/dashboard/users");
    revalidatePath("/dashboard");

    return { success: true, message: `Rôle mis à jour (${newRole}) avec succès.` };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
