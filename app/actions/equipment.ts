"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, AuthorizationError } from "@/lib/auth/rbac";
import type { EquipmentCategory, EquipmentCondition, EquipmentStatus, LoanStatus } from "@/lib/data/equipment";

const EquipmentCreateSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9_-]+$/, "Le code doit être en majuscules sans espaces (ex: MAT-CAM-01)"),
  name: z.string().min(3, "Le nom du matériel doit comporter au moins 3 caractères").max(150),
  category: z.enum(["PHOTO_VIDEO", "AUDIO", "INFORMATIQUE", "ACCESSOIRES", "SONO", "LOGISTIQUE", "AUTRE"]),
  description: z.string().optional().nullable(),
  serial_number: z.string().optional().nullable(),
  condition: z.enum(["NEW", "EXCELLENT", "GOOD", "FAIR", "DAMAGED", "MAINTENANCE"]).default("GOOD"),
  storage_location: z.string().optional().nullable(),
  purchase_date: z.string().optional().nullable(),
});

export interface ActionResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export async function createEquipmentAction(rawInput: unknown): Promise<ActionResponse> {
  try {
    const { user, profile } = await requireProfile();
    if (profile.role !== "SUPER_ADMIN") {
      return { success: false, message: "Action réservée aux Super Administrateurs" };
    }

    const parseResult = EquipmentCreateSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        message: "Validation échouée pour le matériel",
        errors: parseResult.error.flatten().fieldErrors,
      };
    }

    const data = parseResult.data;
    const supabase = await createClient();

    const { data: inserted, error } = await (supabase.from("equipment") as any)
      .insert({
        code: data.code,
        name: data.name,
        category: data.category,
        description: data.description || null,
        serial_number: data.serial_number || null,
        condition: data.condition,
        status: "AVAILABLE",
        storage_location: data.storage_location || null,
        purchase_date: data.purchase_date || null,
      })
      .select("id, code, name")
      .single();

    if (error) {
      console.error("Supabase insert equipment error:", error);
      return { success: false, message: `Erreur: ${error.message}` };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "CREATE_EQUIPMENT",
      entity_type: "equipment",
      entity_id: inserted.id,
      details: { code: inserted.code, name: inserted.name },
    });

    revalidatePath("/dashboard/equipment");
    return {
      success: true,
      message: `Équipement [${inserted.code}] enregistré au catalogue`,
      data: inserted,
    };
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: err.message || "Erreur interne" };
  }
}

export async function requestEquipmentLoanAction(
  equipmentId: string,
  expectedReturnDate: string,
  notes?: string
): Promise<ActionResponse> {
  try {
    const { user, profile } = await requireProfile();
    const supabase = await createClient();

    // Verify equipment is available
    const { data: eq, error: eqErr } = await (supabase.from("equipment") as any)
      .select("id, name, status, condition")
      .eq("id", equipmentId)
      .single();

    if (eqErr || !eq) {
      return { success: false, message: "Matériel introuvable" };
    }

    if (eq.status !== "AVAILABLE") {
      return { success: false, message: "Ce matériel n'est pas disponible pour emprunt actuellement" };
    }

    const { data: loan, error: loanErr } = await (supabase.from("equipment_loans") as any)
      .insert({
        equipment_id: equipmentId,
        borrower_id: user.id,
        expected_return_date: new Date(expectedReturnDate).toISOString(),
        condition_at_checkout: eq.condition,
        notes: notes || null,
        status: "REQUESTED",
      })
      .select("id")
      .single();

    if (loanErr || !loan) {
      return { success: false, message: `Erreur: ${loanErr?.message}` };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "REQUEST_EQUIPMENT_LOAN",
      entity_type: "equipment_loans",
      entity_id: loan.id,
      details: { equipmentName: eq.name, expectedReturnDate },
    });

    revalidatePath("/dashboard/equipment");
    return {
      success: true,
      message: "Demande d'emprunt enregistrée avec succès",
    };
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: err.message || "Erreur interne" };
  }
}

export async function approveEquipmentLoanAction(loanId: string): Promise<ActionResponse> {
  try {
    const { user, profile } = await requireProfile();
    if (profile.role !== "SUPER_ADMIN") {
      return { success: false, message: "Seul un Super Admin peut valider la sortie de matériel" };
    }

    const supabase = await createClient();

    // Fetch loan
    const { data: loan, error: loanErr } = await (supabase.from("equipment_loans") as any)
      .select("id, equipment_id, status")
      .eq("id", loanId)
      .single();

    if (loanErr || !loan) {
      return { success: false, message: "Emprunt introuvable" };
    }

    // Update loan
    await (supabase.from("equipment_loans") as any)
      .update({
        status: "ACTIVE",
        approved_by: user.id,
        borrow_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", loanId);

    // Update equipment status
    await (supabase.from("equipment") as any)
      .update({
        status: "LOANED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", loan.equipment_id);

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "APPROVE_EQUIPMENT_LOAN",
      entity_type: "equipment_loans",
      entity_id: loanId,
      details: { equipmentId: loan.equipment_id },
    });

    revalidatePath("/dashboard/equipment");
    return {
      success: true,
      message: "Sortie de matériel autorisée",
    };
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: err.message || "Erreur interne" };
  }
}

export async function returnEquipmentAction(
  loanId: string,
  conditionAtReturn: EquipmentCondition,
  notes?: string
): Promise<ActionResponse> {
  try {
    const { user, profile } = await requireProfile();
    if (profile.role !== "SUPER_ADMIN") {
      return { success: false, message: "Seul un Super Admin peut réceptionner et clore un prêt de matériel" };
    }

    const supabase = await createClient();

    const { data: loan, error: loanErr } = await (supabase.from("equipment_loans") as any)
      .select("id, equipment_id")
      .eq("id", loanId)
      .single();

    if (loanErr || !loan) {
      return { success: false, message: "Emprunt introuvable" };
    }

    // Update loan
    await (supabase.from("equipment_loans") as any)
      .update({
        status: "RETURNED",
        actual_return_date: new Date().toISOString(),
        condition_at_return: conditionAtReturn,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", loanId);

    // Update equipment
    const newStatus: EquipmentStatus = conditionAtReturn === "DAMAGED" || conditionAtReturn === "MAINTENANCE"
      ? "MAINTENANCE"
      : "AVAILABLE";

    await (supabase.from("equipment") as any)
      .update({
        status: newStatus,
        condition: conditionAtReturn,
        updated_at: new Date().toISOString(),
      })
      .eq("id", loan.equipment_id);

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "RETURN_EQUIPMENT",
      entity_type: "equipment_loans",
      entity_id: loanId,
      details: { conditionAtReturn, equipmentId: loan.equipment_id },
    });

    revalidatePath("/dashboard/equipment");
    return {
      success: true,
      message: "Retour de matériel enregistré et stock actualisé",
    };
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: err.message || "Erreur interne" };
  }
}
