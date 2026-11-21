"use client";

import React, { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Inbox,
  Plus,
  Clock,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
  ArrowRight,
  Layers,
  Sparkles,
  Check,
  XCircle,
  Eye,
} from "lucide-react";
import type { ServiceRequestListItem, RequestCategory, RequestPriority, RequestStatus } from "@/lib/data/requests";
import type { DepartmentWithStats } from "@/lib/data/departments";
import {
  createServiceRequestAction,
  updateRequestStatusAction,
  convertRequestToTaskAction,
  deleteServiceRequestAction,
} from "@/app/actions/requests";
import { RequestRejectionModal } from "./request-rejection-modal";
import { RequestDetailModal } from "./request-detail-modal";

interface RequestsViewProps {
  initialRequests: ServiceRequestListItem[];
  departments: DepartmentWithStats[];
  userRole: string;
}

const CATEGORY_LABELS: Record<RequestCategory, string> = {
  DESIGN: "Créatif & Design",
  VIDEO: "Audiovisuel & Montage",
  WEB: "Développement Web",
  PHOTO: "Photographie & Couverture",
  LOGISTICS: "Logistique & Matériel",
  COMMUNICATION: "Communication & Presse",
  GENERAL: "Général / Autre",
};

const STATUS_CONFIG: Record<
  RequestStatus,
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
  NEW: { label: "Nouveau", variant: "pending" },
  ACCEPTED: { label: "Accepté", variant: "review" },
  IN_PROGRESS: { label: "En Cours", variant: "planning" },
  COMPLETED: { label: "Terminé", variant: "approved" },
  REJECTED: { label: "Refusé", variant: "rejected" },
  CONVERTED_TO_TASK: { label: "Converti en Tâche", variant: "cyan" },
};

const PRIORITY_CONFIG: Record<RequestPriority, { label: string; color: string }> = {
  LOW: { label: "Faible", color: "text-slate-400" },
  MEDIUM: { label: "Moyenne", color: "text-blue-400" },
  HIGH: { label: "Haute", color: "text-amber-400" },
  CRITICAL: { label: "Urgente", color: "text-red-400 font-bold" },
};

export function RequestsView({ initialRequests, departments, userRole }: RequestsViewProps) {
  const [requests, setRequests] = useState<ServiceRequestListItem[]>(initialRequests);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Modals state
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequestListItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [rejectionTarget, setRejectionTarget] = useState<ServiceRequestListItem | null>(null);
  const [isRejectOpen, setIsRejectOpen] = useState(false);

  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "DESIGN" as RequestCategory,
    target_department_id: departments[0]?.id || "",
    requesting_department_id: "",
    priority: "MEDIUM" as RequestPriority,
    desired_deadline: "",
  });

  const canManage = userRole === "SUPER_ADMIN" || userRole === "COORDINATOR";
  const canDelete = userRole === "SUPER_ADMIN";

  const filteredRequests = requests.filter((req) => {
    if (categoryFilter !== "ALL" && req.category !== categoryFilter) return false;
    if (statusFilter !== "ALL" && req.status !== statusFilter) return false;
    if (
      search.trim() &&
      !req.title.toLowerCase().includes(search.toLowerCase()) &&
      !req.code.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const stats = {
    total: requests.length,
    new: requests.filter((r) => r.status === "NEW").length,
    inProgress: requests.filter((r) => r.status === "ACCEPTED" || r.status === "IN_PROGRESS").length,
    completed: requests.filter((r) => r.status === "COMPLETED" || r.status === "CONVERTED_TO_TASK").length,
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createServiceRequestAction({
        ...formData,
        target_department_id: formData.target_department_id,
        requesting_department_id: formData.requesting_department_id || null,
        desired_deadline: formData.desired_deadline || null,
      });

      if (res.success) {
        setActionMessage({ text: res.message });
        setIsCreateOpen(false);
        const targetDept = departments.find((d) => d.id === formData.target_department_id);
        const newReq: ServiceRequestListItem = {
          id: res.data.id,
          code: res.data.code,
          title: formData.title,
          description: formData.description,
          category: formData.category,
          requesting_department_id: formData.requesting_department_id || null,
          requesting_department_name: null,
          target_department_id: formData.target_department_id,
          target_department_name: targetDept?.name || "Département",
          target_department_code: targetDept?.code || "UEC",
          requester_id: "",
          requester_name: "Moi",
          priority: formData.priority,
          desired_deadline: formData.desired_deadline || null,
          attachments: [],
          status: "NEW",
          assigned_coordinator_id: null,
          assigned_coordinator_name: null,
          converted_task_id: null,
          rejection_reason: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setRequests([newReq, ...requests]);
        setFormData({
          title: "",
          description: "",
          category: "DESIGN",
          target_department_id: departments[0]?.id || "",
          requesting_department_id: "",
          priority: "MEDIUM",
          desired_deadline: "",
        });
      } else {
        setActionMessage({ text: res.message, error: true });
      }
      setTimeout(() => setActionMessage(null), 4000);
    });
  };

  const handleStatusChange = (requestId: string, newStatus: RequestStatus, reason?: string) => {
    startTransition(async () => {
      const res = await updateRequestStatusAction(requestId, newStatus, reason);
      if (res.success) {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === requestId
              ? { ...r, status: newStatus, rejection_reason: reason || r.rejection_reason }
              : r
          )
        );
        setActionMessage({ text: res.message });
        if (selectedRequest?.id === requestId) {
          setSelectedRequest({
            ...selectedRequest,
            status: newStatus,
            rejection_reason: reason || selectedRequest.rejection_reason,
          });
        }
      } else {
        setActionMessage({ text: res.message, error: true });
      }
      setTimeout(() => setActionMessage(null), 3000);
    });
  };

  const handleConvertToTask = (requestId: string) => {
    startTransition(async () => {
      const res = await convertRequestToTaskAction(requestId);
      if (res.success) {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === requestId
              ? { ...r, status: "CONVERTED_TO_TASK", converted_task_id: res.data.id }
              : r
          )
        );
        setActionMessage({ text: res.message });
        if (selectedRequest?.id === requestId) {
          setSelectedRequest({
            ...selectedRequest,
            status: "CONVERTED_TO_TASK",
            converted_task_id: res.data.id,
          });
        }
      } else {
        setActionMessage({ text: res.message, error: true });
      }
      setTimeout(() => setActionMessage(null), 3000);
    });
  };

  const handleDeleteRequest = (requestId: string) => {
    startTransition(async () => {
      const res = await deleteServiceRequestAction(requestId);
      if (res.success) {
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
        setActionMessage({ text: res.message });
        setIsDetailOpen(false);
        setSelectedRequest(null);
      } else {
        setActionMessage({ text: res.message, error: true });
      }
      setTimeout(() => setActionMessage(null), 3000);
    });
  };

  const openDetail = (req: ServiceRequestListItem) => {
    setSelectedRequest(req);
    setIsDetailOpen(true);
  };

  const openReject = (req: ServiceRequestListItem) => {
    setRejectionTarget(req);
    setIsRejectOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Inbox size={24} className="text-uec-red" />
            <span>Guichet Unique & Demandes de Service</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Canal institutionnel pour soumettre, instruire et convertir les besoins inter-pôles.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          variant="primary"
          size="sm"
          className="flex items-center gap-1.5 bg-uec-red hover:bg-uec-red/90 text-white"
        >
          <Plus size={16} />
          <span>Nouvelle Demande</span>
        </Button>
      </div>

      {/* Action feedback toast */}
      {actionMessage && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2 animate-in fade-in ${
            actionMessage.error
              ? "bg-rose-500/10 border border-rose-500/30 text-rose-400"
              : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
          }`}
        >
          {actionMessage.error ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* KPI Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Demandes" value={stats.total} icon={<Layers size={18} />} accentColor="blue" />
        <StatCard title="En Attente (New)" value={stats.new} icon={<Clock size={18} />} accentColor="red" />
        <StatCard title="En Traitement" value={stats.inProgress} icon={<Sparkles size={18} />} accentColor="gold" />
        <StatCard title="Clôturées / Tâches" value={stats.completed} icon={<CheckCircle2 size={18} />} accentColor="green" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 rtl:left-auto rtl:right-3"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par référence (ex: REQ-001) ou titre..."
              className="pl-9 rtl:pl-3 rtl:pr-9 text-xs"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-[#0B1020] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
            >
              <option value="ALL">Toutes les Catégories</option>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#0B1020] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
            >
              <option value="ALL">Tous les Statuts</option>
              <option value="NEW">Nouveau</option>
              <option value="ACCEPTED">Accepté</option>
              <option value="IN_PROGRESS">En Cours</option>
              <option value="CONVERTED_TO_TASK">Converti en Tâche</option>
              <option value="COMPLETED">Terminé</option>
              <option value="REJECTED">Refusé</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Aucune demande de service trouvée"
          description="Aucune demande ne correspond aux critères de recherche ou de filtrage sélectionnés."
          action={{
            label: "Créer une Demande",
            onClick: () => setIsCreateOpen(true),
            icon: Plus,
          }}
        />
      ) : (
        <Card>
          <div className="divide-y divide-[#1F2937]">
            {filteredRequests.map((req) => {
              const statusCfg = STATUS_CONFIG[req.status] || {
                label: req.status,
                variant: "default",
              };
              const priorityCfg = PRIORITY_CONFIG[req.priority] || PRIORITY_CONFIG.MEDIUM;
              const dateFormatted = new Date(req.created_at).toLocaleDateString("fr-FR");

              return (
                <div
                  key={req.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-900/40 transition-colors"
                >
                  <div className="space-y-1.5 flex-1 cursor-pointer" onClick={() => openDetail(req)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-300">
                        {req.code}
                      </span>
                      <Badge variant={statusCfg.variant} size="sm">
                        {statusCfg.label}
                      </Badge>
                      <span className={`text-[10px] ${priorityCfg.color}`}>
                        Priorité: {priorityCfg.label}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-white hover:text-uec-red transition-colors">
                      {req.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-1">{req.description}</p>

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
                      <span>
                        Demandeur: <strong className="text-slate-300">{req.requester_name}</strong>
                      </span>
                      <span>
                        Vers pôle:{" "}
                        <strong className="text-uec-cyan">{req.target_department_name}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {dateFormatted}
                      </span>
                      {req.desired_deadline && (
                        <span className="text-amber-400">
                          Échéance: {new Date(req.desired_deadline).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDetail(req)}
                      className="text-slate-400 hover:text-white"
                      title="Voir les détails complets"
                    >
                      <Eye size={14} className="mr-1" />
                      Détails
                    </Button>

                    {canManage && req.status === "NEW" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleStatusChange(req.id, "ACCEPTED")}
                        >
                          <Check size={14} className="mr-1 text-emerald-400" />
                          Accepter
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => openReject(req)}
                          className="text-rose-400 hover:text-rose-300"
                        >
                          <XCircle size={14} className="mr-1" />
                          Refuser
                        </Button>
                      </>
                    )}

                    {canManage && (req.status === "NEW" || req.status === "ACCEPTED") && (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleConvertToTask(req.id)}
                      >
                        <ArrowRight size={14} className="mr-1" />
                        Convertir en Tâche
                      </Button>
                    )}

                    {canManage && req.status === "IN_PROGRESS" && (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleStatusChange(req.id, "COMPLETED")}
                      >
                        <CheckCircle2 size={14} className="mr-1" />
                        Marquer Livré
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* New Request Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#0e0e12] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl shadow-black/90 p-6 relative">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-uec-blue"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>

            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Sparkles size={18} className="text-uec-red" />
              <span>Créer une Demande de Service</span>
            </h2>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Intitulé du besoin *
                </label>
                <Input
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Conception Affiche Tournoi Inter-Universités"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Catégorie *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value as RequestCategory })
                    }
                    className="w-full bg-[#0B1020] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
                  >
                    <option value="DESIGN">Créatif & Design</option>
                    <option value="VIDEO">Audiovisuel & Montage</option>
                    <option value="WEB">Développement Web</option>
                    <option value="PHOTO">Photographie</option>
                    <option value="LOGISTICS">Logistique & Matériel</option>
                    <option value="COMMUNICATION">Communication</option>
                    <option value="GENERAL">Général</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Pôle Destinataire *
                  </label>
                  <select
                    required
                    value={formData.target_department_id}
                    onChange={(e) =>
                      setFormData({ ...formData, target_department_id: e.target.value })
                    }
                    className="w-full bg-[#0B1020] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Niveau de Priorité
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value as RequestPriority })
                    }
                    className="w-full bg-[#0B1020] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
                  >
                    <option value="LOW">Faible</option>
                    <option value="MEDIUM">Moyenne</option>
                    <option value="HIGH">Haute</option>
                    <option value="CRITICAL">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Date souhaitée de livraison
                  </label>
                  <Input
                    type="date"
                    value={formData.desired_deadline}
                    onChange={(e) => setFormData({ ...formData, desired_deadline: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description détaillée du besoin *
                </label>
                <textarea
                  rows={4}
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Expliquez le contexte, les dimensions nécessaires, le texte à intégrer ou toute contrainte technique..."
                  className="w-full bg-[#0B1020] text-xs text-white placeholder-slate-500 rounded-lg p-3 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isPending}>
                  {isPending ? "Transmission..." : "Envoyer la Demande"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <RequestDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        request={selectedRequest}
        canManage={canManage}
        canDelete={canDelete}
        isPending={isPending}
        onAccept={(id) => handleStatusChange(id, "ACCEPTED")}
        onOpenReject={(req) => {
          setIsDetailOpen(false);
          openReject(req);
        }}
        onConvertToTask={handleConvertToTask}
        onComplete={(id) => handleStatusChange(id, "COMPLETED")}
        onDelete={handleDeleteRequest}
      />

      {/* Rejection Reason Modal */}
      <RequestRejectionModal
        isOpen={isRejectOpen}
        onClose={() => {
          setIsRejectOpen(false);
          setRejectionTarget(null);
        }}
        request={rejectionTarget}
        onSuccess={(id, reason) => {
          setRequests((prev) =>
            prev.map((r) => (r.id === id ? { ...r, status: "REJECTED", rejection_reason: reason } : r))
          );
          setActionMessage({ text: "Demande refusée avec notification motivée transmise au demandeur." });
          setTimeout(() => setActionMessage(null), 3500);
        }}
      />
    </div>
  );
}
