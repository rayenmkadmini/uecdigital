"use client";

import React from "react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckSquare,
  Building2,
  FolderKanban,
  Clock,
  User,
  Users,
  Play,
  Upload,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";
import type { TaskListItem, TaskStatus } from "@/lib/data/tasks";
import type { UserRole } from "@/lib/auth/rbac";

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskListItem | null;
  userRole: UserRole;
  currentUserId: string;
  isPending: boolean;
  onStartTask: (taskId: string) => void;
  onSubmitDeliverable: (taskId: string) => void;
  onEditTask: (task: TaskListItem) => void;
  onDeleteTask: (taskId: string) => void;
}

export function TaskDetailModal({
  isOpen,
  onClose,
  task,
  userRole,
  currentUserId,
  isPending,
  onStartTask,
  onSubmitDeliverable,
  onEditTask,
  onDeleteTask,
}: TaskDetailModalProps) {
  if (!task) return null;

  const isAssigned = task.assignees.some((a) => a.user_id === currentUserId);
  const canManage = userRole === "SUPER_ADMIN" || userRole === "COORDINATOR";
  const canStart = (isAssigned || canManage) && task.status === "TODO";
  const canSubmit = (isAssigned || canManage) && task.status !== "APPROVED" && task.status !== "DONE";

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <CheckSquare size={18} className="text-uec-red" />
          <span>Détails de la Tâche</span>
        </div>
      }
      description={task.title}
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* Status and priority bar */}
        <div className="flex flex-wrap items-center gap-2">
          {getStatusBadge(task.status)}
          <Badge
            variant={
              task.priority === "CRITICAL" || task.priority === "HIGH" ? "red" : "default"
            }
            size="sm"
          >
            Priorité: {task.priority}
          </Badge>
          <span className="text-xs text-slate-400 font-mono">
            ID: {task.id.slice(0, 8)}...
          </span>
        </div>

        {/* Task description */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-slate-300">Description</h4>
          <div className="p-3.5 rounded-lg bg-[#111827] border border-[#27354F] text-slate-200 text-xs whitespace-pre-wrap leading-relaxed">
            {task.description || "Aucune description fournie pour cette tâche."}
          </div>
        </div>

        {/* Acceptance criteria if any */}
        {task.acceptance_criteria && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <FileText size={13} className="text-uec-cyan" />
              <span>Critères d'acceptation & Spécifications attendues</span>
            </h4>
            <div className="p-3.5 rounded-lg bg-[#172033] border border-[#27354F] text-slate-200 text-xs whitespace-pre-wrap leading-relaxed">
              {task.acceptance_criteria}
            </div>
          </div>
        )}

        {/* Department & Project info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-[#111827] border border-[#27354F] space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Building2 size={13} className="text-uec-cyan" />
              <span>Pôle d'exécution :</span>
              <strong className="text-white">{task.department_name}</strong>
            </div>
            {task.project_title && (
              <div className="flex items-center gap-1.5 text-slate-400">
                <FolderKanban size={13} className="text-uec-red" />
                <span>Projet rattaché :</span>
                <span className="text-slate-200">{task.project_title}</span>
              </div>
            )}
          </div>

          <div className="p-3 rounded-lg bg-[#111827] border border-[#27354F] space-y-1.5 text-slate-400">
            <div className="flex items-center gap-1.5">
              <Clock size={13} />
              <span>
                {task.deadline
                  ? `Échéance finale : ${new Date(task.deadline).toLocaleDateString("fr-FR")}`
                  : "Pas d'échéance fixée"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span>Créée le {new Date(task.created_at).toLocaleDateString("fr-FR")}</span>
            </div>
          </div>
        </div>

        {/* Assignees */}
        <div className="p-3.5 rounded-lg bg-[#111827] border border-[#27354F] space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <Users size={14} className="text-uec-blue" />
            <span>Membres assignés ({task.assignees.length})</span>
          </div>

          {task.assignees.length === 0 ? (
            <p className="text-xs text-slate-500 italic">Aucun membre n'est actuellement assigné à cette tâche.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {task.assignees.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#172033] border border-[#27354F] text-xs text-white"
                >
                  <User size={12} className="text-slate-400" />
                  <span>{a.full_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#1F2937]">
          <div>
            {canManage && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => {
                  if (confirm(`Confirmez-vous la suppression de la tâche "${task.title}" ?`)) {
                    onDeleteTask(task.id);
                  }
                }}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/30"
              >
                <Trash2 size={14} className="mr-1" />
                Supprimer
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canStart && (
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => onStartTask(task.id)}
                className="border-emerald-600/40 text-emerald-400 hover:bg-emerald-950/30"
              >
                <Play size={13} className="mr-1 fill-emerald-400" />
                Démarrer la tâche
              </Button>
            )}

            {canSubmit && (
              <Button
                variant="primary"
                size="sm"
                disabled={isPending}
                onClick={() => {
                  onClose();
                  onSubmitDeliverable(task.id);
                }}
                className="bg-uec-blue hover:bg-uec-blue/90 text-white"
              >
                <Upload size={13} className="mr-1" />
                Déposer un Livrable
              </Button>
            )}

            {canManage && (
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => {
                  onClose();
                  onEditTask(task);
                }}
                className="text-slate-300 hover:text-white"
              >
                <Edit2 size={13} className="mr-1" />
                Modifier
              </Button>
            )}

            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
