"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, AuthorizationError } from "@/lib/auth/rbac";
import {
  type EquipmentCategory,
  type EquipmentCondition,
  type EquipmentStatus,
  type LoanStatus,
  toDbEquipmentCategory,
  toDbEquipmentCondition,
  toDbEquipmentStatus,
} from "@/lib/data/equipment";

const UuidSchema = z.string().uuid("ID invalide");

const EquipmentCategoryEnum = z.enum([
  "PHOTO_VIDEO",
  "AUDIO",
  "INFORMATIQUE",
  "ACCESSOIRES",
  "SONO",
  "LOGISTIQUE",
  "AUTRE",
]);

const EquipmentConditionEnum = z.enum(["NEW", "EXCELLENT", "GOOD", "FAIR", "DAMAGED", "MAINTENANCE"]);

const EquipmentStatusEnum = z.enum(["AVAILABLE", "LOANED", "MAINTENANCE", "RETIRED"]);

const EquipmentCreateSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9_-]+$/, "Le code doit être en majuscules sans espaces (ex: MAT-CAM-01)"),
  name: z.string().min(3, "Le nom du matériel doit comporter au moins 3 caractères").max(150),
  category: EquipmentCategoryEnum,
  description: z.string().optional().nullable(),
  serial_number: z.string().optional().nullable(),
  condition: EquipmentConditionEnum.default("GOOD"),
  storage_location: z.string().optional().nullable(),
  purchase_date: z.string().optional().nullable(),
});

const EquipmentUpdateSchema = z.object({
  name: z.string().min(3).max(150).optional(),
  category: EquipmentCategoryEnum.optional(),
  description: z.string().optional().nullable(),
  serial_number: z.string().optional().nullable(),
  condition: EquipmentConditionEnum.optional(),
  status: EquipmentStatusEnum.optional(),
  storage_location: z.string().optional().nullable(),
  purchase_date: z.string().optional().nullable(),
});

const LoanRequestSchema = z.object({
  equipmentId: z.string().uuid("ID de matériel invalide"),
  expectedReturnDate: z.string().min(1, "La date de retour prévue est requise"),
  notes: z.string().optional().nullable(),
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

    // Check code uniqueness
    const { data: existing } = await (supabase.from("equipment") as any)
      .select("id")
      .eq("code", data.code.toUpperCase())
      .maybeSingle();

    if (existing) {
      return { success: false, message: `Un équipement avec le code "${data.code.toUpperCase()}" existe déjà.` };
    }

    const { data: inserted, error } = await (supabase.from("equipment") as any)
      .insert({
        code: data.code.toUpperCase(),
        name: data.name,
        category: toDbEquipmentCategory(data.category),
        description: data.description || null,
        serial_number: data.serial_number || null,
        condition: toDbEquipmentCondition(data.condition),
        status: "AVAILABLE",
        storage_location: data.storage_location || null,
        purchase_date: data.purchase_date || null,
      })
      .select("id, code, name")
      .single();

    if (error || !inserted) {
      console.error("Supabase insert equipment error:", error);
      return { success: false, message: `Erreur: ${error?.message}` };
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
    revalidatePath("/dashboard");

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

export async function updateEquipmentAction(equipmentId: string, rawInput: unknown): Promise<ActionResponse> {
  try {
    const validId = UuidSchema.safeParse(equipmentId);
    if (!validId.success) {
      return { success: false, message: "ID de matériel invalide" };
    }

    const { user, profile } = await requireProfile();
    if (profile.role !== "SUPER_ADMIN") {
      return { success: false, message: "Action réservée aux Super Administrateurs" };
    }

    const parseResult = EquipmentUpdateSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        message: "Données de modification invalides",
        errors: parseResult.error.flatten().fieldErrors,
      };
    }

    const data = parseResult.data;
    const supabase = await createClient();

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.category !== undefined) updatePayload.category = toDbEquipmentCategory(data.category);
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.serial_number !== undefined) updatePayload.serial_number = data.serial_number;
    if (data.condition !== undefined) updatePayload.condition = toDbEquipmentCondition(data.condition);
    if (data.status !== undefined) updatePayload.status = toDbEquipmentStatus(data.status);
    if (data.storage_location !== undefined) updatePayload.storage_location = data.storage_location;
    if (data.purchase_date !== undefined) updatePayload.purchase_date = data.purchase_date;

    const { data: updated, error } = await (supabase.from("equipment") as any)
      .update(updatePayload)
      .eq("id", validId.data)
      .select("id, code, name")
      .single();

    if (error || !updated) {
      return { success: false, message: `Erreur: ${error?.message}` };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "UPDATE_EQUIPMENT",
      entity_type: "equipment",
      entity_id: validId.data,
      details: { code: updated.code, name: updated.name, changes: updatePayload },
    });

    revalidatePath("/dashboard/equipment");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Équipement [${updated.code}] mis à jour avec succès`,
      data: updated,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Erreur interne" };
  }
}

export async function deleteEquipmentAction(equipmentId: string): Promise<ActionResponse> {
  try {
    const validId = UuidSchema.safeParse(equipmentId);
    if (!validId.success) {
      return { success: false, message: "ID de matériel invalide" };
    }

    const { user, profile } = await requireProfile();
    if (profile.role !== "SUPER_ADMIN") {
      return { success: false, message: "Action réservée aux Super Administrateurs" };
    }

    const supabase = await createClient();

    // Check if equipment has active loans
    const { data: activeLoans } = await (supabase.from("equipment_loans") as any)
      .select("id")
      .eq("equipment_id", validId.data)
      .in("status", ["ACTIVE", "REQUESTED"])
      .limit(1);

    if (activeLoans && activeLoans.length > 0) {
      return {
        success: false,
        message: "Impossible de supprimer un équipement ayant des prêts actifs ou en attente.",
      };
    }

    const { data: eq, error: fetchErr } = await (supabase.from("equipment") as any)
      .select("id, code, name")
      .eq("id", validId.data)
      .single();

    if (fetchErr || !eq) {
      return { success: false, message: "Matériel introuvable" };
    }

    const { error: delErr } = await (supabase.from("equipment") as any)
      .delete()
      .eq("id", validId.data);

    if (delErr) {
      return { success: false, message: `Erreur: ${delErr.message}` };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "DELETE_EQUIPMENT",
      entity_type: "equipment",
      entity_id: validId.data,
      details: { code: eq.code, name: eq.name },
    });

    revalidatePath("/dashboard/equipment");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Équipement [${eq.code}] retiré du catalogue.`,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Erreur interne" };
  }
}

export async function requestEquipmentLoanAction(
  equipmentId: string,
  expectedReturnDate: string,
  notes?: string
): Promise<ActionResponse> {
  try {
    const parseResult = LoanRequestSchema.safeParse({ equipmentId, expectedReturnDate, notes });
    if (!parseResult.success) {
      return {
        success: false,
        message: "Données de demande d'emprunt invalides",
        errors: parseResult.error.flatten().fieldErrors,
      };
    }

    const { user, profile } = await requireProfile();
    const supabase = await createClient();

    // Verify equipment is available
    const { data: eq, error: eqErr } = await (supabase.from("equipment") as any)
      .select("id, name, code, status, condition")
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
      details: { equipmentCode: eq.code, equipmentName: eq.name, expectedReturnDate },
    });

    revalidatePath("/dashboard/equipment");
    revalidatePath("/dashboard");

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
    const validId = UuidSchema.safeParse(loanId);
    if (!validId.success) {
      return { success: false, message: "ID d'emprunt invalide" };
    }

    const { user, profile } = await requireProfile();
    if (profile.role !== "SUPER_ADMIN") {
      return { success: false, message: "Seul un Super Admin peut valider la sortie de matériel" };
    }

    const supabase = await createClient();

    // Fetch loan
    const { data: loan, error: loanErr } = await (supabase.from("equipment_loans") as any)
      .select("id, equipment_id, borrower_id, status, equipment:equipment_id(name, code)")
      .eq("id", validId.data)
      .single();

    if (loanErr || !loan) {
      return { success: false, message: "Emprunt introuvable" };
    }

    if (loan.status !== "REQUESTED") {
      return {
        success: false,
        message: `Cette demande d'emprunt n'est plus en attente d'approbation (statut actuel: ${loan.status}).`,
      };
    }

    // Verify equipment is currently AVAILABLE before approving
    const { data: currentEq } = await (supabase.from("equipment") as any)
      .select("id, status")
      .eq("id", loan.equipment_id)
      .single();

    if (!currentEq || currentEq.status !== "AVAILABLE") {
      return {
        success: false,
        message: "Conflit d'emprunt: Ce matériel est actuellement déjà emprunté ou indisponible.",
      };
    }

    // Update loan atomically with optimistic concurrency lock on REQUESTED status
    const { data: updatedLoan, error: updateLoanErr } = await (supabase.from("equipment_loans") as any)
      .update({
        status: "ACTIVE",
        approved_by: user.id,
        borrow_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", validId.data)
      .eq("status", "REQUESTED")
      .select("id")
      .maybeSingle();

    if (updateLoanErr || !updatedLoan) {
      return {
        success: false,
        message: "Conflit de concurrence: Cette demande d'emprunt a déjà été traitée par un autre administrateur.",
      };
    }

    // Atomically transition equipment from AVAILABLE to BORROWED
    const { data: updatedEq, error: eqErr } = await (supabase.from("equipment") as any)
      .update({
        status: "BORROWED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", loan.equipment_id)
      .eq("status", "AVAILABLE")
      .select("id")
      .maybeSingle();

    if (eqErr || !updatedEq) {
      // Rollback loan status if equipment was simultaneously borrowed
      await (supabase.from("equipment_loans") as any)
        .update({ status: "REQUESTED", approved_by: null, borrow_date: null })
        .eq("id", validId.data);
      return {
        success: false,
        message: "Conflit d'allocation: Le matériel vient d'être attribué à un autre utilisateur.",
      };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "APPROVE_EQUIPMENT_LOAN",
      entity_type: "equipment_loans",
      entity_id: validId.data,
      details: { equipmentId: loan.equipment_id, borrowerId: loan.borrower_id },
    });

    // Notify borrower
    if (loan.borrower_id) {
      const eqName = loan.equipment?.name || "Matériel";
      await (supabase.from("notifications") as any).insert({
        user_id: loan.borrower_id,
        title: "Emprunt de matériel validé",
        message: `Votre demande d'emprunt pour "${eqName}" a été validée par la direction.`,
        type: "EQUIPMENT",
        link: `/dashboard/equipment`,
      });
    }

    revalidatePath("/dashboard/equipment");
    revalidatePath("/dashboard");

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

export async function rejectEquipmentLoanAction(loanId: string, reason?: string): Promise<ActionResponse> {
  try {
    const validId = UuidSchema.safeParse(loanId);
    if (!validId.success) {
      return { success: false, message: "ID d'emprunt invalide" };
    }

    const { user, profile } = await requireProfile();
    if (profile.role !== "SUPER_ADMIN") {
      return { success: false, message: "Seul un Super Admin peut refuser une demande d'emprunt" };
    }

    const supabase = await createClient();

    const { data: loan, error: loanErr } = await (supabase.from("equipment_loans") as any)
      .select("id, equipment_id, borrower_id, status, equipment:equipment_id(name, code)")
      .eq("id", validId.data)
      .single();

    if (loanErr || !loan) {
      return { success: false, message: "Emprunt introuvable" };
    }

    if (loan.status !== "REQUESTED") {
      return {
        success: false,
        message: `Cette demande d'emprunt n'est plus en attente d'approbation (statut actuel: ${loan.status}).`,
      };
    }

    const { data: updatedLoan, error: rejErr } = await (supabase.from("equipment_loans") as any)
      .update({
        status: "REJECTED",
        notes: reason ? `Refusé : ${reason}` : "Demande refusée par la direction",
        updated_at: new Date().toISOString(),
      })
      .eq("id", validId.data)
      .eq("status", "REQUESTED")
      .select("id")
      .maybeSingle();

    if (rejErr || !updatedLoan) {
      return {
        success: false,
        message: "Conflit de concurrence: Cette demande a déjà été traitée par un autre administrateur.",
      };
    }

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "REJECT_EQUIPMENT_LOAN",
      entity_type: "equipment_loans",
      entity_id: validId.data,
      details: { equipmentId: loan.equipment_id, reason: reason || null },
    });

    // Notify borrower
    if (loan.borrower_id) {
      const eqName = loan.equipment?.name || "Matériel";
      await (supabase.from("notifications") as any).insert({
        user_id: loan.borrower_id,
        title: "Demande d'emprunt non accordée",
        message: `Votre demande pour "${eqName}" a été refusée${reason ? ` : ${reason}` : ""}.`,
        type: "EQUIPMENT",
        link: `/dashboard/equipment`,
      });
    }

    revalidatePath("/dashboard/equipment");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: "Demande d'emprunt refusée.",
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Erreur interne" };
  }
}

export async function returnEquipmentAction(
  loanId: string,
  conditionAtReturn: EquipmentCondition,
  notes?: string
): Promise<ActionResponse> {
  try {
    const validId = UuidSchema.safeParse(loanId);
    if (!validId.success) {
      return { success: false, message: "ID d'emprunt invalide" };
    }

    const validCondition = EquipmentConditionEnum.safeParse(conditionAtReturn);
    if (!validCondition.success) {
      return { success: false, message: "État de retour invalide" };
    }

    const { user, profile } = await requireProfile();
    if (profile.role !== "SUPER_ADMIN") {
      return { success: false, message: "Seul un Super Admin peut réceptionner et clore un prêt de matériel" };
    }

    const supabase = await createClient();

    const { data: loan, error: loanErr } = await (supabase.from("equipment_loans") as any)
      .select("id, equipment_id, borrower_id, status")
      .eq("id", validId.data)
      .single();

    if (loanErr || !loan) {
      return { success: false, message: "Emprunt introuvable" };
    }

    if (loan.status !== "ACTIVE") {
      return {
        success: false,
        message: `Cet emprunt n'est pas actif (statut actuel: ${loan.status}).`,
      };
    }

    // Update loan with optimistic lock on ACTIVE status
    const { data: updatedLoan, error: returnErr } = await (supabase.from("equipment_loans") as any)
      .update({
        status: "RETURNED",
        actual_return_date: new Date().toISOString(),
        condition_at_return: validCondition.data,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", validId.data)
      .eq("status", "ACTIVE")
      .select("id")
      .maybeSingle();

    if (returnErr || !updatedLoan) {
      return {
        success: false,
        message: "Conflit de concurrence: Ce prêt a déjà été retourné ou clôturé.",
      };
    }

    // Update equipment
    const newStatus: EquipmentStatus = validCondition.data === "DAMAGED" || validCondition.data === "MAINTENANCE"
      ? "MAINTENANCE"
      : "AVAILABLE";

    await (supabase.from("equipment") as any)
      .update({
        status: newStatus,
        condition: toDbEquipmentCondition(validCondition.data),
        updated_at: new Date().toISOString(),
      })
      .eq("id", loan.equipment_id);

    // Audit log
    await (supabase.from("activity_logs") as any).insert({
      actor_id: user.id,
      action: "RETURN_EQUIPMENT",
      entity_type: "equipment_loans",
      entity_id: validId.data,
      details: { conditionAtReturn: validCondition.data, equipmentId: loan.equipment_id },
    });

    revalidatePath("/dashboard/equipment");
    revalidatePath("/dashboard");

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
