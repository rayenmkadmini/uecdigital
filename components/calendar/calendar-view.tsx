"use client";

import React, { useState, useTransition } from "react";
import { useTranslation } from "@/lib/i18n/context";
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
  CheckCircle2,
  ExternalLink,
  Edit,
  Share2,
  AlertCircle,
  X,
  Sparkles,
  Globe,
  Trash2,
} from "lucide-react";
import type { CalendarItem, ContentPlatform, ContentType, CalendarWorkflowStatus } from "@/lib/data/calendar";
import type { MemberListItem } from "@/lib/data/members";
import {
  createCalendarItemAction,
  updateCalendarStatusAction,
  updateCalendarItemAction,
  deleteCalendarItemAction,
} from "@/app/actions/calendar";

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
  YOUTUBE: { bg: "bg-red-600/10", text: "text-red-400", border: "border-red-600/30" },
  WEBSITE: { bg: "bg-emerald-600/10", text: "text-emerald-400", border: "border-emerald-600/30" },
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

const toDatetimeLocal = (isoString?: string | null) => {
  if (!isoString) return new Date().toISOString().slice(0, 16);
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 16);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return new Date().toISOString().slice(0, 16);
  }
};

export function CalendarView({ initialItems, members, userRole }: CalendarViewProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<CalendarItem[]>(initialItems);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"list" | "grid">("list");
  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // Edit State
  const [editingItem, setEditingItem] = useState<CalendarItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: "",
    description: "",
    platform: "INSTAGRAM" as ContentPlatform,
    content_type: "POST" as ContentType,
    scheduled_date: new Date().toISOString().slice(0, 16),
    designer_id: "",
    writer_id: "",
    status: "IDEA" as CalendarWorkflowStatus,
    published_url: "",
  });

  // Publish Dialog State
  const [publishingItem, setPublishingItem] = useState<CalendarItem | null>(null);
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [publishedUrlInput, setPublishedUrlInput] = useState("");

  // Create Form State
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

  const handleOpenEdit = (item: CalendarItem) => {
    setEditingItem(item);
    setEditFormData({
      title: item.title,
      description: item.description || "",
      platform: item.platform,
      content_type: item.content_type,
      scheduled_date: toDatetimeLocal(item.scheduled_date),
      designer_id: item.designer_id || "",
      writer_id: item.writer_id || "",
      status: item.status,
      published_url: item.published_url || "",
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    startTransition(async () => {
      const res = await updateCalendarItemAction(editingItem.id, {
        title: editFormData.title,
        description: editFormData.description || null,
        platform: editFormData.platform,
        content_type: editFormData.content_type,
        scheduled_date: editFormData.scheduled_date,
        designer_id: editFormData.designer_id || null,
        writer_id: editFormData.writer_id || null,
        status: editFormData.status,
        published_url: editFormData.published_url || null,
      });

      if (res.success) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === editingItem.id
              ? {
                  ...it,
                  title: editFormData.title,
                  description: editFormData.description || null,
                  platform: editFormData.platform,
                  content_type: editFormData.content_type,
                  scheduled_date: new Date(editFormData.scheduled_date).toISOString(),
                  designer_id: editFormData.designer_id || null,
                  designer_name:
                    members.find((m) => m.id === editFormData.designer_id)?.full_name || null,
                  writer_id: editFormData.writer_id || null,
                  writer_name:
                    members.find((m) => m.id === editFormData.writer_id)?.full_name || null,
                  status: editFormData.status,
                  published_url: editFormData.published_url || null,
                }
              : it
          )
        );
        setActionMessage({ text: "Publication mise à jour avec succès" });
        setIsEditOpen(false);
        setEditingItem(null);
      } else {
        setActionMessage({ text: res.message, error: true });
      }
      setTimeout(() => setActionMessage(null), 4000);
    });
  };

  const handleDeleteItem = (itemId: string) => {
    startTransition(async () => {
      const res = await deleteCalendarItemAction(itemId);
      if (res.success) {
        setItems((prev) => prev.filter((it) => it.id !== itemId));
        setActionMessage({ text: res.message });
        setIsEditOpen(false);
        setEditingItem(null);
      } else {
        setActionMessage({ text: res.message, error: true });
      }
      setTimeout(() => setActionMessage(null), 4000);
    });
  };

  const handleOpenPublish = (item: CalendarItem) => {
    setPublishingItem(item);
    setPublishedUrlInput(item.published_url || "");
    setIsPublishOpen(true);
  };

  const handlePublishSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!publishingItem) return;
    startTransition(async () => {
      const res = await updateCalendarStatusAction(
        publishingItem.id,
        "PUBLISHED",
        publishedUrlInput.trim() || undefined
      );

      if (res.success) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === publishingItem.id
              ? {
                  ...it,
                  status: "PUBLISHED",
                  published_url: publishedUrlInput.trim() || it.published_url,
                  published_date: new Date().toISOString(),
                }
              : it
          )
        );
        setActionMessage({
          text: `Publication "${publishingItem.title}" marquée comme publiée !`,
        });
        setIsPublishOpen(false);
        setPublishingItem(null);
      } else {
        setActionMessage({ text: res.message, error: true });
      }
      setTimeout(() => setActionMessage(null), 4000);
    });
  };

  const handleQuickStatusChange = (itemId: string, newStatus: CalendarWorkflowStatus) => {
    if (newStatus === "PUBLISHED") {
      const target = items.find((it) => it.id === itemId);
      if (target) {
        handleOpenPublish(target);
        return;
      }
    }

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
          <div className="flex flex-1 items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
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
              <option value="YOUTUBE">YouTube</option>
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
              <option value="CANCELLED">Annulé</option>
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
                      {item.published_url && (
                        <a
                          href={item.published_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-emerald-400 hover:underline"
                        >
                          <Globe size={11} />
                          Lien en ligne
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {/* Public link if published */}
                    {item.published_url && (
                      <a
                        href={item.published_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        title="Voir la publication en ligne"
                      >
                        <ExternalLink size={15} />
                      </a>
                    )}

                    {/* Quick Publish button for scheduled or approved items */}
                    {canManage && item.status !== "PUBLISHED" && (
                      <Button
                        variant="cyan"
                        size="sm"
                        onClick={() => handleOpenPublish(item)}
                        className="text-xs py-1 h-8"
                        title="Marquer comme publié avec URL"
                      >
                        <Share2 size={13} className="mr-1" />
                        Publier
                      </Button>
                    )}

                    {/* Quick Status Select */}
                    {canManage && (
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
                        <option value="APPROVED">Approuvé</option>
                        <option value="SCHEDULED">Programmé</option>
                        <option value="PUBLISHED">Marquer Publié</option>
                        <option value="CANCELLED">Annulé</option>
                      </select>
                    )}

                    {/* Edit button */}
                    {canManage && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenEdit(item)}
                        className="text-xs py-1 h-8"
                        title="Modifier cette publication"
                      >
                        <Edit size={13} className="mr-1" />
                        Modifier
                      </Button>
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
              <Card key={item.id} className="flex flex-col justify-between hover:border-slate-700 transition-colors">
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
                    {item.writer_name && (
                      <div>
                        Rédaction: <span className="text-slate-300">{item.writer_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  {canManage && (
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                      {item.status !== "PUBLISHED" ? (
                        <button
                          type="button"
                          onClick={() => handleOpenPublish(item)}
                          className="text-[11px] font-semibold text-uec-cyan hover:underline flex items-center gap-1"
                        >
                          <Share2 size={12} />
                          <span>Publier</span>
                        </button>
                      ) : item.published_url ? (
                        <a
                          href={item.published_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-semibold text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <Globe size={12} />
                          <span>Voir en ligne</span>
                        </a>
                      ) : (
                        <span className="text-[11px] text-emerald-400">Publié</span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        className="text-[11px] font-semibold text-slate-300 hover:text-white flex items-center gap-1"
                      >
                        <Edit size={12} />
                        <span>Modifier</span>
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Creation Modal */}
      {isCreateOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
        >
          <div className="bg-[#0e0e12] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl shadow-black/90 p-6 relative">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>

            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Sparkles size={18} className="text-uec-red" />
              <span>{t("calendarModal.createTitle")}</span>
            </h2>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t("calendarModal.contentTitleLabel")}
                </label>
                <Input
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t("calendarModal.contentTitlePlaceholder")}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t("calendarModal.platformLabel")}
                  </label>
                  <select
                    value={formData.platform}
                    onChange={(e) =>
                      setFormData({ ...formData, platform: e.target.value as ContentPlatform })
                    }
                    className="w-full bg-[#111827] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
                  >
                    <option value="INSTAGRAM">Instagram</option>
                    <option value="FACEBOOK">Facebook</option>
                    <option value="TIKTOK">TikTok</option>
                    <option value="LINKEDIN">LinkedIn</option>
                    <option value="TWITTER">X / Twitter</option>
                    <option value="YOUTUBE">YouTube</option>
                    <option value="WEBSITE">Site Web UEC</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t("calendarModal.contentTypeLabel")}
                  </label>
                  <select
                    value={formData.content_type}
                    onChange={(e) =>
                      setFormData({ ...formData, content_type: e.target.value as ContentType })
                    }
                    className="w-full bg-[#111827] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
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
                  {t("calendarModal.scheduledDateLabel")}
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
                    className="w-full bg-[#111827] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
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
                    className="w-full bg-[#111827] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
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
                  className="w-full bg-[#111827] text-xs text-white placeholder-slate-500 rounded-lg p-3 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                >
                  {t("actions.cancel")}
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isPending}>
                  {isPending ? t("calendarModal.saving") : t("calendarModal.submitCreate")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditOpen && editingItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
        >
          <div className="bg-[#0e0e12] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl shadow-black/90 p-6 relative text-white">
            <button
              onClick={() => {
                setIsEditOpen(false);
                setEditingItem(null);
              }}
              disabled={isPending}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>

            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Edit size={18} className="text-uec-cyan" />
              <span>{t("calendarModal.editTitle")}</span>
            </h2>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t("calendarModal.contentTitleLabel")}
                </label>
                <Input
                  required
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t("calendarModal.platformLabel")}
                  </label>
                  <select
                    value={editFormData.platform}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        platform: e.target.value as ContentPlatform,
                      })
                    }
                    className="w-full bg-[#111827] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
                  >
                    <option value="INSTAGRAM">Instagram</option>
                    <option value="FACEBOOK">Facebook</option>
                    <option value="TIKTOK">TikTok</option>
                    <option value="LINKEDIN">LinkedIn</option>
                    <option value="TWITTER">X / Twitter</option>
                    <option value="YOUTUBE">YouTube</option>
                    <option value="WEBSITE">Site Web UEC</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t("calendarModal.contentTypeLabel")}
                  </label>
                  <select
                    value={editFormData.content_type}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        content_type: e.target.value as ContentType,
                      })
                    }
                    className="w-full bg-[#111827] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t("calendarModal.scheduledDateLabel")}
                  </label>
                  <Input
                    type="datetime-local"
                    required
                    value={editFormData.scheduled_date}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, scheduled_date: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Statut du contenu *
                  </label>
                  <select
                    value={editFormData.status}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        status: e.target.value as CalendarWorkflowStatus,
                      })
                    }
                    className="w-full bg-[#111827] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
                  >
                    <option value="IDEA">Idée</option>
                    <option value="DRAFT">Brouillon</option>
                    <option value="IN_DESIGN">En Design</option>
                    <option value="IN_REVIEW">En Révision</option>
                    <option value="APPROVED">Approuvé</option>
                    <option value="SCHEDULED">Programmé</option>
                    <option value="PUBLISHED">Publié</option>
                    <option value="CANCELLED">Annulé</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Designer assigné
                  </label>
                  <select
                    value={editFormData.designer_id}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, designer_id: e.target.value })
                    }
                    className="w-full bg-[#111827] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
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
                    value={editFormData.writer_id}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, writer_id: e.target.value })
                    }
                    className="w-full bg-[#111827] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
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
                  Lien public de la publication (URL)
                </label>
                <Input
                  type="url"
                  value={editFormData.published_url}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, published_url: e.target.value })
                  }
                  placeholder="https://instagram.com/p/... ou https://facebook.com/..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description / Brief de contenu
                </label>
                <textarea
                  rows={3}
                  value={editFormData.description}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, description: e.target.value })
                  }
                  className="w-full bg-[#111827] text-xs text-white placeholder-slate-500 rounded-lg p-3 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleDeleteItem(editingItem.id)}
                  className="text-xs bg-rose-900/60 hover:bg-rose-800 text-rose-200"
                >
                  <Trash2 size={13} className="mr-1 rtl:mr-0 rtl:ml-1" />
                  {t("actions.delete")}
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => {
                      setIsEditOpen(false);
                      setEditingItem(null);
                    }}
                  >
                    {t("actions.cancel")}
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isPending}
                    disabled={isPending}
                  >
                    {t("actions.save")}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Publish Modal */}
      {isPublishOpen && publishingItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
        >
          <div className="bg-[#0e0e12] border border-cyan-500/40 rounded-2xl w-full max-w-md shadow-2xl shadow-black/90 p-6 relative text-white">
            <button
              onClick={() => {
                setIsPublishOpen(false);
                setPublishingItem(null);
              }}
              disabled={isPending}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2.5 mb-3">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-uec-cyan">
                <Globe size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">{t("calendarModal.publishTitle")}</h2>
                <p className="text-xs text-slate-400">{t("calendarModal.publishSubtitle")}</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#111827] border border-[#1F2937] text-xs space-y-1 mb-4">
              <p className="font-semibold text-white">{publishingItem.title}</p>
              <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                <span>{t("calendarModal.platformLabel").replace(" *", "")} : <strong className="text-slate-200">{publishingItem.platform}</strong></span>
                <span>•</span>
                <span>{t("calendarModal.contentTypeLabel").replace(" *", "")} : <strong className="text-slate-200">{publishingItem.content_type}</strong></span>
              </div>
            </div>

            <form onSubmit={handlePublishSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t("calendarModal.publicUrlLabel")}
                </label>
                <Input
                  type="url"
                  value={publishedUrlInput}
                  onChange={(e) => setPublishedUrlInput(e.target.value)}
                  placeholder={t("calendarModal.publicUrlPlaceholder")}
                  autoFocus
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Optionnel : Vous pouvez coller le lien direct pour permettre aux membres d'y accéder en 1 clic.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    setIsPublishOpen(false);
                    setPublishingItem(null);
                  }}
                >
                  {t("actions.cancel")}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  isLoading={isPending}
                  disabled={isPending}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/50"
                >
                  <CheckCircle2 size={14} className="mr-1 rtl:mr-0 rtl:ml-1" />
                  {t("calendarModal.submitPublish")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
