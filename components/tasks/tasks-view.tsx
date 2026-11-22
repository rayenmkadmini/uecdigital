"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CheckSquare,
  Plus,
  Clock,
  Search,
  Upload,
  AlertCircle,
  CheckCircle2,
  X,
  Play,
  Check,
  Building2,
  FolderKanban,
  FileText,
  User,
  Eye,
  Edit2,
  Trash2,
} from "lucide-react";
import type { TaskListItem, TaskStatus, TaskPriority } from "@/lib/data/tasks";
import type { ProjectListItem } from "@/lib/data/projects";
import type { DepartmentWithStats } from "@/lib/data/departments";
import type { MemberListItem } from "@/lib/data/members";
import type { UserRole } from "@/lib/auth/rbac";
import {
  createTaskAction,
  updateTaskStatusAction,
  submitDeliverableAction,
  deleteTaskAction,
} from "@/app/actions/tasks";
import { TaskDetailModal } from "./task-detail-modal";
import { TaskEditModal } from "./task-edit-modal";

interface TasksViewProps {
  tasks: TaskListItem[];
  projects: ProjectListItem[];
  departments: DepartmentWithStats[];
  members: MemberListItem[];
  userRole: UserRole;
  currentUserId: string;
}

export function TasksView({
  tasks: initialTasks,
  projects,
  departments,
  members,
  userRole,
  currentUserId,
}: TasksViewProps) {
  const [tasks, setTasks] = useState<TaskListItem[]>(initialTasks);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [projectFilter, setProjectFilter] = useState<string>("ALL");

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskListItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskListItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);

  const [isPending, setIsPending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // New task form state
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    acceptance_criteria: "",
    project_id: "",
    department_id: departments[0]?.id || "",
    priority: "MEDIUM" as TaskPriority,
    deadline: "",
    assignee_ids: [] as string[],
  });

  // Submit deliverable modal form state
  const [deliverableForm, setDeliverableForm] = useState({
    title: "",
    description: "",
    fileUrlsText: "",
  });

  const canCreate = userRole === "SUPER_ADMIN" || userRole === "COORDINATOR";

  const handleOpenCreate = () => {
    setCreateForm({
      title: "",
      description: "",
      acceptance_criteria: "",
      project_id: "",
      department_id: departments[0]?.id || "",
      priority: "MEDIUM",
      deadline: "",
      assignee_ids: [],
    });
    setFeedback(null);
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setFeedback(null);

    try {
      const res = await createTaskAction({
        title: createForm.title.trim(),
        description: createForm.description.trim() || undefined,
        acceptance_criteria: createForm.acceptance_criteria.trim() || undefined,
        project_id: createForm.project_id || undefined,
        department_id: createForm.department_id,
        priority: createForm.priority,
        deadline: createForm.deadline ? new Date(createForm.deadline).toISOString() : undefined,
        assignee_ids: createForm.assignee_ids,
      });

      if (res.success) {
        setFeedback({ type: "success", message: res.message });
        const dept = departments.find((d) => d.id === createForm.department_id);
        const proj = projects.find((p) => p.id === createForm.project_id);
        const assignedMembers = members.filter((m) => createForm.assignee_ids.includes(m.id));

        const newTask: TaskListItem = {
          id: res.data.id,
          title: createForm.title.trim(),
          description: createForm.description.trim() || null,
          acceptance_criteria: createForm.acceptance_criteria.trim() || null,
          project_id: createForm.project_id || null,
          project_title: proj?.title || null,
          project_code: proj?.code || null,
          department_id: createForm.department_id,
          department_name: dept?.name || "Département",
          department_code: dept?.code || "UEC",
          department_color: dept?.color || "#E01E26",
          priority: createForm.priority,
          status: "TODO",
          start_date: null,
          deadline: createForm.deadline ? new Date(createForm.deadline).toISOString() : null,
          created_by: currentUserId,
          creator_name: "Moi",
          coordinator_id: dept?.coordinator_id || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          assignees: assignedMembers.map((m) => ({
            id: m.id,
            user_id: m.id,
            full_name: m.full_name,
            avatar_url: m.avatar_url,
          })),
        };

        setTasks([newTask, ...tasks]);
        setTimeout(() => setIsCreateOpen(false), 800);
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Erreur de création" });
    } finally {
      setIsPending(false);
    }
  };

  const handleOpenSubmitDeliverable = (taskId: string) => {
    setSubmittingTaskId(taskId);
    setDeliverableForm({
      title: "",
      description: "",
      fileUrlsText: "",
    });
    setFeedback(null);
  };

  const handleSubmitDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittingTaskId) return;
    setIsPending(true);
    setFeedback(null);

    try {
      const urls = deliverableForm.fileUrlsText
        .split("\n")
        .map((u) => u.trim())
        .filter((u) => u.length > 0);

      const res = await submitDeliverableAction(
        submittingTaskId,
        deliverableForm.title.trim(),
        deliverableForm.description.trim(),
        urls
      );

      if (res.success) {
        setFeedback({ type: "success", message: res.message });
        setTasks((prev) =>
          prev.map((t) =>
            t.id === submittingTaskId ? { ...t, status: "COORDINATOR_REVIEW" } : t
          )
        );
        setTimeout(() => setSubmittingTaskId(null), 1000);
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Erreur de soumission" });
    } finally {
      setIsPending(false);
    }
  };

  const handleStartTask = async (taskId: string) => {
    setIsPending(true);
    try {
      const res = await updateTaskStatusAction(taskId, "IN_PROGRESS");
      if (res.success) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: "IN_PROGRESS" } : t))
        );
        if (selectedTask?.id === taskId) {
          setSelectedTask({ ...selectedTask, status: "IN_PROGRESS" });
        }
        setFeedback({ type: "success", message: "Tâche démarrée avec succès." });
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Erreur lors du démarrage" });
    } finally {
      setIsPending(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setIsPending(true);
    try {
      const res = await deleteTaskAction(taskId);
      if (res.success) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        setIsDetailOpen(false);
        setSelectedTask(null);
        setFeedback({ type: "success", message: "Tâche supprimée avec succès." });
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Erreur de suppression" });
    } finally {
      setIsPending(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case "SUPER_ADMIN_APPROVAL":
        return <Badge variant="superAdmin">Validation Super Admin</Badge>;
      case "COORDINATOR_REVIEW":
        return <Badge variant="coordinator">Revue Coordinateur</Badge>;
      case "APPROVED":
        return <Badge variant="approved">Validé Définitivement</Badge>;
      case "IN_PROGRESS":
        return <Badge variant="review">En cours</Badge>;
      case "TODO":
        return <Badge variant="default">À faire</Badge>;
      case "DONE":
        return <Badge variant="approved">Achevé</Badge>;
      case "REVISION_REQUIRED":
        return <Badge variant="red">Révision Requise</Badge>;
      case "REJECTED":
        return <Badge variant="red">Rejeté</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const filtered = tasks.filter((t) => {
    const s = searchTerm.toLowerCase().trim();
    const matchSearch =
      !s ||
      t.title.toLowerCase().includes(s) ||
      (t.description && t.description.toLowerCase().includes(s)) ||
      (t.project_title && t.project_title.toLowerCase().includes(s)) ||
      t.department_name.toLowerCase().includes(s) ||
      t.assignees.some((a) => a.full_name.toLowerCase().includes(s));

    const matchStatus = statusFilter === "ALL" || t.status === statusFilter;
    const matchDept = deptFilter === "ALL" || t.department_id === deptFilter;
    const matchProj = projectFilter === "ALL" || t.project_id === projectFilter;

    return matchSearch && matchStatus && matchDept && matchProj;
  });

  const openDetail = (task: TaskListItem) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  const openEdit = (task: TaskListItem) => {
    setEditingTask(task);
    setIsEditOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <CheckSquare size={24} className="text-uec-red" />
            <span>Gestion des Tâches & Livrables</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Cycle opérationnel complet : assignation, dépôt de livrables, revue technique coordinateur et validation finale Super Admin ({tasks.length} tâches répertoriées).
          </p>
        </div>

        {canCreate && (
          <Button variant="primary" size="sm" onClick={handleOpenCreate} className="bg-uec-red hover:bg-uec-red/90 text-white">
            <Plus size={15} className="mr-1.5" />
            Nouvelle Tâche
          </Button>
        )}
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2 animate-in fade-in ${
            feedback.type === "error"
              ? "bg-rose-500/10 border border-rose-500/30 text-rose-400"
              : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
          }`}
        >
          {feedback.type === "error" ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher une tâche, livrable ou assigné..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status filters */}
        <div className="flex items-center gap-1.5 bg-[#111827] border border-[#1F2937] p-1 rounded-lg overflow-x-auto">
          {[
            "ALL",
            "TODO",
            "IN_PROGRESS",
            "COORDINATOR_REVIEW",
            "SUPER_ADMIN_APPROVAL",
            "APPROVED",
          ].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${
                statusFilter === st ? "bg-uec-red text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {st === "ALL" ? "Toutes" : st.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Secondary Dropdown Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="bg-[#111827] border border-[#1F2937] text-white text-xs rounded-lg p-2.5 flex-1 focus:outline-none focus:border-uec-red"
        >
          <option value="ALL">Tous les pôles ({departments.length})</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.code})
            </option>
          ))}
        </select>

        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="bg-[#111827] border border-[#1F2937] text-white text-xs rounded-lg p-2.5 flex-1 focus:outline-none focus:border-uec-red"
        >
          <option value="ALL">Tous les projets ({projects.length})</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} ({p.code})
            </option>
          ))}
        </select>
      </div>

      {/* Tasks List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="Aucune tâche trouvée"
          description="Aucune tâche ne correspond à vos filtres actuels ou la base de données ne contient pas encore de tâches."
          action={
            canCreate
              ? {
                  label: "Créer la première tâche",
                  onClick: handleOpenCreate,
                  icon: Plus,
                  variant: "outline",
                }
              : undefined
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-[#1F2937]">
              {filtered.map((task) => {
                const isAssigned = task.assignees.some((a) => a.user_id === currentUserId);
                const canManage = userRole === "SUPER_ADMIN" || userRole === "COORDINATOR";
                const canStart = (isAssigned || canManage) && task.status === "TODO";
                const canSubmit = (isAssigned || canManage) && task.status !== "APPROVED" && task.status !== "DONE";

                return (
                  <div
                    key={task.id}
                    className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-900/40 transition-colors"
                  >
                    <div className="space-y-2 flex-1 cursor-pointer" onClick={() => openDetail(task)}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white hover:text-uec-red transition-colors">
                          {task.title}
                        </span>
                        <Badge
                          variant={task.priority === "CRITICAL" || task.priority === "HIGH" ? "red" : "default"}
                          size="sm"
                        >
                          {task.priority}
                        </Badge>
                        {getStatusBadge(task.status)}
                      </div>

                      {task.description && (
                        <p className="text-xs text-slate-400 line-clamp-1">{task.description}</p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                        {task.project_title && (
                          <span className="flex items-center gap-1 text-slate-300">
                            <FolderKanban size={12} className="text-uec-red" />
                            <strong>{task.project_title}</strong>
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-uec-cyan">
                          <Building2 size={12} />
                          {task.department_name}
                        </span>

                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {task.deadline
                            ? `Échéance: ${new Date(task.deadline).toLocaleDateString("fr-FR")}`
                            : "Pas d'échéance"}
                        </span>

                        {task.assignees.length > 0 && (
                          <div className="flex items-center gap-1.5 ml-2">
                            <User size={12} className="text-slate-400" />
                            <span className="text-slate-300">
                              {task.assignees.map((a) => a.full_name).join(", ")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 self-end lg:self-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-slate-400 hover:text-white"
                        onClick={() => openDetail(task)}
                        title="Voir les spécifications complètes"
                      >
                        <Eye size={13} className="mr-1" />
                        Détails
                      </Button>

                      {canStart && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs flex items-center gap-1 border-emerald-600/40 text-emerald-400 hover:bg-emerald-950/30"
                          disabled={isPending}
                          onClick={() => handleStartTask(task.id)}
                        >
                          <Play size={12} className="text-emerald-400 fill-emerald-400" />
                          <span>Démarrer</span>
                        </Button>
                      )}

                      {canSubmit && (
                        <Button
                          variant="primary"
                          size="sm"
                          className="text-xs flex items-center gap-1 bg-uec-blue hover:bg-uec-blue/90 text-white"
                          onClick={() => handleOpenSubmitDeliverable(task.id)}
                        >
                          <Upload size={12} />
                          <span>Déposer Livrable</span>
                        </Button>
                      )}

                      {canManage && (
                        <button
                          onClick={() => openEdit(task)}
                          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title="Modifier la tâche"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* MODAL: Nouvelle Tâche */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-[#0e0e12] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl shadow-black/90 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-uec-blue"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>

            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Plus size={18} className="text-uec-red" />
              <span>Créer une Tâche de Production</span>
            </h2>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Titre de la Tâche *
                </label>
                <Input
                  placeholder="Ex: Conception affiche match retour derby"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Pôle de Compétence *
                  </label>
                  <select
                    value={createForm.department_id}
                    onChange={(e) => setCreateForm({ ...createForm, department_id: e.target.value })}
                    className="w-full bg-[#172033] border border-[#27354F] text-white text-xs rounded-lg p-2.5"
                    required
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Projet Associé (Optionnel)
                  </label>
                  <select
                    value={createForm.project_id}
                    onChange={(e) => setCreateForm({ ...createForm, project_id: e.target.value })}
                    className="w-full bg-[#172033] border border-[#27354F] text-white text-xs rounded-lg p-2.5"
                  >
                    <option value="">Hors projet spécifique</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Priorité
                  </label>
                  <select
                    value={createForm.priority}
                    onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value as TaskPriority })}
                    className="w-full bg-[#172033] border border-[#27354F] text-white text-xs rounded-lg p-2.5"
                  >
                    <option value="LOW">LOW (Basse)</option>
                    <option value="MEDIUM">MEDIUM (Normale)</option>
                    <option value="HIGH">HIGH (Haute)</option>
                    <option value="CRITICAL">CRITICAL (Critique)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Date Limite
                  </label>
                  <Input
                    type="date"
                    value={createForm.deadline}
                    onChange={(e) => setCreateForm({ ...createForm, deadline: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Description des Travaux
                </label>
                <textarea
                  placeholder="Détaillez le travail attendu..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full bg-[#172033] border border-[#27354F] text-white text-xs rounded-lg p-3 min-h-[70px] resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Critères d'Acceptation
                </label>
                <textarea
                  placeholder="Conditions requises pour la validation..."
                  value={createForm.acceptance_criteria}
                  onChange={(e) => setCreateForm({ ...createForm, acceptance_criteria: e.target.value })}
                  className="w-full bg-[#172033] border border-[#27354F] text-white text-xs rounded-lg p-3 min-h-[60px] resize-none"
                />
              </div>

              {/* Assignees select */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Membres Assignés ({createForm.assignee_ids.length} sélectionnés)
                </label>
                <div className="max-h-32 overflow-y-auto p-2 rounded-lg bg-[#111827] border border-[#27354F] grid grid-cols-2 gap-1.5">
                  {members.map((m) => {
                    const selected = createForm.assignee_ids.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setCreateForm((prev) => ({
                            ...prev,
                            assignee_ids: selected
                              ? prev.assignee_ids.filter((id) => id !== m.id)
                              : [...prev.assignee_ids, m.id],
                          }));
                        }}
                        className={`text-left px-2 py-1 rounded text-xs flex items-center justify-between transition-colors ${
                          selected
                            ? "bg-uec-red/20 border border-uec-red text-white"
                            : "bg-[#172033] text-slate-400 hover:text-white"
                        }`}
                      >
                        <span className="truncate">{m.full_name}</span>
                        {selected && <Check size={11} className="text-uec-red" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#1F2937]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isPending} className="bg-uec-red hover:bg-uec-red/90 text-white">
                  {isPending ? "Création en cours..." : "Créer la Tâche"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Déposer un Livrable */}
      {submittingTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-[#0e0e12] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl shadow-black/90 relative">
            <button
              onClick={() => setSubmittingTaskId(null)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-uec-blue"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>

            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Upload size={18} className="text-uec-blue" />
              <span>Soumettre un Livrable pour Validation</span>
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Ce livrable sera transmis au Coordinateur de Pôle pour revue technique avant transmission finale au Super Admin.
            </p>

            <form onSubmit={handleSubmitDeliverable} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Titre du livrable *
                </label>
                <Input
                  placeholder="Ex: Maquette V1 Affiche 1080x1350 & Export PNG"
                  value={deliverableForm.title}
                  onChange={(e) => setDeliverableForm({ ...deliverableForm, title: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Notes / Description pour les réviseurs *
                </label>
                <textarea
                  placeholder="Précisez les choix graphiques, versions des logiciels utilisées, etc..."
                  value={deliverableForm.description}
                  onChange={(e) => setDeliverableForm({ ...deliverableForm, description: e.target.value })}
                  className="w-full bg-[#172033] border border-[#27354F] text-white text-xs rounded-lg p-3 min-h-[80px] resize-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Liens vers les fichiers (Google Drive, Figma, WeTransfer...)
                </label>
                <textarea
                  placeholder="Un lien par ligne (https://...)"
                  value={deliverableForm.fileUrlsText}
                  onChange={(e) => setDeliverableForm({ ...deliverableForm, fileUrlsText: e.target.value })}
                  className="w-full bg-[#172033] border border-[#27354F] text-white text-xs rounded-lg p-3 min-h-[70px] resize-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#1F2937]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSubmittingTaskId(null)}
                >
                  Annuler
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isPending} className="bg-uec-blue hover:bg-uec-blue/90 text-white">
                  {isPending ? "Transmission..." : "Envoyer pour Revue"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      <TaskDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        task={selectedTask}
        userRole={userRole}
        currentUserId={currentUserId}
        isPending={isPending}
        onStartTask={handleStartTask}
        onSubmitDeliverable={handleOpenSubmitDeliverable}
        onEditTask={openEdit}
        onDeleteTask={handleDeleteTask}
      />

      {/* Task Edit Modal */}
      <TaskEditModal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditingTask(null);
        }}
        task={editingTask}
        projects={projects}
        members={members}
        onSuccess={(updatedTask) => {
          setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
          if (selectedTask?.id === updatedTask.id) {
            setSelectedTask(updatedTask);
          }
          setFeedback({ type: "success", message: "Tâche mise à jour avec succès." });
          setTimeout(() => setFeedback(null), 3000);
        }}
      />
    </div>
  );
}
