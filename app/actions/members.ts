"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, assertActionSuperAdmin, AuthorizationError } from "@/lib/auth/rbac";
import type { UserRole } from "@/lib/auth/rbac";

export interface MemberActionResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
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

    const { user, profile, department } = await requireProfile();

    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const isDeptCoord = profile.role === "COORDINATOR" && department?.id === departmentId;

    if (!isSuperAdmin && !isDeptCoord) {
      throw new AuthorizationError("FORBIDDEN: Vous n'avez pas l'autorité pour assigner des membres dans ce pôle.");
    }

    const supabase = await createClient();

    // Verify target user exists and is active
    const { data: targetProfile, error: targetErr } = await (supabase.from("profiles") as any)
      .select("id, full_name, is_active")
      .eq("id", validUser.data)
      .single();

    if (targetErr || !targetProfile) {
      return { success: false, message: "Utilisateur cible introuvable." };
    }

    if (!targetProfile.is_active) {
      return { success: false, message: "Impossible d'assigner un membre désactivé ou inactif." };
    }

    // Get department name
    const { data: dept } = await (supabase.from("departments") as any)
      .select("id, name")
      .eq("id", validDept.data)
      .single();

    const { error } = await (supabase.from("department_members") as any).upsert(
      {
        department_id: validDept.data,
        user_id: validUser.data,
      },
      { onConflict: "department_id,user_id" }
    );

    if (error) {
      return { success: false, message: error.message };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "ASSIGN_DEPARTMENT_MEMBER",
      entity_type: "department_members",
      entity_id: validDept.data,
      details: { targetUserId: validUser.data, departmentName: dept?.name || null },
    });

    // Notify member
    await (supabase.from("notifications") as any).insert({
      user_id: validUser.data,
      title: "Affectation à un pôle",
      message: `Vous avez été affecté au pôle "${dept?.name || 'UEC'}".`,
      type: "SYSTEM",
      link: `/dashboard/departments`,
    });

    revalidatePath("/dashboard/users");
    revalidatePath("/dashboard/departments");
    revalidatePath("/dashboard");

    return { success: true, message: "Membre assigné au pôle avec succès." };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

/**
 * Server Action: Remove a member from a department
 */
export async function removeDepartmentMemberAction(
  departmentId: string,
  userId: string
): Promise<MemberActionResponse> {
  try {
    const validDept = UuidSchema.safeParse(departmentId);
    const validUser = UuidSchema.safeParse(userId);

    if (!validDept.success || !validUser.success) {
      return { success: false, message: "Identifiants invalides." };
    }

    const { user, profile, department } = await requireProfile();

    const isSuperAdmin = profile.role === "SUPER_ADMIN";
    const isDeptCoord = profile.role === "COORDINATOR" && department?.id === validDept.data;

    if (!isSuperAdmin && !isDeptCoord) {
      throw new AuthorizationError("FORBIDDEN: Vous n'avez pas l'autorité pour retirer des membres de ce pôle.");
    }

    const supabase = await createClient();

    const { error } = await (supabase.from("department_members") as any)
      .delete()
      .eq("department_id", validDept.data)
      .eq("user_id", validUser.data);

    if (error) {
      return { success: false, message: error.message };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "REMOVE_DEPARTMENT_MEMBER",
      entity_type: "department_members",
      entity_id: validDept.data,
      details: { targetUserId: validUser.data },
    });

    revalidatePath("/dashboard/users");
    revalidatePath("/dashboard/departments");
    revalidatePath("/dashboard");

    return { success: true, message: "Membre retiré du pôle avec succès." };
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

    const { data: targetProfile, error: fetchErr } = await (supabase.from("profiles") as any)
      .select("id, full_name, role")
      .eq("id", validUser.data)
      .single();

    if (fetchErr || !targetProfile) {
      return { success: false, message: "Membre introuvable." };
    }

    const { error } = await (supabase.from("profiles") as any)
      .update({ role: validRole.data, updated_at: new Date().toISOString() })
      .eq("id", validUser.data);

    if (error) {
      return { success: false, message: `Erreur lors de la modification du rôle: ${error.message}` };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "UPDATE_MEMBER_ROLE",
      entity_type: "profiles",
      entity_id: validUser.data,
      details: { memberName: targetProfile.full_name, previousRole: targetProfile.role, newRole: validRole.data },
    });

    // Notify member
    await (supabase.from("notifications") as any).insert({
      user_id: validUser.data,
      title: "Changement de rôle",
      message: `Votre rôle a été mis à jour : ${validRole.data}.`,
      type: "SYSTEM",
      link: `/dashboard`,
    });

    revalidatePath("/dashboard/users");
    revalidatePath("/dashboard");

    return { success: true, message: `Rôle mis à jour (${validRole.data}) avec succès.` };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

/**
 * Server Action: Toggle Member Active Status (Activate / Deactivate)
 * Authorization: STRICTLY SUPER_ADMIN ONLY.
 */
export async function toggleMemberActiveStatusAction(
  userId: string,
  isActive: boolean
): Promise<MemberActionResponse> {
  try {
    const { user } = await assertActionSuperAdmin();

    const validUser = UuidSchema.safeParse(userId);
    if (!validUser.success) {
      return { success: false, message: "ID de membre invalide." };
    }

    // Prevent self-deactivation
    if (user.id === validUser.data && !isActive) {
      throw new AuthorizationError("FORBIDDEN: Vous ne pouvez pas désactiver votre propre compte.", 403);
    }

    const supabase = await createClient();

    const { data: targetProfile, error: fetchErr } = await (supabase.from("profiles") as any)
      .select("id, full_name")
      .eq("id", validUser.data)
      .single();

    if (fetchErr || !targetProfile) {
      return { success: false, message: "Membre introuvable." };
    }

    const { error } = await (supabase.from("profiles") as any)
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", validUser.data);

    if (error) {
      return { success: false, message: `Erreur: ${error.message}` };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: isActive ? "ACTIVATE_MEMBER" : "DEACTIVATE_MEMBER",
      entity_type: "profiles",
      entity_id: validUser.data,
      details: { memberName: targetProfile.full_name, isActive },
    });

    revalidatePath("/dashboard/users");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: isActive ? `Compte de ${targetProfile.full_name} réactivé.` : `Compte de ${targetProfile.full_name} désactivé.`,
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
