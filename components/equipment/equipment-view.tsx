"use client";

import React, { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Package,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Filter,
  Camera,
  Mic,
  Laptop,
  Layers,
  Sparkles,
  X,
  ArrowRight,
  ShieldAlert,
  Edit2,
  Trash2,
  XCircle,
} from "lucide-react";
import type {
  EquipmentListItem,
  EquipmentLoanItem,
  EquipmentCategory,
  EquipmentCondition,
  EquipmentStatus,
} from "@/lib/data/equipment";
import {
  createEquipmentAction,
  deleteEquipmentAction,
  requestEquipmentLoanAction,
  approveEquipmentLoanAction,
  rejectEquipmentLoanAction,
  returnEquipmentAction,
} from "@/app/actions/equipment";
import { EquipmentEditModal } from "./equipment-edit-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

interface EquipmentViewProps {
  initialEquipment: EquipmentListItem[];
  userRole: string;
}

const CATEGORY_ICONS: Record<EquipmentCategory, any> = {
  PHOTO_VIDEO: Camera,
  AUDIO: Mic,
  INFORMATIQUE: Laptop,
  ACCESSOIRES: Package,
  SONO: Mic,
  LOGISTIQUE: Layers,
  AUTRE: Package,
};

const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  PHOTO_VIDEO: "Photo & Vidéo",
  AUDIO: "Prise de Son & Micros",
  INFORMATIQUE: "Informatique & Régie",
  ACCESSOIRES: "Accessoires & Trépieds",
  SONO: "Sonorisation",
  LOGISTIQUE: "Logistique Événementielle",
  AUTRE: "Autre",
};

const STATUS_CONFIG: Record<
  EquipmentStatus,
  {
    label: string;
    variant:
      | "default"
      | "approved"
      | "pending"
      | "review"
      | "rejected"
      | "planning"
      | "cyan"
      | "red";
  }
> = {
  AVAILABLE: { label: "Disponible", variant: "approved" },
  LOANED: { label: "En Prêt", variant: "review" },
  MAINTENANCE: { label: "En Maintenance / SAV", variant: "rejected" },
  RETIRED: { label: "Réformé", variant: "default" },
};

const CONDITION_CONFIG: Record<EquipmentCondition, { label: string; color: string }> = {
  NEW: { label: "Neuf", color: "text-emerald-400" },
  EXCELLENT: { label: "Excellent", color: "text-emerald-400" },
  GOOD: { label: "Bon état", color: "text-blue-400" },
  FAIR: { label: "État d'usage", color: "text-amber-400" },
  DAMAGED: { label: "Endommagé", color: "text-rose-400" },
  MAINTENANCE: { label: "En révision", color: "text-red-500 font-bold" },
};

export function EquipmentView({ initialEquipment, userRole }: EquipmentViewProps) {
  const [equipment, setEquipment] = useState<EquipmentListItem[]>(initialEquipment);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<EquipmentListItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [loanTarget, setLoanTarget] = useState<EquipmentListItem | null>(null);
  const [returnTarget, setReturnTarget] = useState<EquipmentListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EquipmentListItem | null>(null);

  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // New Equipment Form State
  const [newEquip, setNewEquip] = useState({
    code: "",
    name: "",
    category: "PHOTO_VIDEO" as EquipmentCategory,
    condition: "EXCELLENT" as EquipmentCondition,
    serial_number: "",
    storage_location: "",
    description: "",
  });

  // Loan Request Form State
  const [loanForm, setLoanForm] = useState({
    expected_return_date: "",
    notes: "",
  });

  // Return Form State
  const [returnForm, setReturnForm] = useState({
    condition_at_return: "GOOD" as EquipmentCondition,
    notes: "",
  });

  // Loan Rejection State
  const [rejectTarget, setRejectTarget] = useState<{
    loanId: string;
    equipId: string;
    name: string;
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const isSuperAdmin = userRole === "SUPER_ADMIN";
  const canManage = userRole === "SUPER_ADMIN" || userRole === "COORDINATOR";

  const filteredEquipment = equipment.filter((eq) => {
    if (categoryFilter !== "ALL" && eq.category !== categoryFilter) return false;
    if (statusFilter !== "ALL" && eq.status !== statusFilter) return false;
    if (
      search.trim() &&
      !eq.name.toLowerCase().includes(search.toLowerCase()) &&
      !eq.code.toLowerCase().includes(search.toLowerCase()) &&
      !(eq.serial_number && eq.serial_number.toLowerCase().includes(search.toLowerCase()))
    ) {
      return false;
    }
    return true;
  });

  const stats = {
    total: equipment.length,
    available: equipment.filter((e) => e.status === "AVAILABLE").length,
    loaned: equipment.filter((e) => e.status === "LOANED").length,
    maintenance: equipment.filter((e) => e.status === "MAINTENANCE").length,
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createEquipmentAction(newEquip);
      if (res.success) {
        setActionMessage({ text: res.message });
        setIsAddOpen(false);
        const newItem: EquipmentListItem = {
          id: res.data.id,
          code: newEquip.code.toUpperCase(),
          name: newEquip.name,
          category: newEquip.category,
          condition: newEquip.condition,
          status: "AVAILABLE",
          serial_number: newEquip.serial_number || null,
          storage_location: newEquip.storage_location || null,
          description: newEquip.description || null,
          purchase_date: null,
          photo_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          current_loan: null,
        };
        setEquipment([newItem, ...equipment]);
        setNewEquip({
          code: "",
          name: "",
          category: "PHOTO_VIDEO",
          condition: "EXCELLENT",
          serial_number: "",
          storage_location: "",
          description: "",
        });
      } else {
        setActionMessage({ text: res.message, error: true });
      }
      setTimeout(() => setActionMessage(null), 4000);
    });
  };

  const handleConfirmDeleteEquipment = () => {
    if (!deleteTarget) return;

    startTransition(async () => {
      const res = await deleteEquipmentAction(deleteTarget.id);
      if (res.success) {
        setEquipment((prev) => prev.filter((e) => e.id !== deleteTarget.id));
        showToast("Matériel supprimé de l'inventaire avec succès.", "success");
        setDeleteTarget(null);
      } else {
        showToast(res.message, "error");
      }
    });
  };

  const handleLoanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanTarget) return;

    startTransition(async () => {
      const res = await requestEquipmentLoanAction(
        loanTarget.id,
        loanForm.expected_return_date,
        loanForm.notes || undefined
      );

      if (res.success) {
        setActionMessage({ text: res.message });
        const newLoan: EquipmentLoanItem = {
          id: res.data.id,
          equipment_id: loanTarget.id,
          equipment_name: loanTarget.name,
          equipment_code: loanTarget.code,
          borrower_id: "",
          borrower_name: "Moi",
          approved_by: null,
          approver_name: null,
          borrow_date: new Date().toISOString(),
          expected_return_date: loanForm.expected_return_date,
          actual_return_date: null,
          condition_at_checkout: loanTarget.condition,
          condition_at_return: null,
          notes: loanForm.notes || null,
          status: "REQUESTED",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setEquipment((prev) =>
          prev.map((e) =>
            e.id === loanTarget.id
              ? {
                  ...e,
                  current_loan: newLoan,
                }
              : e
          )
        );
        setLoanTarget(null);
      } else {
        setActionMessage({ text: res.message, error: true });
      }
      setTimeout(() => setActionMessage(null), 4000);
    });
  };

  const handleApproveLoan = (loanId: string, equipId: string) => {
    startTransition(async () => {
      const res = await approveEquipmentLoanAction(loanId);
      if (res.success) {
        setActionMessage({ text: res.message });
        setEquipment((prev) =>
          prev.map((e) =>
            e.id === equipId
              ? {
                  ...e,
                  status: "LOANED",
                  current_loan: e.current_loan ? { ...e.current_loan, status: "ACTIVE" } : null,
                }
              : e
          )
        );
      } else {
        setActionMessage({ text: res.message, error: true });
      }
      setTimeout(() => setActionMessage(null), 4000);
    });
  };

  const handleConfirmRejectLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;

    startTransition(async () => {
      const res = await rejectEquipmentLoanAction(
        rejectTarget.loanId,
        rejectionReason.trim() || undefined
      );
      if (res.success) {
        setActionMessage({ text: "Demande d'emprunt refusée." });
        setEquipment((prev) =>
          prev.map((e) => (e.id === rejectTarget.equipId ? { ...e, current_loan: null } : e))
        );
        setRejectTarget(null);
        setRejectionReason("");
      } else {
        setActionMessage({ text: res.message, error: true });
      }
      setTimeout(() => setActionMessage(null), 4000);
    });
  };

  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnTarget || !returnTarget.current_loan) return;

    startTransition(async () => {
      const res = await returnEquipmentAction(
        returnTarget.current_loan!.id,
        returnForm.condition_at_return,
        returnForm.notes || undefined
      );

      if (res.success) {
        setActionMessage({ text: res.message });
        setEquipment((prev) =>
          prev.map((e) =>
            e.id === returnTarget.id
              ? {
                  ...e,
                  status: returnForm.condition_at_return === "DAMAGED" ? "MAINTENANCE" : "AVAILABLE",
                  condition: returnForm.condition_at_return,
                  current_loan: null,
                }
              : e
          )
        );
        setReturnTarget(null);
      } else {
        setActionMessage({ text: res.message, error: true });
      }
      setTimeout(() => setActionMessage(null), 4000);
    });
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Package size={24} className="text-uec-red" />
            <span>Gestion du Parc Matériel & Logistique</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Inventaire technique, fiches matériel, demandes de sortie et suivi des retours ({equipment.length} équipements répertoriés).
          </p>
        </div>

        {canManage && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="bg-uec-red hover:bg-uec-red/90 text-white"
          >
            <Plus size={16} className="mr-1.5" />
            Ajouter un Équipement
          </Button>
        )}
      </div>

      {actionMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 shadow-lg transition-all ${
            actionMessage.error
              ? "bg-rose-950/70 border-rose-700 text-rose-200"
              : "bg-emerald-950/70 border-emerald-700 text-emerald-200"
          }`}
        >
          {actionMessage.error ? (
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Total Équipements"
          value={stats.total.toString()}
          description="Inventaire global UEC"
          icon={<Package size={18} />}
          accentColor="blue"
        />
        <StatCard
          title="Disponibles"
          value={stats.available.toString()}
          description="Prêts à l'emploi"
          icon={<CheckCircle2 size={18} />}
          accentColor="green"
        />
        <StatCard
          title="En Prêt Actif"
          value={stats.loaned.toString()}
          description="En possession de membres"
          icon={<Clock size={18} />}
          accentColor="cyan"
        />
        <StatCard
          title="En Révision / SAV"
          value={stats.maintenance.toString()}
          description="Indisponibles temporairement"
          icon={<AlertCircle size={18} />}
          accentColor="red"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 rtl:left-auto rtl:right-3" />
              <input
                type="text"
                placeholder="Rechercher par nom, code ou numéro de série..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#111827] text-xs text-white placeholder-slate-500 rounded-lg pl-9 pr-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none rtl:pl-3 rtl:pr-9"
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-[#111827] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
            >
              <option value="ALL">Toutes catégories</option>
              <option value="PHOTO_VIDEO">Photo & Vidéo</option>
              <option value="AUDIO">Prise de Son & Micros</option>
              <option value="INFORMATIQUE">Informatique & Régie</option>
              <option value="ACCESSOIRES">Accessoires & Trépieds</option>
              <option value="SONO">Sonorisation</option>
              <option value="LOGISTIQUE">Logistique</option>
              <option value="AUTRE">Autre</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#111827] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
            >
              <option value="ALL">Tous les statuts</option>
              <option value="AVAILABLE">Disponible</option>
              <option value="LOANED">En prêt</option>
              <option value="MAINTENANCE">En révision</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Equipment List */}
      {filteredEquipment.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Aucun matériel trouvé"
          description="Aucun équipement ne correspond à vos critères de recherche dans l'inventaire UEC."
          action={
            canManage
              ? {
                  label: "Ajouter un Équipement",
                  onClick: () => setIsAddOpen(true),
                  icon: Plus,
                  variant: "outline",
                }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEquipment.map((eq) => {
            const statusCfg = STATUS_CONFIG[eq.status] || STATUS_CONFIG.AVAILABLE;
            const condCfg = CONDITION_CONFIG[eq.condition] || CONDITION_CONFIG.GOOD;
            const CategoryIcon = CATEGORY_ICONS[eq.category] || Package;

            return (
              <Card key={eq.id} className="flex flex-col justify-between hover:border-slate-700 transition-all">
                <CardHeader className="pb-3 border-b border-[#1F2937]">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] font-bold text-uec-cyan bg-slate-900 border border-slate-700 px-2 py-0.5 rounded">
                        {eq.code}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <CategoryIcon size={12} />
                        {CATEGORY_LABELS[eq.category]}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Badge variant={statusCfg.variant} size="sm">
                        {statusCfg.label}
                      </Badge>
                      {canManage && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingEquipment(eq);
                              setIsEditOpen(true);
                            }}
                            className="p-1 text-slate-400 hover:text-white rounded transition-colors"
                            title="Modifier l'équipement"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(eq)}
                            disabled={isPending}
                            className="p-1 text-slate-400 hover:text-rose-400 rounded transition-colors"
                            title="Supprimer l'équipement"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <CardTitle className="text-sm font-bold text-white line-clamp-1">
                    {eq.name}
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2 text-xs">
                    {eq.description && (
                      <p className="text-slate-400 text-[11px] line-clamp-2">{eq.description}</p>
                    )}

                    <div className="space-y-1 text-[11px] text-slate-400 bg-[#0B1020]/60 p-2.5 rounded-lg border border-[#1F2937]">
                      <div className="flex items-center justify-between">
                        <span>État :</span>
                        <span className={`font-semibold ${condCfg.color}`}>{condCfg.label}</span>
                      </div>
                      {eq.serial_number && (
                        <div className="flex items-center justify-between">
                          <span>N° Série :</span>
                          <span className="font-mono text-slate-300">{eq.serial_number}</span>
                        </div>
                      )}
                      {eq.storage_location && (
                        <div className="flex items-center justify-between">
                          <span>Emplacement :</span>
                          <span className="text-slate-300">{eq.storage_location}</span>
                        </div>
                      )}
                    </div>

                    {/* Current Loan Info if any */}
                    {eq.current_loan && (
                      <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-800/40 text-[11px] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-blue-300 font-semibold">
                            {eq.current_loan.status === "REQUESTED"
                              ? "Demande en attente"
                              : "Emprunté par"}
                            :
                          </span>
                          <span className="text-white font-medium">
                            {eq.current_loan.borrower_name}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Retour prévu :</span>
                          <span className="text-amber-400">
                            {new Date(eq.current_loan.expected_return_date).toLocaleDateString(
                              "fr-FR"
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-[#1F2937] flex flex-col gap-2">
                    {eq.status === "AVAILABLE" && !eq.current_loan && (
                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full bg-uec-red hover:bg-uec-red/90 text-white"
                        onClick={() => setLoanTarget(eq)}
                      >
                        <Clock size={13} className="mr-1.5" />
                        Demander le Prêt
                      </Button>
                    )}

                    {isSuperAdmin && eq.current_loan?.status === "REQUESTED" && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={isPending}
                          onClick={() => handleApproveLoan(eq.current_loan!.id, eq.id)}
                        >
                          <CheckCircle2 size={13} className="mr-1.5" />
                          Autoriser
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          className="flex-1 bg-rose-600 hover:bg-rose-700 text-white"
                          disabled={isPending}
                          onClick={() =>
                            setRejectTarget({
                              loanId: eq.current_loan!.id,
                              equipId: eq.id,
                              name: eq.name,
                            })
                          }
                        >
                          <XCircle size={13} className="mr-1.5" />
                          Refuser
                        </Button>
                      </div>
                    )}

                    {isSuperAdmin && eq.status === "LOANED" && eq.current_loan && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-emerald-400 border-emerald-800/60 hover:bg-emerald-950/40"
                        onClick={() => setReturnTarget(eq)}
                      >
                        <CheckCircle2 size={13} className="mr-1.5" />
                        Enregistrer le Retour
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Equipment Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#0e0e12] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl shadow-black/90 p-6 relative">
            <button
              onClick={() => setIsAddOpen(false)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-uec-blue"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>

            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Sparkles size={18} className="text-uec-red" />
              <span>Ajouter un Équipement à l'Inventaire</span>
            </h2>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Code Matériel *
                  </label>
                  <Input
                    required
                    value={newEquip.code}
                    onChange={(e) =>
                      setNewEquip({ ...newEquip, code: e.target.value.toUpperCase() })
                    }
                    placeholder="Ex: MAT-CAM-01"
                    className="font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Catégorie *
                  </label>
                  <select
                    value={newEquip.category}
                    onChange={(e) =>
                      setNewEquip({ ...newEquip, category: e.target.value as EquipmentCategory })
                    }
                    className="w-full bg-[#0B1020] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
                  >
                    <option value="PHOTO_VIDEO">Photo & Vidéo</option>
                    <option value="AUDIO">Prise de Son & Micros</option>
                    <option value="INFORMATIQUE">Informatique & Régie</option>
                    <option value="ACCESSOIRES">Accessoires & Trépieds</option>
                    <option value="SONO">Sonorisation</option>
                    <option value="LOGISTIQUE">Logistique</option>
                    <option value="AUTRE">Autre</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nom du matériel *
                </label>
                <Input
                  required
                  value={newEquip.name}
                  onChange={(e) => setNewEquip({ ...newEquip, name: e.target.value })}
                  placeholder="Ex: Sony Alpha 7 IV (Boîtier nu)"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Numéro de Série (S/N)
                  </label>
                  <Input
                    value={newEquip.serial_number}
                    onChange={(e) => setNewEquip({ ...newEquip, serial_number: e.target.value })}
                    placeholder="Ex: SN-849129"
                    className="font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    État initial
                  </label>
                  <select
                    value={newEquip.condition}
                    onChange={(e) =>
                      setNewEquip({ ...newEquip, condition: e.target.value as EquipmentCondition })
                    }
                    className="w-full bg-[#0B1020] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
                  >
                    <option value="EXCELLENT">Excellent (comme neuf)</option>
                    <option value="GOOD">Bon état</option>
                    <option value="FAIR">État d'usage</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Lieu de stockage
                </label>
                <Input
                  value={newEquip.storage_location}
                  onChange={(e) => setNewEquip({ ...newEquip, storage_location: e.target.value })}
                  placeholder="Ex: Armoire Matériel Siège UEC"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description / Accessoires inclus
                </label>
                <textarea
                  rows={3}
                  value={newEquip.description}
                  onChange={(e) => setNewEquip({ ...newEquip, description: e.target.value })}
                  placeholder="Fourni avec sacoche, 2 batteries, chargeur..."
                  className="w-full bg-[#0B1020] text-xs text-white placeholder-slate-500 rounded-lg p-3 border border-[#1F2937] focus:border-uec-blue focus:outline-none resize-none leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#1F2937]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddOpen(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isPending} className="bg-uec-red hover:bg-uec-red/90 text-white">
                  {isPending ? "Enregistrement..." : "Ajouter au Stock"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loan Request Modal */}
      {loanTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#0e0e12] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl shadow-black/90 p-6 relative">
            <button
              onClick={() => setLoanTarget(null)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-uec-blue"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>

            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Clock size={18} className="text-uec-red" />
              <span>Demande de Sortie Matériel</span>
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Réservation de :{" "}
              <strong className="text-white">
                [{loanTarget.code}] {loanTarget.name}
              </strong>
            </p>

            <form onSubmit={handleLoanSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Date et heure de retour prévue *
                </label>
                <Input
                  type="datetime-local"
                  required
                  value={loanForm.expected_return_date}
                  onChange={(e) =>
                    setLoanForm({ ...loanForm, expected_return_date: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Motif de l'emprunt / Projet concerné
                </label>
                <textarea
                  rows={3}
                  value={loanForm.notes}
                  onChange={(e) => setLoanForm({ ...loanForm, notes: e.target.value })}
                  placeholder="Ex: Couverture match derby & interview des supporters..."
                  className="w-full bg-[#0B1020] text-xs text-white placeholder-slate-500 rounded-lg p-3 border border-[#1F2937] focus:border-uec-blue focus:outline-none resize-none leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#1F2937]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLoanTarget(null)}
                >
                  Annuler
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isPending} className="bg-uec-red hover:bg-uec-red/90 text-white">
                  {isPending ? "Transmission..." : "Envoyer la Demande"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Equipment Modal */}
      {returnTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#0e0e12] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl shadow-black/90 p-6 relative">
            <button
              onClick={() => setReturnTarget(null)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-uec-blue"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>

            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-400" />
              <span>Clôture & Réception du Matériel</span>
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Restitution de :{" "}
              <strong className="text-white">
                [{returnTarget.code}] {returnTarget.name}
              </strong>
            </p>

            <form onSubmit={handleReturnSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  État constaté au retour *
                </label>
                <select
                  value={returnForm.condition_at_return}
                  onChange={(e) =>
                    setReturnForm({
                      ...returnForm,
                      condition_at_return: e.target.value as EquipmentCondition,
                    })
                  }
                  className="w-full bg-[#0B1020] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
                >
                  <option value="EXCELLENT">Excellent (comme neuf)</option>
                  <option value="GOOD">Bon état</option>
                  <option value="FAIR">État d'usage (micro-rayures)</option>
                  <option value="DAMAGED">Endommagé / Nécessite réparation</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Remarques / Éléments manquants
                </label>
                <textarea
                  rows={3}
                  value={returnForm.notes}
                  onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                  placeholder="Vérification optique effectuée, batterie rechargée..."
                  className="w-full bg-[#0B1020] text-xs text-white placeholder-slate-500 rounded-lg p-3 border border-[#1F2937] focus:border-uec-blue focus:outline-none resize-none leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#1F2937]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReturnTarget(null)}
                >
                  Annuler
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {isPending ? "Validation..." : "Valider le Retour au Stock"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Loan Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#0e0e12] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl shadow-black/90 p-6 relative">
            <button
              onClick={() => {
                setRejectTarget(null);
                setRejectionReason("");
              }}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-uec-blue"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>

            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <XCircle size={18} className="text-rose-500" />
              <span>Refus de Demande d'Emprunt</span>
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Pour le matériel : <strong className="text-white">{rejectTarget.name}</strong>
            </p>

            <form onSubmit={handleConfirmRejectLoan} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Motif du refus (optionnel)
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Ex: Matériel réservé pour la couverture d'un événement officiel du Club..."
                  className="w-full bg-[#0B1020] text-xs text-white placeholder-slate-500 rounded-lg p-3 border border-[#1F2937] focus:border-rose-500 focus:outline-none resize-none leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#1F2937]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRejectTarget(null);
                    setRejectionReason("");
                  }}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  disabled={isPending}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {isPending ? "Refus en cours..." : "Confirmer le Refus"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Equipment Modal */}
      <EquipmentEditModal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditingEquipment(null);
        }}
        equipment={editingEquipment}
        onSuccess={(updated) => {
          setEquipment((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
          setActionMessage({ text: "Fiche matériel mise à jour avec succès." });
          setTimeout(() => setActionMessage(null), 3000);
        }}
      />
      {/* Confirm Delete Equipment Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDeleteEquipment}
        title="Supprimer définitivement l'équipement ?"
        description={`Êtes-vous certain de vouloir supprimer "${deleteTarget?.name}" (${deleteTarget?.code}) du parc logistique ? Cette action est irréversible.`}
        confirmLabel="Supprimer définitivement"
        cancelLabel="Conserver"
        variant="danger"
        isLoading={isPending}
      />
    </div>
  );
}
