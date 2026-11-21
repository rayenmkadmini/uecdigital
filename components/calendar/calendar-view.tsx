"use client";

import React, { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  Search,
  Filter,
  CheckCircle2,
  ExternalLink,
  Edit,
  Share2,
  AlertCircle,
  X,
  Send,
  Sparkles,
} from "lucide-react";
import type { CalendarItem, ContentPlatform, ContentType, CalendarWorkflowStatus } from "@/lib/data/calendar";
import type { MemberListItem } from "@/lib/data/members";
import { createCalendarItemAction, updateCalendarStatusAction, updateCalendarItemAction } from "@/app/actions/calendar";

interface CalendarViewProps {
  initialItems: CalendarItem[];
  members: MemberListItem[];
  userRole: string;
}

const PLATFORM_COLORS: Record<ContentPlatform, { bg: string; text: string; border: string }> = {
  INSTAGRAM: { bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/30" },
  FACEBOOK: { bg: "bg-blue-600/10", text: "text-blue-400", border: "border-blue-600/30" },
  TIKTOK: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/30" },
  LINKEDIN: { bg: "bg-sky-600/10", text: "text-sky-400", border: "border-sky-600/30" },
  TWITTER: { bg: "bg-slate-400/10", text: "text-slate-300", border: "border-slate-500/30" },
  WEBSITE: { bg: "bg-red-600/10", text: "text-red-400", border: "border-red-600/30" },
  OTHER: { bg: "bg-slate-700/20", text: "text-slate-300", border: "border-slate-700" },
};

const STATUS_CONFIG: Record<
  CalendarWorkflowStatus,
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
  IDEA: { label: "Idée", variant: "default" },
  DRAFT: { label: "Brouillon / Rédaction", variant: "planning" },
  IN_DESIGN: { label: "En Design", variant: "review" },
  IN_REVIEW: { label: "En Révision", variant: "pending" },
  APPROVED: { label: "Approuvé", variant: "approved" },
  SCHEDULED: { label: "Programmé", variant: "cyan" },
  PUBLISHED: { label: "Publié", variant: "approved" },
  CANCELLED: { label: "Annulé", variant: "rejected" },
};

export function CalendarView({ initialItems, members, userRole }: CalendarViewProps) {
  const [items, setItems] = useState<CalendarItem[]>(initialItems);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"list" | "grid">("list");
  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    platform: "INSTAGRAM" as ContentPlatform,
    content_type: "POST" as ContentType,
    scheduled_date: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    designer_id: "",
    writer_id: "",
    status: "IDEA" as CalendarWorkflowStatus,
  });

  const canManage = userRole === "SUPER_ADMIN" || userRole === "COORDINATOR";

  const filteredItems = items.filter((item) => {
    if (platformFilter !== "ALL" && item.platform !== platformFilter) return false;
    if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
    if (search.trim() && !item.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: items.length,
    scheduled: items.filter((i) => i.status === "SCHEDULED").length,
    published: items.filter((i) => i.status === "PUBLISHED").length,
    inProgress: items.filter((i) => ["IN_DESIGN", "IN_REVIEW", "DRAFT"].includes(i.status)).length,
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createCalendarItemAction({
        ...formData,
        designer_id: formData.designer_id || null,
        writer_id: formData.writer_id || null,
      });

      if (res.success) {
        setActionMessage({ text: res.message });
        setIsCreateOpen(false);
        // Refresh local items
        setItems([
          ...items,
          {
            id: res.data.id,
            title: formData.title,
            description: formData.description || null,
            platform: formData.platform,
            content_type: formData.content_type,
            scheduled_date: new Date(formData.scheduled_date).toISOString(),
            published_date: null,
            published_url: null,
            designer_id: formData.designer_id || null,
            designer_name: members.find((m) => m.id === formData.designer_id)?.full_name || null,
            writer_id: formData.writer_id || null,
            writer_name: members.find((m) => m.id === formData.writer_id)?.full_name || null,
            status: formData.status,
            attachments: [],
            approved_by: null,
            approver_name: null,
            created_by: "",
            creator_name: "Moi",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
        setFormData({
          title: "",
          description: "",
          platform: "INSTAGRAM",
          content_type: "POST",
          scheduled_date: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
          designer_id: "",
          writer_id: "",
          status: "IDEA",
        });
      } else {
        setActionMessage({ text: res.message, error: true });
      }
      setTimeout(() => setActionMessage(null), 4000);
    });
  };

  const handleQuickStatusChange = (itemId: string, newStatus: CalendarWorkflowStatus) => {
    startTransition(async () => {
      const res = await updateCalendarStatusAction(itemId, newStatus);
      if (res.success) {
        setItems((prev) =>
          prev.map((it) => (it.id === itemId ? { ...it, status: newStatus } : it))
        );
        setActionMessage({ text: `Statut mis à jour : ${STATUS_CONFIG[newStatus].label}` });
      } else {
        setActionMessage({ text: res.message, error: true });
      }
      setTimeout(() => setActionMessage(null), 3000);
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <CalendarIcon size={24} className="text-uec-red" />
            <span>Calendrier Éditorial & Publications</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Planification multicanale, coordination entre rédacteurs, designers et validation finale.
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus size={15} className="mr-1.5" />
          Planifier un Contenu
        </Button>
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

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Total Publications"
          value={stats.total.toString()}
          description="Tous canaux confondus"
          icon={<Share2 size={18} />}
          accentColor="blue"
        />
        <StatCard
          title="En Préparation"
          value={stats.inProgress.toString()}
          description="Design ou Rédaction"
          icon={<Clock size={18} />}
          accentColor="gold"
        />
        <StatCard
          title="Programmées"
          value={stats.scheduled.toString()}
          description="Prêtes pour diffusion"
          icon={<CalendarIcon size={18} />}
          accentColor="cyan"
        />
        <StatCard
          title="Publiées"
          value={stats.published.toString()}
          description="Diffusées avec succès"
          icon={<CheckCircle2 size={18} />}
          accentColor="green"
        />
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par titre de publication..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#111827] text-xs text-white placeholder-slate-500 rounded-lg pl-9 pr-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
              />
            </div>

            {/* Platform filter */}
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="bg-[#111827] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
            >
              <option value="ALL">Toutes plateformes</option>
              <option value="INSTAGRAM">Instagram</option>
              <option value="FACEBOOK">Facebook</option>
              <option value="TIKTOK">TikTok</option>
              <option value="LINKEDIN">LinkedIn</option>
              <option value="TWITTER">X / Twitter</option>
              <option value="WEBSITE">Site Web UEC</option>
              <option value="OTHER">Autre</option>
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#111827] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
            >
              <option value="ALL">Tous les statuts</option>
              <option value="IDEA">Idée</option>
              <option value="DRAFT">Brouillon</option>
              <option value="IN_DESIGN">En Design</option>
              <option value="IN_REVIEW">En Révision</option>
              <option value="APPROVED">Approuvé</option>
              <option value="SCHEDULED">Programmé</option>
              <option value="PUBLISHED">Publié</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 self-end md:self-auto">
            <button
              onClick={() => setActiveTab("list")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === "list"
                  ? "bg-uec-red text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              Liste
            </button>
            <button
              onClick={() => setActiveTab("grid")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === "grid"
                  ? "bg-uec-red text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              Grille Cartes
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Items Container */}
      {filteredItems.length === 0 ? (
        <Card className="text-center py-12">
          <CalendarIcon size={40} className="mx-auto text-slate-600 mb-3" />
          <h3 className="text-sm font-semibold text-white">Aucun contenu trouvé</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Aucune publication ne correspond à vos critères de recherche.
          </p>
        </Card>
      ) : activeTab === "list" ? (
        <Card>
          <div className="divide-y divide-[#1F2937]">
            {filteredItems.map((item) => {
              const platformStyle = PLATFORM_COLORS[item.platform] || PLATFORM_COLORS.OTHER;
              const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.IDEA;
              const scheduledDateFormatted = new Date(item.scheduled_date).toLocaleDateString(
                "fr-FR",
                {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                }
              );

              return (
                <div
                  key={item.id}
                  className="p-4 hover:bg-slate-800/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${platformStyle.bg} ${platformStyle.text} ${platformStyle.border}`}
                      >
                        {item.platform}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                        {item.content_type}
                      </span>
                      <Badge variant={statusCfg.variant} size="sm">
                        {statusCfg.label}
                      </Badge>
                    </div>

                    <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                    {item.description && (
                      <p className="text-xs text-slate-400 line-clamp-1">{item.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
                      <span className="flex items-center gap-1 text-uec-cyan">
                        <Clock size={12} />
                        {scheduledDateFormatted}
                      </span>
                      {item.designer_name && (
                        <span>
                          Design: <strong className="text-slate-300">{item.designer_name}</strong>
                        </span>
                      )}
                      {item.writer_name && (
                        <span>
                          Rédaction: <strong className="text-slate-300">{item.writer_name}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {item.published_url && (
                      <a
                        href={item.published_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        title="Voir le post en ligne"
                      >
                        <ExternalLink size={15} />
                      </a>
                    )}

                    {canManage && item.status !== "PUBLISHED" && (
                      <select
                        value={item.status}
                        onChange={(e) =>
                          handleQuickStatusChange(item.id, e.target.value as CalendarWorkflowStatus)
                        }
                        disabled={isPending}
                        className="bg-[#111827] text-xs text-slate-300 border border-[#1F2937] rounded-lg px-2 py-1.5 focus:border-uec-blue focus:outline-none"
                      >
                        <option value="IDEA">Idée</option>
                        <option value="DRAFT">Brouillon</option>
                        <option value="IN_DESIGN">Design</option>
                        <option value="IN_REVIEW">Révision</option>
                        <option value="APPROVED">Approuver</option>
                        <option value="SCHEDULED">Programmer</option>
                        <option value="PUBLISHED">Marquer Publié</option>
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const platformStyle = PLATFORM_COLORS[item.platform] || PLATFORM_COLORS.OTHER;
            const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.IDEA;
            const scheduledDateFormatted = new Date(item.scheduled_date).toLocaleDateString(
              "fr-FR",
              {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              }
            );

            return (
              <Card key={item.id} className="flex flex-col justify-between">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${platformStyle.bg} ${platformStyle.text} ${platformStyle.border}`}
                    >
                      {item.platform}
                    </span>
                    <Badge variant={statusCfg.variant} size="sm">
                      {statusCfg.label}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm font-semibold text-white line-clamp-2">
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {item.description && (
                    <p className="text-xs text-slate-400 line-clamp-2">{item.description}</p>
                  )}
                  <div className="space-y-1 text-[11px] text-slate-400 border-t border-[#1F2937] pt-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-uec-cyan">
                        <Clock size={12} />
                        Prévu: {scheduledDateFormatted}
                      </span>
                      <span className="text-slate-500 font-mono text-[10px]">
                        {item.content_type}
                      </span>
                    </div>
                    {item.designer_name && (
                      <div>
                        Design: <span className="text-slate-300">{item.designer_name}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Creation Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#27354F] rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>

            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Sparkles size={18} className="text-uec-red" />
              <span>Planifier une Nouvelle Publication</span>
            </h2>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Titre du contenu *
                </label>
                <Input
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Teaser Victoire Derby 2026"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Plateforme *
                  </label>
                  <select
                    value={formData.platform}
                    onChange={(e) =>
                      setFormData({ ...formData, platform: e.target.value as ContentPlatform })
                    }
                    className="w-full bg-[#0B1020] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
                  >
                    <option value="INSTAGRAM">Instagram</option>
                    <option value="FACEBOOK">Facebook</option>
                    <option value="TIKTOK">TikTok</option>
                    <option value="LINKEDIN">LinkedIn</option>
                    <option value="TWITTER">X / Twitter</option>
                    <option value="WEBSITE">Site Web UEC</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Format *
                  </label>
                  <select
                    value={formData.content_type}
                    onChange={(e) =>
                      setFormData({ ...formData, content_type: e.target.value as ContentType })
                    }
                    className="w-full bg-[#0B1020] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
                  >
                    <option value="POST">Post Visuel</option>
                    <option value="REEL">Reel / Vidéo Courte</option>
                    <option value="CAROUSEL">Carrousel</option>
                    <option value="STORY">Story</option>
                    <option value="ARTICLE">Article / Communiqué</option>
                    <option value="VIDEO">Vidéo Longue</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Date et heure de diffusion *
                </label>
                <Input
                  type="datetime-local"
                  required
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Designer assigné
                  </label>
                  <select
                    value={formData.designer_id}
                    onChange={(e) => setFormData({ ...formData, designer_id: e.target.value })}
                    className="w-full bg-[#0B1020] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
                  >
                    <option value="">Aucun assigné</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Rédacteur assigné
                  </label>
                  <select
                    value={formData.writer_id}
                    onChange={(e) => setFormData({ ...formData, writer_id: e.target.value })}
                    className="w-full bg-[#0B1020] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
                  >
                    <option value="">Aucun assigné</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description / Brief de contenu
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Objectif, texte d'accompagnement, hashtags prévus..."
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
                  {isPending ? "Planification..." : "Planifier le contenu"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
