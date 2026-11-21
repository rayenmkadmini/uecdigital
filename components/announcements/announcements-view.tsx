"use client";

import React, { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Megaphone,
  Plus,
  Clock,
  Pin,
  AlertCircle,
  CheckCircle2,
  X,
  Sparkles,
  Users,
  Search,
  Edit2,
  Trash2,
} from "lucide-react";
import type { AnnouncementItem } from "@/lib/data/announcements";
import type { DepartmentWithStats } from "@/lib/data/departments";
import {
  createAnnouncementAction,
  togglePinAnnouncementAction,
  deleteAnnouncementAction,
} from "@/app/actions/announcements";
import { AnnouncementEditModal } from "./announcement-edit-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

interface AnnouncementsViewProps {
  initialAnnouncements: AnnouncementItem[];
  departments: DepartmentWithStats[];
  userRole: string;
}

const PRIORITY_BADGES: Record<
  string,
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
  CRITICAL: { label: "Urgent & Prioritaire", variant: "red" },
  HIGH: { label: "Important", variant: "review" },
  NORMAL: { label: "Information", variant: "default" },
  LOW: { label: "Note interne", variant: "default" },
};

export function AnnouncementsView({
  initialAnnouncements,
  departments,
  userRole,
}: AnnouncementsViewProps) {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(initialAnnouncements);
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementItem | null>(null);

  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    priority: "NORMAL" as "LOW" | "NORMAL" | "HIGH" | "CRITICAL",
    target_audience: "ALL",
    department_id: "",
    is_pinned: false,
  });

  const canPublish = userRole === "SUPER_ADMIN" || userRole === "COORDINATOR";
  const isSuperAdmin = userRole === "SUPER_ADMIN";

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createAnnouncementAction({
        ...formData,
        department_id: formData.department_id || null,
      });

      if (res.success) {
        setActionMessage({ text: res.message });
        setIsCreateOpen(false);
        const dept = departments.find((d) => d.id === formData.department_id);
        const newAnn: AnnouncementItem = {
          id: res.data.id,
          title: formData.title,
          content: formData.content,
          author_id: "",
          author_name: "Moi",
          target_audience: formData.target_audience,
          department_id: formData.department_id || null,
          department_name: dept?.name || null,
          priority: formData.priority,
          is_pinned: formData.is_pinned,
          published_at: new Date().toISOString(),
          expires_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setAnnouncements([newAnn, ...announcements]);
        setFormData({
          title: "",
          content: "",
          priority: "NORMAL",
          target_audience: "ALL",
          department_id: "",
          is_pinned: false,
        });
      } else {
        setActionMessage({ text: res.message, error: true });
      }
      setTimeout(() => setActionMessage(null), 4000);
    });
  };

  const handleTogglePin = (id: string, currentPin: boolean) => {
    startTransition(async () => {
      const res = await togglePinAnnouncementAction(id, !currentPin);
      if (res.success) {
        setAnnouncements((prev) =>
          prev.map((a) => (a.id === id ? { ...a, is_pinned: !currentPin } : a))
        );
        setActionMessage({ text: res.message });
      } else {
        setActionMessage({ text: res.message, error: true });
      }
      setTimeout(() => setActionMessage(null), 3000);
    });
  };

  const handleConfirmDeleteAnnouncement = () => {
    if (!deleteTarget) return;

    startTransition(async () => {
      const res = await deleteAnnouncementAction(deleteTarget.id);
      if (res.success) {
        setAnnouncements((prev) => prev.filter((a) => a.id !== deleteTarget.id));
        showToast("Annonce supprimée avec succès.", "success");
        setDeleteTarget(null);
      } else {
        showToast(res.message, "error");
      }
    });
  };

  const filteredAnnouncements = announcements.filter((ann) => {
    const s = searchTerm.toLowerCase().trim();
    const matchSearch =
      !s ||
      ann.title.toLowerCase().includes(s) ||
      ann.content.toLowerCase().includes(s) ||
      ann.author_name.toLowerCase().includes(s);

    const matchPriority = priorityFilter === "ALL" || ann.priority === priorityFilter;
    const matchDept = deptFilter === "ALL" || ann.department_id === deptFilter;

    return matchSearch && matchPriority && matchDept;
  });

  return (
    <div className="space-y-6">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Megaphone size={24} className="text-uec-red" />
            <span>Annonces & Directives Officielles</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Communications institutionnelles, directives opérationnelles et consignes du Bureau UEC ({announcements.length} annonces répertoriées).
          </p>
        </div>

        {canPublish && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="bg-uec-red hover:bg-uec-red/90 text-white"
          >
            <Plus size={15} className="mr-1.5" />
            Publier une Annonce
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

      {/* Filter and search bar */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 rtl:left-auto rtl:right-3"
            />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher une directive, annonce ou consigne..."
              className="pl-9 rtl:pl-3 rtl:pr-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {["ALL", "CRITICAL", "HIGH", "NORMAL", "LOW"].map((prio) => (
              <button
                key={prio}
                onClick={() => setPriorityFilter(prio)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${
                  priorityFilter === prio
                    ? "bg-uec-red text-white"
                    : "bg-[#111827] border border-[#1F2937] text-slate-400 hover:text-white"
                }`}
              >
                {prio === "ALL" ? "Toutes" : prio}
              </button>
            ))}
          </div>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="bg-[#0B1020] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
          >
            <option value="ALL">Tous les Destinataires</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                Pôle {d.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Announcements Stream */}
      {filteredAnnouncements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Aucune annonce trouvée"
          description="Les directives officielles et communications internes du bureau exécutif apparaîtront ici."
          action={
            canPublish
              ? {
                  label: "Publier une Annonce",
                  onClick: () => setIsCreateOpen(true),
                  icon: Plus,
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredAnnouncements.map((ann) => {
            const prioCfg = PRIORITY_BADGES[ann.priority] || PRIORITY_BADGES.NORMAL;
            const dateFormatted = new Date(ann.published_at).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <Card
                key={ann.id}
                className={`overflow-hidden transition-all ${
                  ann.is_pinned
                    ? "border-amber-500/40 bg-gradient-to-r from-amber-950/20 via-[#111827] to-[#111827]"
                    : ""
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {ann.is_pinned && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-950/70 border border-amber-700/60 px-2 py-0.5 rounded-full">
                          <Pin size={10} className="rotate-45" /> Épinglé
                        </span>
                      )}

                      <Badge variant={prioCfg.variant} size="sm">
                        {prioCfg.label}
                      </Badge>

                      {ann.department_name ? (
                        <span className="text-[10px] text-uec-cyan font-semibold bg-blue-950/60 border border-blue-800/40 px-2 py-0.5 rounded">
                          {ann.department_name}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded">
                          <Users size={11} /> Tous les membres UEC
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock size={12} /> {dateFormatted}
                      </span>

                      {isSuperAdmin && (
                        <button
                          onClick={() => handleTogglePin(ann.id, ann.is_pinned)}
                          disabled={isPending}
                          className="p-1 text-slate-400 hover:text-amber-400 transition-colors"
                          title={ann.is_pinned ? "Désépingler" : "Épingler en tête"}
                        >
                          <Pin size={14} className={ann.is_pinned ? "fill-amber-400 text-amber-400" : ""} />
                        </button>
                      )}

                      {canPublish && (
                        <>
                          <button
                            onClick={() => {
                              setEditingAnnouncement(ann);
                              setIsEditOpen(true);
                            }}
                            className="p-1 text-slate-400 hover:text-white transition-colors"
                            title="Modifier l'annonce"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(ann)}
                            disabled={isPending}
                            className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Supprimer l'annonce"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <CardTitle className="text-base font-bold text-white mt-1">
                    {ann.title}
                  </CardTitle>
                </CardHeader>

                <CardContent className="pt-0 space-y-3">
                  <div className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                    {ann.content}
                  </div>

                  <div className="pt-2 border-t border-[#1F2937] flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      Diffusé par : <strong className="text-slate-200">{ann.author_name}</strong>
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Creation Modal */}
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
              <span>Publier une Nouvelle Annonce</span>
            </h2>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Titre de l'annonce *
                </label>
                <Input
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Briefing Général — Derby Capitale"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Priorité
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        priority: e.target.value as any,
                      })
                    }
                    className="w-full bg-[#0B1020] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
                  >
                    <option value="NORMAL">Information (Normale)</option>
                    <option value="HIGH">Important (Haute)</option>
                    <option value="CRITICAL">Urgent & Prioritaire</option>
                    <option value="LOW">Note Interne</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Ciblage (Pôle)
                  </label>
                  <select
                    value={formData.department_id}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        department_id: e.target.value,
                        target_audience: e.target.value ? "DEPARTMENT" : "ALL",
                      })
                    }
                    className="w-full bg-[#0B1020] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
                  >
                    <option value="">Tous les membres UEC</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Message & Directives *
                </label>
                <textarea
                  rows={5}
                  required
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Rédigez ici le contenu de la directive ou communication officielle..."
                  className="w-full bg-[#0B1020] text-xs text-white placeholder-slate-500 rounded-lg p-3 border border-[#1F2937] focus:border-uec-blue focus:outline-none resize-none leading-relaxed"
                />
              </div>

              {isSuperAdmin && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_pinned"
                    checked={formData.is_pinned}
                    onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })}
                    className="rounded border-[#1F2937] text-uec-red focus:ring-uec-red"
                  />
                  <label htmlFor="is_pinned" className="text-xs text-slate-300 cursor-pointer">
                    Épingler en tête de liste (Visibilité prioritaire)
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isPending}
                  className="bg-uec-red hover:bg-uec-red/90 text-white"
                >
                  {isPending ? "Diffusion..." : "Diffuser l'Annonce"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <AnnouncementEditModal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditingAnnouncement(null);
        }}
        announcement={editingAnnouncement}
        departments={departments}
        onSuccess={(updated) => {
          setAnnouncements((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
          setActionMessage({ text: "Annonce mise à jour avec succès." });
          setTimeout(() => setActionMessage(null), 3000);
        }}
      />
      {/* Confirm Delete Announcement Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDeleteAnnouncement}
        title="Supprimer définitivement l'annonce ?"
        description={`Êtes-vous certain de vouloir supprimer l'annonce officielle "${deleteTarget?.title}" ? Cette information ne sera plus visible par les membres ciblés.`}
        confirmLabel="Supprimer l'annonce"
        cancelLabel="Conserver"
        variant="danger"
        isLoading={isPending}
      />
    </div>
  );
}
