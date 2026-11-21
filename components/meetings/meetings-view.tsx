"use client";

import React, { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Users2,
  Plus,
  Clock,
  MapPin,
  Video,
  FileText,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";
import type { MeetingListItem, MeetingStatus } from "@/lib/data/meetings";
import type { DepartmentWithStats } from "@/lib/data/departments";
import type { MemberListItem } from "@/lib/data/members";
import {
  createMeetingAction,
  updateMeetingStatusAction,
  saveMeetingMinutesAction,
} from "@/app/actions/meetings";

interface MeetingsViewProps {
  initialMeetings: MeetingListItem[];
  departments: DepartmentWithStats[];
  members: MemberListItem[];
  userRole: string;
}

const STATUS_CONFIG: Record<
  MeetingStatus,
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
  SCHEDULED: { label: "Planifiée", variant: "planning" },
  IN_PROGRESS: { label: "En Cours", variant: "review" },
  COMPLETED: { label: "Terminée (PV Clôturé)", variant: "approved" },
  CANCELLED: { label: "Annulée", variant: "rejected" },
};

export function MeetingsView({
  initialMeetings,
  departments,
  members,
  userRole,
}: MeetingsViewProps) {
  const [meetings, setMeetings] = useState<MeetingListItem[]>(initialMeetings);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedMeetingMinutes, setSelectedMeetingMinutes] = useState<MeetingListItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // Form State for New Meeting
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    department_id: "",
    scheduled_at: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    duration_min: 60,
    location: "Siège UEC / Local",
    meeting_link: "",
    agendaItem: "",
    agenda: [] as string[],
    attendee_ids: [] as string[],
  });

  // Form State for Minutes (PV)
  const [minutesForm, setMinutesForm] = useState({
    content: "",
    decisionItem: "",
    decisions: [] as string[],
    actionItemText: "",
    actionItemAssignee: "",
    action_items: [] as Array<{ text: string; assignee?: string }>,
  });

  const canManage = userRole === "SUPER_ADMIN" || userRole === "COORDINATOR";

  const filteredMeetings = meetings.filter((m) => {
    if (statusFilter !== "ALL" && m.status !== statusFilter) return false;
    if (deptFilter !== "ALL" && m.department_id !== deptFilter) return false;
    if (search.trim() && !m.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: meetings.length,
    upcoming: meetings.filter((m) => m.status === "SCHEDULED").length,
    completed: meetings.filter((m) => m.status === "COMPLETED").length,
  };

  const handleAddAgenda = () => {
    if (!formData.agendaItem.trim()) return;
    setFormData({
      ...formData,
      agenda: [...formData.agenda, formData.agendaItem.trim()],
      agendaItem: "",
    });
  };

  const handleRemoveAgenda = (idx: number) => {
    setFormData({
      ...formData,
      agenda: formData.agenda.filter((_, i) => i !== idx),
    });
  };

  const handleToggleAttendee = (uid: string) => {
    if (formData.attendee_ids.includes(uid)) {
      setFormData({
        ...formData,
        attendee_ids: formData.attendee_ids.filter((id) => id !== uid),
      });
    } else {
      setFormData({
        ...formData,
        attendee_ids: [...formData.attendee_ids, uid],
      });
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createMeetingAction({
        title: formData.title,
        description: formData.description || null,
        department_id: formData.department_id || null,
        scheduled_at: formData.scheduled_at,
        duration_min: Number(formData.duration_min),
        location: formData.location || null,
        meeting_link: formData.meeting_link || null,
        agenda: formData.agenda,
        attendee_ids: formData.attendee_ids,
      });

      if (res.success) {
        setActionMessage({ text: res.message });
        setIsCreateOpen(false);
        const dept = departments.find((d) => d.id === formData.department_id);
        const newM: MeetingListItem = {
          id: res.data.id,
          title: formData.title,
          description: formData.description || null,
          department_id: formData.department_id || null,
          department_name: dept?.name || null,
          department_code: dept?.code || null,
          scheduled_at: new Date(formData.scheduled_at).toISOString(),
          duration_min: Number(formData.duration_min),
          location: formData.location || null,
          meeting_link: formData.meeting_link || null,
          agenda: formData.agenda,
          status: "SCHEDULED",
          created_by: "",
          creator_name: "Moi",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          attendees: formData.attendee_ids.map((uid) => {
            const mem = members.find((m) => m.id === uid);
            return {
              id: uid,
              user_id: uid,
              user_name: mem?.full_name || "Membre",
              avatar_url: mem?.avatar_url || null,
              status: "INVITED",
            };
          }),
          minutes: null,
        };
        setMeetings([newM, ...meetings]);
        setFormData({
          title: "",
          description: "",
          department_id: "",
          scheduled_at: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
          duration_min: 60,
          location: "Siège UEC / Local",
          meeting_link: "",
          agendaItem: "",
          agenda: [],
          attendee_ids: [],
        });
      } else {
        setActionMessage({ text: res.message, error: true });
      }
      setTimeout(() => setActionMessage(null), 4000);
    });
  };

  const handleStatusChange = (meetingId: string, newStatus: MeetingStatus) => {
    startTransition(async () => {
      const res = await updateMeetingStatusAction(meetingId, newStatus);
      if (res.success) {
        setMeetings((prev) =>
          prev.map((m) => (m.id === meetingId ? { ...m, status: newStatus } : m))
        );
        setActionMessage({ text: res.message });
      } else {
        setActionMessage({ text: res.message, error: true });
      }
      setTimeout(() => setActionMessage(null), 3000);
    });
  };

  const handleOpenMinutesModal = (meeting: MeetingListItem) => {
    setSelectedMeetingMinutes(meeting);
    if (meeting.minutes) {
      setMinutesForm({
        content: meeting.minutes.content,
        decisionItem: "",
        decisions: meeting.minutes.decisions,
        actionItemText: "",
        actionItemAssignee: "",
        action_items: meeting.minutes.action_items,
      });
    } else {
      setMinutesForm({
        content: "",
        decisionItem: "",
        decisions: [],
        actionItemText: "",
        actionItemAssignee: "",
        action_items: [],
      });
    }
  };

  const handleAddDecision = () => {
    if (!minutesForm.decisionItem.trim()) return;
    setMinutesForm({
      ...minutesForm,
      decisions: [...minutesForm.decisions, minutesForm.decisionItem.trim()],
      decisionItem: "",
    });
  };

  const handleAddActionItem = () => {
    if (!minutesForm.actionItemText.trim()) return;
    setMinutesForm({
      ...minutesForm,
      action_items: [
        ...minutesForm.action_items,
        {
          text: minutesForm.actionItemText.trim(),
          assignee: minutesForm.actionItemAssignee || undefined,
        },
      ],
      actionItemText: "",
      actionItemAssignee: "",
    });
  };

  const handleSaveMinutesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeetingMinutes) return;

    startTransition(async () => {
      const res = await saveMeetingMinutesAction(selectedMeetingMinutes.id, {
        content: minutesForm.content,
        decisions: minutesForm.decisions,
        action_items: minutesForm.action_items,
      });

      if (res.success) {
        setActionMessage({ text: res.message });
        setMeetings((prev) =>
          prev.map((m) =>
            m.id === selectedMeetingMinutes.id
              ? {
                  ...m,
                  status: "COMPLETED",
                  minutes: {
                    id: "temp-min",
                    meeting_id: m.id,
                    recorded_by: "",
                    recorder_name: "Moi",
                    content: minutesForm.content,
                    decisions: minutesForm.decisions,
                    action_items: minutesForm.action_items,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                }
              : m
          )
        );
        setSelectedMeetingMinutes(null);
      } else {
        setActionMessage({ text: res.message, error: true });
      }
      setTimeout(() => setActionMessage(null), 3000);
    });
  };

  return (
    <div className="space-y-6">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users2 size={24} className="text-uec-red" />
            <span>Réunions & Procès-Verbaux (PV)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Organisation des réunions de pôles, ordres du jour, feuilles de présence et PV officiels.
          </p>
        </div>

        {canManage && (
          <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus size={15} className="mr-1.5" />
            Planifier une Réunion
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Réunions"
          value={stats.total.toString()}
          description="Toutes commissions confondues"
          icon={<Users2 size={18} />}
          accentColor="blue"
        />
        <StatCard
          title="Réunions à Venir"
          value={stats.upcoming.toString()}
          description="Convocations actives"
          icon={<Clock size={18} />}
          accentColor="cyan"
        />
        <StatCard
          title="Procès-Verbaux Archivés"
          value={stats.completed.toString()}
          description="Décisions & PV validés"
          icon={<FileText size={18} />}
          accentColor="green"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher une réunion par titre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#111827] text-xs text-white placeholder-slate-500 rounded-lg pl-9 pr-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
              />
            </div>

            {/* Department Filter */}
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="bg-[#111827] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
            >
              <option value="ALL">Tous les pôles</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#111827] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
            >
              <option value="ALL">Tous les statuts</option>
              <option value="SCHEDULED">Planifiée</option>
              <option value="IN_PROGRESS">En Cours</option>
              <option value="COMPLETED">Terminée (avec PV)</option>
              <option value="CANCELLED">Annulée</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Meetings List */}
      {filteredMeetings.length === 0 ? (
        <EmptyState
          icon={Users2}
          title="Aucune réunion trouvée"
          description="Aucune session de réunion n'est programmée pour ces critères de recherche."
          action={
            userRole === "SUPER_ADMIN" || userRole === "COORDINATOR"
              ? {
                  label: "Planifier une Réunion",
                  onClick: () => setIsCreateOpen(true),
                  icon: Plus,
                  variant: "outline",
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredMeetings.map((m) => {
            const statusCfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.SCHEDULED;
            const dateFormatted = new Date(m.scheduled_at).toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <Card key={m.id} className="overflow-hidden">
                <CardHeader className="bg-slate-900/40 border-b border-[#1F2937] pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {m.department_name ? (
                          <span className="text-[10px] font-bold text-uec-cyan bg-blue-950/60 border border-blue-800/40 px-2 py-0.5 rounded">
                            {m.department_name}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 border border-amber-800/40 px-2 py-0.5 rounded">
                            Bureau Exécutif / Global
                          </span>
                        )}
                        <Badge variant={statusCfg.variant} size="sm">
                          {statusCfg.label}
                        </Badge>
                      </div>
                      <CardTitle className="text-base font-bold text-white">{m.title}</CardTitle>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenMinutesModal(m)}
                      >
                        <FileText size={14} className="mr-1.5 text-uec-cyan" />
                        {m.minutes ? "Consulter le PV" : "Rédiger le PV"}
                      </Button>

                      {canManage && m.status === "SCHEDULED" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleStatusChange(m.id, "IN_PROGRESS")}
                        >
                          Démarrer
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  {m.description && (
                    <p className="text-xs text-slate-300">{m.description}</p>
                  )}

                  {/* Metadata Bar */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 bg-[#0B1020]/60 p-3 rounded-xl border border-[#1F2937]">
                    <span className="flex items-center gap-1.5 text-slate-200">
                      <Clock size={14} className="text-uec-red" />
                      <strong>{dateFormatted}</strong> ({m.duration_min} min)
                    </span>

                    {m.location && (
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <MapPin size={14} className="text-uec-cyan" />
                        {m.location}
                      </span>
                    )}

                    {m.meeting_link && (
                      <a
                        href={m.meeting_link}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-blue-400 hover:underline"
                      >
                        <Video size={14} />
                        Lien Visio <ExternalLink size={12} className="ml-0.5" />
                      </a>
                    )}
                  </div>

                  {/* Agenda */}
                  {m.agenda.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Ordre du jour :
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-xs text-slate-300 pl-1">
                        {m.agenda.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Attendees */}
                  {m.attendees.length > 0 && (
                    <div className="border-t border-[#1F2937] pt-3">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Participants convoqués ({m.attendees.length}) :
                      </h4>
                      <div className="flex flex-wrap items-center gap-2">
                        {m.attendees.map((att) => (
                          <div
                            key={att.id}
                            className="flex items-center gap-1.5 bg-slate-800/60 px-2 py-1 rounded-lg border border-slate-700 text-xs text-slate-200"
                          >
                            <Avatar name={att.user_name} size="sm" />
                            <span>{att.user_name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Plan Meeting Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#0e0e12] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl shadow-black/90 p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-uec-blue"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>

            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Sparkles size={18} className="text-uec-red" />
              <span>Planifier une Réunion</span>
            </h2>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Intitulé de la Réunion *
                </label>
                <Input
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Réunion de Cadrage Stratégique Derby 2026"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Pôle Concerné
                  </label>
                  <select
                    value={formData.department_id}
                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                    className="w-full bg-[#0B1020] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
                  >
                    <option value="">Tous les Pôles (Global)</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Durée estimée (minutes)
                  </label>
                  <Input
                    type="number"
                    min={15}
                    max={360}
                    value={formData.duration_min}
                    onChange={(e) =>
                      setFormData({ ...formData, duration_min: Number(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Date et Heure *
                </label>
                <Input
                  type="datetime-local"
                  required
                  value={formData.scheduled_at}
                  onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Lieu physique
                  </label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Ex: Siège UEC / Salle B"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Lien Visio (Meet, Teams)
                  </label>
                  <Input
                    value={formData.meeting_link}
                    onChange={(e) => setFormData({ ...formData, meeting_link: e.target.value })}
                    placeholder="https://meet.google.com/..."
                  />
                </div>
              </div>

              {/* Agenda items */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Points à l'ordre du jour
                </label>
                <div className="flex gap-2">
                  <Input
                    value={formData.agendaItem}
                    onChange={(e) => setFormData({ ...formData, agendaItem: e.target.value })}
                    placeholder="Ajouter un sujet..."
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleAddAgenda}>
                    Ajouter
                  </Button>
                </div>
                {formData.agenda.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {formData.agenda.map((item, idx) => (
                      <li
                        key={idx}
                        className="text-xs text-slate-300 flex items-center justify-between bg-slate-800/40 px-2.5 py-1 rounded-lg"
                      >
                        <span>• {item}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAgenda(idx)}
                          className="text-slate-400 hover:text-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-500 rounded"
                          aria-label="Supprimer ce point de l'ordre du jour"
                        >
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Attendees selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Membres convoqués ({formData.attendee_ids.length} sélectionnés)
                </label>
                <div className="max-h-36 overflow-y-auto border border-[#1F2937] rounded-lg p-2 space-y-1 bg-[#0B1020]">
                  {members.map((m) => {
                    const isSelected = formData.attendee_ids.includes(m.id);
                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => handleToggleAttendee(m.id)}
                        className={`w-full text-left flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors ${
                          isSelected
                            ? "bg-uec-red/20 text-white font-medium border border-uec-red/40"
                            : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                        }`}
                      >
                        <span>{m.full_name}</span>
                        {isSelected && <CheckCircle2 size={14} className="text-uec-red" />}
                      </button>
                    );
                  })}
                </div>
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
                  {isPending ? "Création..." : "Planifier"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Minutes (PV) Modal */}
      {selectedMeetingMinutes && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#0e0e12] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl shadow-black/90 p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedMeetingMinutes(null)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-uec-blue"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>

            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <FileText size={20} className="text-uec-cyan" />
              <span>Procès-Verbal (PV) : {selectedMeetingMinutes.title}</span>
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Rédigez le compte-rendu officiel des discussions, les décisions prises et les actions à mener.
            </p>

            <form onSubmit={handleSaveMinutesSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Compte-rendu des échanges & discussions *
                </label>
                <textarea
                  rows={6}
                  required
                  value={minutesForm.content}
                  onChange={(e) => setMinutesForm({ ...minutesForm, content: e.target.value })}
                  placeholder="Résumé fidèle des interventions, débats et points abordés pendant la séance..."
                  className="w-full bg-[#0B1020] text-xs text-white placeholder-slate-500 rounded-lg p-3 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
                />
              </div>

              {/* Decisions */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Décisions adoptées
                </label>
                <div className="flex gap-2">
                  <Input
                    value={minutesForm.decisionItem}
                    onChange={(e) =>
                      setMinutesForm({ ...minutesForm, decisionItem: e.target.value })
                    }
                    placeholder="Ex: Validation du budget derby à 1500 TND"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleAddDecision}>
                    Ajouter
                  </Button>
                </div>
                {minutesForm.decisions.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {minutesForm.decisions.map((dec, i) => (
                      <li
                        key={i}
                        className="text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-800/40 p-2 rounded-lg"
                      >
                        ✓ {dec}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Action items */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Actions à engager (To-Do)
                </label>
                <div className="flex gap-2">
                  <Input
                    value={minutesForm.actionItemText}
                    onChange={(e) =>
                      setMinutesForm({ ...minutesForm, actionItemText: e.target.value })
                    }
                    placeholder="Action à réaliser..."
                  />
                  <Input
                    value={minutesForm.actionItemAssignee}
                    onChange={(e) =>
                      setMinutesForm({ ...minutesForm, actionItemAssignee: e.target.value })
                    }
                    placeholder="Responsable"
                    className="max-w-[150px]"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleAddActionItem}>
                    Ajouter
                  </Button>
                </div>
                {minutesForm.action_items.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {minutesForm.action_items.map((act, i) => (
                      <li
                        key={i}
                        className="text-xs text-blue-300 bg-blue-950/40 border border-blue-800/40 p-2 rounded-lg flex items-center justify-between"
                      >
                        <span>→ {act.text}</span>
                        {act.assignee && (
                          <span className="text-slate-400 font-mono text-[10px]">
                            Resp: {act.assignee}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#1F2937]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMeetingMinutes(null)}
                >
                  Fermer
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isPending}>
                  {isPending ? "Enregistrement..." : "Valider & Archiver le PV"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
