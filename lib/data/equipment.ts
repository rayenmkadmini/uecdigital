import { createClient } from "@/lib/supabase/server";

export type EquipmentCategory =
  | "PHOTO_VIDEO"
  | "AUDIO"
  | "INFORMATIQUE"
  | "ACCESSOIRES"
  | "SONO"
  | "LOGISTIQUE"
  | "AUTRE";

export type EquipmentCondition =
  | "NEW"
  | "EXCELLENT"
  | "GOOD"
  | "FAIR"
  | "DAMAGED"
  | "MAINTENANCE";

export type EquipmentStatus = "AVAILABLE" | "LOANED" | "MAINTENANCE" | "RETIRED";

export type LoanStatus = "REQUESTED" | "ACTIVE" | "RETURNED" | "OVERDUE" | "REJECTED";

export function toDbEquipmentCategory(cat: string): string {
  switch (cat) {
    case "PHOTO_VIDEO":
      return "CAMERAS";
    case "AUDIO":
      return "MICROPHONES";
    case "INFORMATIQUE":
      return "COMPUTERS";
    case "ACCESSOIRES":
      return "STABILIZERS";
    case "SONO":
      return "LIGHTING";
    case "LOGISTIQUE":
      return "STORAGE_DEVICES";
    case "AUTRE":
      return "OTHER";
    default:
      return cat;
  }
}

export function fromDbEquipmentCategory(cat: string): EquipmentCategory {
  switch (cat) {
    case "CAMERAS":
    case "LENSES":
      return "PHOTO_VIDEO";
    case "MICROPHONES":
      return "AUDIO";
    case "COMPUTERS":
      return "INFORMATIQUE";
    case "STABILIZERS":
      return "ACCESSOIRES";
    case "LIGHTING":
      return "SONO";
    case "STORAGE_DEVICES":
      return "LOGISTIQUE";
    case "OTHER":
      return "AUTRE";
    default:
      return (cat as EquipmentCategory) || "AUTRE";
  }
}

export function toDbEquipmentCondition(cond: string): string {
  switch (cond) {
    case "DAMAGED":
    case "MAINTENANCE":
      return "POOR";
    default:
      return cond;
  }
}

export function fromDbEquipmentCondition(cond: string): EquipmentCondition {
  switch (cond) {
    case "POOR":
      return "DAMAGED";
    default:
      return (cond as EquipmentCondition) || "GOOD";
  }
}

export function toDbEquipmentStatus(st: string): string {
  switch (st) {
    case "LOANED":
      return "BORROWED";
    default:
      return st;
  }
}

export function fromDbEquipmentStatus(st: string): EquipmentStatus {
  switch (st) {
    case "BORROWED":
      return "LOANED";
    default:
      return (st as EquipmentStatus) || "AVAILABLE";
  }
}

export interface EquipmentLoanItem {
  id: string;
  equipment_id: string;
  equipment_name?: string;
  equipment_code?: string;
  borrower_id: string;
  borrower_name: string;
  approved_by: string | null;
  approver_name: string | null;
  borrow_date: string;
  expected_return_date: string;
  actual_return_date: string | null;
  condition_at_checkout: string;
  condition_at_return: string | null;
  notes: string | null;
  status: LoanStatus;
  created_at: string;
  updated_at: string;
}

export interface EquipmentListItem {
  id: string;
  code: string;
  name: string;
  category: EquipmentCategory;
  description: string | null;
  serial_number: string | null;
  condition: EquipmentCondition;
  status: EquipmentStatus;
  storage_location: string | null;
  purchase_date: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
  current_loan: EquipmentLoanItem | null;
}

export interface EquipmentFilter {
  category?: string;
  status?: string;
  condition?: string;
  search?: string;
}

export async function getEquipmentList(filter?: EquipmentFilter): Promise<EquipmentListItem[]> {
  const supabase = await createClient();

  let query = (supabase.from("equipment") as any)
    .select(`
      id,
      code,
      name,
      category,
      description,
      serial_number,
      condition,
      status,
      storage_location,
      purchase_date,
      photo_url,
      created_at,
      updated_at
    `)
    .order("code", { ascending: true });

  if (filter?.category && filter.category !== "ALL") {
    query = query.eq("category", toDbEquipmentCategory(filter.category));
  }

  if (filter?.status && filter.status !== "ALL") {
    query = query.eq("status", toDbEquipmentStatus(filter.status));
  }

  if (filter?.search?.trim()) {
    query = query.or(
      `name.ilike.%${filter.search.trim()}%,code.ilike.%${filter.search.trim()}%,serial_number.ilike.%${filter.search.trim()}%`
    );
  }

  const { data: rawEquipment, error } = await query;
  if (error || !rawEquipment) {
    console.error("Error fetching equipment:", error);
    return [];
  }

  // Fetch active or requested loans
  const eqIds = rawEquipment.map((e: any) => e.id);
  let activeLoans: any[] = [];

  if (eqIds.length > 0) {
    const { data: loansData } = await (supabase.from("equipment_loans") as any)
      .select(`
        id,
        equipment_id,
        borrower_id,
        approved_by,
        borrow_date,
        expected_return_date,
        actual_return_date,
        condition_at_checkout,
        condition_at_return,
        notes,
        status,
        created_at,
        updated_at
      `)
      .in("equipment_id", eqIds)
      .in("status", ["ACTIVE", "REQUESTED", "OVERDUE"]);

    if (loansData) {
      activeLoans = loansData;
    }
  }

  // Fetch borrower names
  const borrowerIds = Array.from(new Set(activeLoans.map((l) => l.borrower_id).filter(Boolean)));
  const profileMap = new Map<string, string>();
  if (borrowerIds.length > 0) {
    const { data: profiles } = await (supabase.from("profiles") as any)
      .select("id, full_name")
      .in("id", borrowerIds);
    for (const p of profiles || []) {
      profileMap.set(p.id, p.full_name);
    }
  }

  return rawEquipment.map((eq: any) => {
    const loan = activeLoans.find((l) => l.equipment_id === eq.id);
    let currentLoan: EquipmentLoanItem | null = null;
    if (loan) {
      currentLoan = {
        id: loan.id,
        equipment_id: loan.equipment_id,
        borrower_id: loan.borrower_id,
        borrower_name: profileMap.get(loan.borrower_id) || "Emprunteur",
        approved_by: loan.approved_by,
        approver_name: null,
        borrow_date: loan.borrow_date,
        expected_return_date: loan.expected_return_date,
        actual_return_date: loan.actual_return_date,
        condition_at_checkout: loan.condition_at_checkout,
        condition_at_return: loan.condition_at_return,
        notes: loan.notes,
        status: loan.status as LoanStatus,
        created_at: loan.created_at,
        updated_at: loan.updated_at,
      };
    }

    return {
      id: eq.id,
      code: eq.code,
      name: eq.name,
      category: fromDbEquipmentCategory(eq.category),
      description: eq.description,
      serial_number: eq.serial_number,
      condition: fromDbEquipmentCondition(eq.condition),
      status: fromDbEquipmentStatus(eq.status),
      storage_location: eq.storage_location,
      purchase_date: eq.purchase_date,
      photo_url: eq.photo_url,
      created_at: eq.created_at,
      updated_at: eq.updated_at,
      current_loan: currentLoan,
    };
  });
}
