"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FolderKanban,
  Plus,
  Clock,
  Search,
  Users,
  CheckSquare,
  AlertCircle,
  CheckCircle2,
  X,
  Sliders,
  Calendar,
  Building2,
} from "lucide-react";
import type { ProjectListItem, ProjectStatus, ProjectPriority } from "@/lib/data/projects";
import type { DepartmentWithStats } from "@/lib/data/departments";
import type { MemberListItem } from "@/lib/data/members";
import type { UserRole } from "@/lib/auth/rbac";
import { createProjectAction, updateProjectAction } from "@/app/actions/projects";

interface ProjectsViewProps {
  projects: ProjectListItem[];
  departments: DepartmentWithStats[];
  members: MemberListItem[];
  userRole: UserRole;
  currentUserId: string;
}

export function ProjectsView({
  projects,
  departments,
  members,
  userRole,
  currentUserId,
}: ProjectsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // New Project Form Data
  const [formData, setFormData] = useState({
    code: "",
    title: "",
    description: "",
    department_id: departments[0]?.id || "",
    manager_id: currentUserId || "",
    priority: "MEDIUM" as ProjectPriority,
    status: "PLANNING" as ProjectStatus,
    start_date: "",
    deadline: "",
  });

  // Edit progress/status modal
  const [editingProject, setEditingProject] = useState<ProjectListItem | null>(null);
  const [editStatus, setEditStatus] = useState<ProjectStatus>("ACTIVE");
  const [editProgress, setEditProgress] = useState<number>(0);

  const canCreate = userRole === "SUPER_ADMIN" || userRole === "COORDINATOR";

  const handleOpenCreate = () => {
    setFormData({
      code: "",
      title: "",
      description: "",
      department_id: departments[0]?.id || "",
      manager_id: currentUserId || "",
      priority: "MEDIUM",
      status: "PLANNING",
      start_date: new Date().toISOString().split("T")[0],
      deadline: "",
    });
    setFieldErrors({});
    setFeedback(null);
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFieldErrors({});
    setFeedback(null);

    try {
      const res = await createProjectAction({
        code: formData.code.toUpperCase().trim(),
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        department_id: formData.department_id,
        manager_id: formData.manager_id || undefined,
        priority: formData.priority,
        status: formData.status,
        start_date: formData.start_date || undefined,
        deadline: formData.deadline || undefined,
      });

      if (res.success) {
        setFeedback({ type: "success", message: res.message });
        setTimeout(() => {
          setIsCreateOpen(false);
        }, 1200);
      } else {
        setFeedback({ type: "error", message: res.message });
        if (res.errors) {
          setFieldErrors(res.errors);
        }
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Erreur de création" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (project: ProjectListItem) => {
    setEditingProject(project);
    setEditStatus(project.status);
    setEditProgress(project.progress);
    setFeedback(null);
  };

  const handleUpdateProject = async () => {
    if (!editingProject) return;
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await updateProjectAction(editingProject.id, {
        status: editStatus,
        progress: editProgress,
      });

      if (res.success) {
        setFeedback({ type: "success", message: res.message });
        editingProject.status = editStatus;
        editingProject.progress = editProgress;
        setTimeout(() => {
          setEditingProject(null);
        }, 800);
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Erreur de mise à jour" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = projects.filter((p) => {
    const s = searchTerm.toLowerCase().trim();
    const matchSearch =
      !s ||
      p.title.toLowerCase().includes(s) ||
      p.code.toLowerCase().includes(s) ||
      (p.description && p.description.toLowerCase().includes(s)) ||
      p.department_name.toLowerCase().includes(s);

    const matchStatus = statusFilter === "ALL" || p.status === statusFilter;
    const matchDept = deptFilter === "ALL" || p.department_id === deptFilter;

    return matchSearch && matchStatus && matchDept;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FolderKanban size={24} className="text-uec-red" />
            <span>Gestion des Projets Numériques</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gouvernance opérationnelle des projets transversaux et départementaux ({projects.length} projets au total).
          </p>
        </div>

        {canCreate && (
          <Button variant="primary" size="sm" onClick={handleOpenCreate}>
            <Plus size={15} className="mr-1.5" />
            Nouveau Projet
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher par code, titre ou pôle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status filters */}
        <div className="flex items-center gap-1.5 bg-[#111827] border border-[#1F2937] p-1 rounded-lg overflow-x-auto">
          {["ALL", "PLANNING", "ACTIVE", "IN_REVIEW", "COMPLETED", "ON_HOLD"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                statusFilter === st ? "bg-uec-red text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {st === "ALL" ? "Tous" : st}
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
      </div>

      {/* Projects Grid */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-slate-400 space-y-3">
          <FolderKanban size={40} className="mx-auto text-slate-600" />
          <h3 className="text-base font-bold text-white">Aucun projet trouvé</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Aucun projet ne correspond aux filtres sélectionnés ou la base de données ne contient pas encore de projets.
          </p>
          {canCreate && (
            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={handleOpenCreate}>
                <Plus size={14} className="mr-1" />
                Créer le premier projet
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((proj) => (
            <Card key={proj.id} className="hover:border-slate-700 transition-all flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Badge
                      style={{
                        backgroundColor: `${proj.department_color}20`,
                        borderColor: `${proj.department_color}60`,
                        color: proj.department_color,
                      }}
                      size="sm"
                    >
                      {proj.code}
                    </Badge>
                    <Badge
                      variant={
                        proj.status === "ACTIVE"
                          ? "approved"
                          : proj.status === "COMPLETED"
                          ? "default"
                          : proj.status === "IN_REVIEW"
                          ? "review"
                          : "default"
                      }
                      size="sm"
                    >
                      {proj.status}
                    </Badge>
                    {proj.priority === "CRITICAL" || proj.priority === "HIGH" ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-semibold border border-red-500/30">
                        {proj.priority}
                      </span>
                    ) : null}
                  </div>

                  <span className="text-[11px] text-uec-cyan font-medium">
                    {proj.department_name}
                  </span>
                </div>
                <CardTitle className="text-base text-white mt-2.5">{proj.title}</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="text-xs text-slate-300 line-clamp-2">
                  {proj.description || "Aucune description fournie pour ce projet."}
                </p>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Progression globale</span>
                    <span className="font-bold text-white">{proj.progress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-uec-blue to-uec-red rounded-full transition-all duration-300"
                      style={{ width: `${proj.progress}%` }}
                    />
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-[#172033] border border-[#27354F] text-xs">
                  <div className="flex flex-col items-center text-center">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Users size={11} className="text-uec-blue" /> Membres
                    </span>
                    <span className="font-bold text-white mt-0.5">{proj.member_count}</span>
                  </div>
                  <div className="flex flex-col items-center text-center border-x border-[#27354F]">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <CheckSquare size={11} className="text-uec-cyan" /> Tâches
                    </span>
                    <span className="font-bold text-white mt-0.5">
                      {proj.completed_task_count}/{proj.task_count}
                    </span>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <span className="text-[10px] text-slate-400">Responsable</span>
                    <span className="font-semibold text-white mt-0.5 truncate max-w-[90px] text-[11px]">
                      {proj.manager_name}
                    </span>
                  </div>
                </div>

                {/* Footer dates & edit */}
                <div className="pt-2 border-t border-[#1F2937] flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1 text-[11px]">
                    <Clock size={12} />
                    {proj.deadline
                      ? `Échéance: ${new Date(proj.deadline).toLocaleDateString("fr-FR")}`
                      : "Pas d'échéance fixée"}
                  </span>

                  {(userRole === "SUPER_ADMIN" || userRole === "COORDINATOR") && (
                    <button
                      onClick={() => handleOpenEdit(proj)}
                      className="text-uec-cyan hover:underline flex items-center gap-1 font-semibold text-xs"
                    >
                      <Sliders size={12} />
                      <span>Statut</span>
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* MODAL: Nouveau Projet */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111827] border border-[#27354F] rounded-xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
              <FolderKanban size={20} className="text-uec-red" />
              <span>Nouveau Projet Digital</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Création d'un projet opérationnel rattaché à un pôle de compétences.
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Code Unique *
                  </label>
                  <Input
                    placeholder="EX: DERBY-26"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    required
                  />
                  {fieldErrors.code && (
                    <p className="text-[11px] text-red-400 mt-1">{fieldErrors.code[0]}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Pôle Responsable *
                  </label>
                  <select
                    value={formData.department_id}
                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
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
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Titre du Projet *
                </label>
                <Input
                  placeholder="Ex: Campagne Visuelle Derby Retour 2026"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
                {fieldErrors.title && (
                  <p className="text-[11px] text-red-400 mt-1">{fieldErrors.title[0]}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Description & Objectifs
                </label>
                <textarea
                  placeholder="Détails, livrables attendus, cibles..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-[#172033] border border-[#27354F] text-white text-xs rounded-lg p-2.5 h-20 resize-none focus:outline-none focus:border-uec-red"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Priorité
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as ProjectPriority })}
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
                    Chef de Projet / Manager
                  </label>
                  <select
                    value={formData.manager_id}
                    onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
                    className="w-full bg-[#172033] border border-[#27354F] text-white text-xs rounded-lg p-2.5"
                  >
                    <option value="">Sélectionner un responsable...</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Date de début
                  </label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Date limite (Deadline)
                  </label>
                  <Input
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  />
                </div>
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
                <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? "Création en cours..." : "Créer le Projet"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Quick Update Status / Progress */}
      {editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111827] border border-[#27354F] rounded-xl max-w-sm w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setEditingProject(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <h3 className="text-base font-bold text-white mb-1">Mettre à jour le projet</h3>
            <p className="text-xs text-slate-400 mb-4">{editingProject.title}</p>

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

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Statut du Projet
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as ProjectStatus)}
                  className="w-full bg-[#172033] border border-[#27354F] text-white text-xs rounded-lg p-2.5"
                >
                  <option value="PLANNING">PLANNING</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="IN_REVIEW">IN_REVIEW</option>
                  <option value="ON_HOLD">ON_HOLD</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-semibold text-slate-300">Progression</span>
                  <span className="font-bold text-white">{editProgress}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={editProgress}
                  onChange={(e) => setEditProgress(Number(e.target.value))}
                  className="w-full accent-uec-red cursor-pointer"
                />
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#1F2937] flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingProject(null)}
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={isSubmitting}
                onClick={handleUpdateProject}
              >
                {isSubmitting ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
