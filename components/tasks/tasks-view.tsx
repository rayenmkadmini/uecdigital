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
} from "lucide-react";
import type { TaskListItem, TaskStatus, TaskPriority } from "@/lib/data/tasks";
import type { ProjectListItem } from "@/lib/data/projects";
import type { DepartmentWithStats } from "@/lib/data/departments";
import type { MemberListItem } from "@/lib/data/members";
import type { UserRole } from "@/lib/auth/rbac";
import { createTaskAction, updateTaskStatusAction, submitDeliverableAction } from "@/app/actions/tasks";

interface TasksViewProps {
  tasks: TaskListItem[];
  projects: ProjectListItem[];
  departments: DepartmentWithStats[];
  members: MemberListItem[];
  userRole: UserRole;
  currentUserId: string;
}

export function TasksView({
  tasks,
  projects,
  departments,
  members,
  userRole,
  currentUserId,
}: TasksViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [projectFilter, setProjectFilter] = useState<string>("ALL");

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
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
        setTimeout(() => setIsCreateOpen(false), 1000);
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
        setTimeout(() => setSubmittingTaskId(null), 1200);
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
      if (!res.success) {
        alert(res.message);
      }
    } catch (err: any) {
      alert(err.message || "Erreur lors du démarrage");
    } finally {
      setIsPending(false);
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
          <Button variant="primary" size="sm" onClick={handleOpenCreate}>
            <Plus size={15} className="mr-1.5" />
            Nouvelle Tâche
          </Button>
        )}
      </div>

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
              {st === "ALL" ? "Toutes" : st.replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Department filter */}
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="bg-[#111827] border border-[#1F2937] text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-uec-red"
        >
          <option value="ALL">Tous les pôles</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.code})
            </option>
          ))}
        </select>

        {/* Project filter */}
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="bg-[#111827] border border-[#1F2937] text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-uec-red"
        >
          <option value="ALL">Tous les projets</option>
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
                const canStart = (isAssigned || userRole === "SUPER_ADMIN" || userRole === "COORDINATOR") && task.status === "TODO";
                const canSubmit = isAssigned || userRole === "SUPER_ADMIN" || userRole === "COORDINATOR";

                return (
                  <div
                    key={task.id}
                    className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-900/40 transition-colors"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white">{task.title}</span>
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
                      {canStart && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs flex items-center gap-1"
                          disabled={isPending}
                          onClick={() => handleStartTask(task.id)}
                        >
                          <Play size={12} className="text-emerald-400 fill-emerald-400" />
                          <span>Démarrer</span>
                        </Button>
                      )}

                      {canSubmit && task.status !== "APPROVED" && (
                        <Button
                          variant="primary"
                          size="sm"
                          className="text-xs flex items-center gap-1"
                          onClick={() => handleOpenSubmitDeliverable(task.id)}
                        >
                          <Upload size={12} />
                          <span>Déposer Livrable</span>
                        </Button>
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

            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
              <CheckSquare size={20} className="text-uec-red" />
              <span>Créer une Nouvelle Tâche</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Déléguer un livrable ou un travail à réaliser au sein d'un pôle de compétences.
            </p>

            {feedback && (
              <div
                className={`mb-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
                  feedback.type === "success"
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                    : "bg-red-500/10 border border-red-500/30 text-red-400"
                }`}
              >
                {feedback.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                <span>{feedback.message}</span>
              </div>
            )}

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
                    Date Limite (Deadline)
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
                  Assigner des Membres
                </label>
                <div className="max-h-28 overflow-y-auto bg-[#172033] border border-[#27354F] rounded-lg p-2 space-y-1">
                  {members.map((m) => {
                    const isSelected = createForm.assignee_ids.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer p-1 rounded hover:bg-[#1f2d48]"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCreateForm({
                                ...createForm,
                                assignee_ids: [...createForm.assignee_ids, m.id],
                              });
                            } else {
                              setCreateForm({
                                ...createForm,
                                assignee_ids: createForm.assignee_ids.filter((id) => id !== m.id),
                              });
                            }
                          }}
                          className="accent-uec-red"
                        />
                        <span>{m.full_name}</span>
                        <span className="text-[10px] text-slate-400">({m.role})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Description de la Tâche
                </label>
                <textarea
                  placeholder="Instructions précises, contexte..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full bg-[#172033] border border-[#27354F] text-white text-xs rounded-lg p-2.5 h-16 resize-none focus:outline-none focus:border-uec-red"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Critères d'Acceptation
                </label>
                <textarea
                  placeholder="Exigences techniques, dimensions, format, résolution attendue..."
                  value={createForm.acceptance_criteria}
                  onChange={(e) => setCreateForm({ ...createForm, acceptance_criteria: e.target.value })}
                  className="w-full bg-[#172033] border border-[#27354F] text-white text-xs rounded-lg p-2.5 h-16 resize-none focus:outline-none focus:border-uec-red"
                />
              </div>

              <div className="mt-6 pt-4 border-t border-[#1F2937] flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isPending}>
                  {isPending ? "Création..." : "Créer la Tâche"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Déposer un Livrable */}
      {submittingTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-[#0e0e12] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl shadow-black/90 relative">
            <button
              onClick={() => setSubmittingTaskId(null)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-uec-blue"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
              <Upload size={20} className="text-uec-red" />
              <span>Dépôt de Livrable pour Revue</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Votre travail sera soumis au Coordinateur pour vérification de conformité avant envoi au Super Admin.
            </p>

            {feedback && (
              <div
                className={`mb-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
                  feedback.type === "success"
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                    : "bg-red-500/10 border border-red-500/30 text-red-400"
                }`}
              >
                {feedback.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                <span>{feedback.message}</span>
              </div>
            )}

            <form onSubmit={handleSubmitDeliverable} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Titre du Livrable *
                </label>
                <Input
                  placeholder="Ex: Affiche officielle format vertical 4K"
                  value={deliverableForm.title}
                  onChange={(e) => setDeliverableForm({ ...deliverableForm, title: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Note explicative / Description des travaux *
                </label>
                <textarea
                  placeholder="Expliquez ce qui a été réalisé, les choix graphiques ou techniques..."
                  value={deliverableForm.description}
                  onChange={(e) => setDeliverableForm({ ...deliverableForm, description: e.target.value })}
                  className="w-full bg-[#172033] border border-[#27354F] text-white text-xs rounded-lg p-2.5 h-20 resize-none focus:outline-none focus:border-uec-red"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Liens des fichiers / Assets (un lien par ligne)
                </label>
                <textarea
                  placeholder="https://drive.google.com/...&#10;https://figma.com/...&#10;https://github.com/..."
                  value={deliverableForm.fileUrlsText}
                  onChange={(e) => setDeliverableForm({ ...deliverableForm, fileUrlsText: e.target.value })}
                  className="w-full bg-[#172033] border border-[#27354F] text-white text-xs rounded-lg p-2.5 h-20 resize-none focus:outline-none focus:border-uec-red font-mono text-[11px]"
                />
              </div>

              <div className="mt-6 pt-4 border-t border-[#1F2937] flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSubmittingTaskId(null)}
                >
                  Annuler
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isPending}>
                  {isPending ? "Transmission..." : "Soumettre pour Revue"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
