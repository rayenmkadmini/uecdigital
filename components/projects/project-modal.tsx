"use client";

import React, { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, Check, AlertCircle, Loader2, Users, UserPlus, UserMinus, Trash2 } from "lucide-react";
import {
  createProjectAction,
  updateProjectAction,
  assignProjectMemberAction,
  removeProjectMemberAction,
} from "@/app/actions/projects";
import type { ProjectListItem, ProjectStatus, ProjectPriority } from "@/lib/data/projects";
import type { DepartmentWithStats } from "@/lib/data/departments";
import type { MemberListItem } from "@/lib/data/members";

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project?: ProjectListItem | null;
  departments: DepartmentWithStats[];
  members: MemberListItem[];
  currentUserId: string;
  onSuccess: (savedProject: ProjectListItem) => void;
}

export function ProjectModal({
  isOpen,
  onClose,
  project,
  departments,
  members,
  currentUserId,
  onSuccess,
}: ProjectModalProps) {
  const isEditing = Boolean(project);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [code, setCode] = useState(project?.code || "");
  const [title, setTitle] = useState(project?.title || "");
  const [description, setDescription] = useState(project?.description || "");
  const [departmentId, setDepartmentId] = useState(project?.department_id || departments[0]?.id || "");
  const [managerId, setManagerId] = useState(project?.manager_id || currentUserId || "");
  const [priority, setPriority] = useState<ProjectPriority>(project?.priority || "MEDIUM");
  const [status, setStatus] = useState<ProjectStatus>(project?.status || "PLANNING");
  const [progress, setProgress] = useState<number>(project?.progress ?? 0);
  const [startDate, setStartDate] = useState(
    project?.start_date ? new Date(project.start_date).toISOString().split("T")[0] : ""
  );
  const [deadline, setDeadline] = useState(
    project?.deadline ? new Date(project.deadline).toISOString().split("T")[0] : ""
  );

  React.useEffect(() => {
    if (project) {
      setCode(project.code);
      setTitle(project.title);
      setDescription(project.description || "");
      setDepartmentId(project.department_id);
      setManagerId(project.manager_id || currentUserId || "");
      setPriority(project.priority);
      setStatus(project.status);
      setProgress(project.progress ?? 0);
      setStartDate(project.start_date ? new Date(project.start_date).toISOString().split("T")[0] : "");
      setDeadline(project.deadline ? new Date(project.deadline).toISOString().split("T")[0] : "");
    } else {
      setCode("");
      setTitle("");
      setDescription("");
      setDepartmentId(departments[0]?.id || "");
      setManagerId(currentUserId || "");
      setPriority("MEDIUM");
      setStatus("PLANNING");
      setProgress(0);
      setStartDate(new Date().toISOString().split("T")[0]);
      setDeadline("");
    }
    setErrorMsg(null);
  }, [project, isOpen, departments, currentUserId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    startTransition(async () => {
      try {
        const dept = departments.find((d) => d.id === departmentId);
        const manager = members.find((m) => m.id === managerId);

        if (isEditing && project) {
          const res = await updateProjectAction(project.id, {
            title: title.trim(),
            description: description.trim() || undefined,
            department_id: departmentId,
            manager_id: managerId || undefined,
            priority,
            status,
            progress: Number(progress),
            start_date: startDate || undefined,
            deadline: deadline || undefined,
          });

          if (!res.success) {
            setErrorMsg(res.message);
            return;
          }

          const updated: ProjectListItem = {
            ...project,
            title: title.trim(),
            description: description.trim() || null,
            department_id: departmentId,
            department_name: dept?.name || project.department_name,
            department_code: dept?.code || project.department_code,
            department_color: dept?.color || project.department_color,
            manager_id: managerId || null,
            manager_name: manager?.full_name || project.manager_name,
            priority,
            status,
            progress: Number(progress),
            start_date: startDate || null,
            deadline: deadline || null,
            updated_at: new Date().toISOString(),
          };

          onSuccess(updated);
          onClose();
        } else {
          const res = await createProjectAction({
            code: code.toUpperCase().trim(),
            title: title.trim(),
            description: description.trim() || undefined,
            department_id: departmentId,
            manager_id: managerId || undefined,
            priority,
            status,
            start_date: startDate || undefined,
            deadline: deadline || undefined,
          });

          if (!res.success) {
            setErrorMsg(res.message);
            return;
          }

          const created: ProjectListItem = {
            id: res.data.id,
            code: code.toUpperCase().trim(),
            title: title.trim(),
            description: description.trim() || null,
            department_id: departmentId,
            department_name: dept?.name || "Pôle",
            department_code: dept?.code || "UEC",
            department_color: dept?.color || "#E01E26",
            manager_id: managerId || null,
            manager_name: manager?.full_name || "Moi",
            priority,
            status,
            progress: 0,
            start_date: startDate || null,
            deadline: deadline || null,
            created_by: null,
            task_count: 0,
            completed_task_count: 0,
            member_count: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          onSuccess(created);
          onClose();
        }
      } catch (err: any) {
        setErrorMsg(err?.message || "Une erreur inattendue est survenue.");
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <FolderKanban size={18} className="text-uec-red" />
          <span>{isEditing ? `Modifier le Projet ${project?.code}` : "Nouveau Projet Digital"}</span>
        </div>
      }
      description={
        isEditing
          ? `Mise à jour des paramètres opérationnels et du calendrier pour "${project?.title}".`
          : "Création d'un projet de production rattaché à un pôle de compétences."
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Code Unique (Majuscules) *
            </label>
            <Input
              required
              disabled={isEditing}
              placeholder="Ex: DERBY-26"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className={`font-mono ${isEditing ? "opacity-60 cursor-not-allowed" : ""}`}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Pôle Responsable *
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full bg-[#111827] border border-[#27354F] text-white text-xs rounded-lg p-2.5 focus:border-uec-red focus:outline-none"
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
            Intitulé Officiel du Projet *
          </label>
          <Input
            required
            placeholder="Ex: Campagne Visuelle & Couverture Derby Capitale"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1">
            Description des Objectifs
          </label>
          <textarea
            rows={3}
            placeholder="Objectifs, formats des livrables et axes stratégiques..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-[#111827] border border-[#27354F] text-white text-xs rounded-lg p-2.5 focus:border-uec-red focus:outline-none resize-none leading-relaxed"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Responsable de Projet
            </label>
            <select
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              className="w-full bg-[#111827] border border-[#27354F] text-white text-xs rounded-lg p-2.5 focus:border-uec-red focus:outline-none"
            >
              <option value="">-- Aucun responsable --</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} ({m.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Priorité
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as ProjectPriority)}
              className="w-full bg-[#111827] border border-[#27354F] text-white text-xs rounded-lg p-2.5 focus:border-uec-red focus:outline-none"
            >
              <option value="LOW">Faible (LOW)</option>
              <option value="MEDIUM">Normale (MEDIUM)</option>
              <option value="HIGH">Haute (HIGH)</option>
              <option value="CRITICAL">Critique (CRITICAL)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Statut
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              className="w-full bg-[#111827] border border-[#27354F] text-white text-xs rounded-lg p-2.5 focus:border-uec-red focus:outline-none"
            >
              <option value="PLANNING">Planification (PLANNING)</option>
              <option value="ACTIVE">Actif en Production (ACTIVE)</option>
              <option value="IN_REVIEW">En Revue (IN_REVIEW)</option>
              <option value="ON_HOLD">En Pause (ON_HOLD)</option>
              <option value="COMPLETED">Achevé (COMPLETED)</option>
              <option value="CANCELLED">Annulé (CANCELLED)</option>
            </select>
          </div>
        </div>

        {isEditing && (
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <label className="font-semibold text-slate-300">Progression globale</label>
              <span className="font-mono text-uec-cyan font-bold">{progress}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full accent-uec-red cursor-pointer"
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Date de début
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Date limite (Échéance)
            </label>
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1F2937]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isPending}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isPending}
            className="flex items-center gap-1.5 bg-uec-red hover:bg-uec-red/90 text-white"
          >
            {isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Enregistrement...</span>
              </>
            ) : (
              <>
                <Check size={14} />
                <span>{isEditing ? "Enregistrer" : "Créer le projet"}</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
