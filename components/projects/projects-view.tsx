"use client";

import React, { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
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
  Edit2,
  Trash2,
} from "lucide-react";
import type { ProjectListItem, ProjectStatus, ProjectPriority } from "@/lib/data/projects";
import type { DepartmentWithStats } from "@/lib/data/departments";
import type { MemberListItem } from "@/lib/data/members";
import type { UserRole } from "@/lib/auth/rbac";
import { deleteProjectAction } from "@/app/actions/projects";
import { ProjectModal } from "./project-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

interface ProjectsViewProps {
  projects: ProjectListItem[];
  departments: DepartmentWithStats[];
  members: MemberListItem[];
  userRole: UserRole;
  currentUserId: string;
}

export function ProjectsView({
  projects: initialProjects,
  departments,
  members,
  userRole,
  currentUserId,
}: ProjectsViewProps) {
  const { showToast } = useToast();
  const [projects, setProjects] = useState<ProjectListItem[]>(initialProjects);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectListItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const canCreate = userRole === "SUPER_ADMIN" || userRole === "COORDINATOR";
  const canManage = userRole === "SUPER_ADMIN" || userRole === "COORDINATOR";

  const handleOpenCreate = () => {
    setSelectedProject(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (project: ProjectListItem) => {
    setSelectedProject(project);
    setIsModalOpen(true);
  };

  const handleConfirmDeleteProject = () => {
    if (!deleteTarget) return;

    startTransition(async () => {
      try {
        const res = await deleteProjectAction(deleteTarget.id);
        if (res.success) {
          setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
          showToast(res.message, "success");
          setDeleteTarget(null);
        } else {
          showToast(res.message, "error");
        }
      } catch (err: any) {
        showToast(err?.message || "Erreur de suppression du projet", "error");
      }
    });
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
            <span>Projets Digitaux & Campagnes</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gouvernance et suivi de production : de la phase de cadrage à l'archivage définitif ({projects.length} projets répertoriés).
          </p>
        </div>

        {canCreate && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreate}
            className="bg-uec-red hover:bg-uec-red/90 text-white"
          >
            <Plus size={15} className="mr-1.5" />
            Nouveau Projet
          </Button>
        )}
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2 animate-in fade-in ${
            feedback.type === "error"
              ? "bg-rose-500/10 border border-rose-500/30 text-rose-400"
              : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
          }`}
        >
          {feedback.type === "error" ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 rtl:left-auto rtl:right-3.5" />
          <Input
            placeholder="Rechercher par titre, code ou description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 rtl:pl-3 rtl:pr-9"
          />
        </div>

        {/* Status filters */}
        <div className="flex items-center gap-1.5 bg-[#111827] border border-[#1F2937] p-1 rounded-lg overflow-x-auto">
          {["ALL", "PLANNING", "ACTIVE", "IN_REVIEW", "COMPLETED", "ON_HOLD"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${
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
        <EmptyState
          icon={FolderKanban}
          title="Aucun projet trouvé"
          description="Aucun projet ne correspond aux filtres sélectionnés ou la base de données ne contient pas encore de projets."
          action={
            canCreate
              ? {
                  label: "Créer le premier projet",
                  onClick: handleOpenCreate,
                  icon: Plus,
                  variant: "outline",
                }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((proj) => (
            <Card key={proj.id} className="hover:border-slate-700 transition-all flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between w-full">
                  <div className="flex items-center gap-2 flex-wrap">
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

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-uec-cyan font-medium">
                      {proj.department_name}
                    </span>
                    {canManage && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(proj)}
                          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                          title="Modifier le projet"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(proj)}
                          disabled={isPending}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded transition-colors"
                          title="Supprimer le projet"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <CardTitle className="text-base text-white mt-2.5">{proj.title}</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="text-xs text-slate-300 line-clamp-2">
                  {proj.description || "Aucune description fournie pour ce projet."}
                </p>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Avancement</span>
                    <span className="text-white font-mono font-semibold">{proj.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-[#27354F]">
                    <div
                      className="bg-uec-red h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, proj.progress))}%` }}
                    />
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1F2937] text-xs">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <CheckSquare size={13} className="text-uec-cyan" />
                    <span>
                      Tâches:{" "}
                      <strong className="text-white">
                        {proj.completed_task_count}/{proj.task_count}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Users size={13} className="text-uec-blue" />
                    <span>
                      Membres: <strong className="text-white">{proj.member_count}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#1F2937] text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {proj.deadline
                      ? `Échéance: ${new Date(proj.deadline).toLocaleDateString("fr-FR")}`
                      : "Pas d'échéance fixée"}
                  </span>

                  {canManage && (
                    <button
                      onClick={() => handleOpenEdit(proj)}
                      className="text-uec-cyan hover:underline flex items-center gap-1 font-semibold text-xs"
                    >
                      <Sliders size={12} />
                      <span>Gérer</span>
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Project Creation / Edit Modal */}
      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        project={selectedProject}
        departments={departments}
        members={members}
        currentUserId={currentUserId}
        onSuccess={(saved) => {
          if (selectedProject) {
            setProjects((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
            setFeedback({ type: "success", message: "Projet mis à jour avec succès." });
          } else {
            setProjects((prev) => [saved, ...prev]);
            setFeedback({ type: "success", message: "Nouveau projet créé avec succès." });
          }
          setTimeout(() => setFeedback(null), 3000);
        }}
      />
      {/* Confirm Delete Project Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDeleteProject}
        title="Supprimer définitivement le projet ?"
        description={`Êtes-vous certain de vouloir supprimer le projet "${deleteTarget?.title}" (${deleteTarget?.code}) ? Cette action est irréversible et supprimera l'ensemble des dépendances associées.`}
        confirmLabel="Supprimer le projet"
        cancelLabel="Conserver"
        variant="danger"
        isLoading={isPending}
      />
    </div>
  );
}
