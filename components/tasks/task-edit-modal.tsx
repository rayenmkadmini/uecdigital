"use client";

import React, { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, AlertCircle, Loader2, Edit2 } from "lucide-react";
import { updateTaskAction, assignTaskMembersAction } from "@/app/actions/tasks";
import type { TaskListItem, TaskPriority } from "@/lib/data/tasks";
import type { ProjectListItem } from "@/lib/data/projects";
import type { MemberListItem } from "@/lib/data/members";

interface TaskEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskListItem | null;
  projects: ProjectListItem[];
  members: MemberListItem[];
  onSuccess: (updatedTask: TaskListItem) => void;
}

export function TaskEditModal({
  isOpen,
  onClose,
  task,
  projects,
  members,
  onSuccess,
}: TaskEditModalProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(task?.acceptance_criteria || "");
  const [projectId, setProjectId] = useState(task?.project_id || "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority || "MEDIUM");
  const [deadline, setDeadline] = useState(
    task?.deadline ? new Date(task.deadline).toISOString().split("T")[0] : ""
  );
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    task?.assignees.map((a) => a.user_id) || []
  );

  React.useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setAcceptanceCriteria(task.acceptance_criteria || "");
      setProjectId(task.project_id || "");
      setPriority(task.priority);
      setDeadline(task.deadline ? new Date(task.deadline).toISOString().split("T")[0] : "");
      setAssigneeIds(task.assignees.map((a) => a.user_id));
    }
    setErrorMsg(null);
  }, [task, isOpen]);

  if (!task) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    startTransition(async () => {
      try {
        const updateRes = await updateTaskAction(task.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          acceptance_criteria: acceptanceCriteria.trim() || undefined,
          project_id: projectId || undefined,
          priority,
          deadline: deadline ? new Date(deadline).toISOString() : undefined,
        });

        if (!updateRes.success) {
          setErrorMsg(updateRes.message);
          return;
        }

        // Update assigned members if changed
        const currentIds = task.assignees.map((a) => a.user_id).sort().join(",");
        const newIds = assigneeIds.slice().sort().join(",");
        if (currentIds !== newIds) {
          const assignRes = await assignTaskMembersAction(task.id, assigneeIds);
          if (!assignRes.success) {
            setErrorMsg(assignRes.message);
            return;
          }
        }

        const project = projects.find((p) => p.id === projectId);
        const assignedMembers = members.filter((m) => assigneeIds.includes(m.id));

        const updated: TaskListItem = {
          ...task,
          title: title.trim(),
          description: description.trim() || null,
          acceptance_criteria: acceptanceCriteria.trim() || null,
          project_id: projectId || null,
          project_title: project?.title || null,
          project_code: project?.code || null,
          priority,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          assignees: assignedMembers.map((m) => ({
            id: m.id,
            user_id: m.id,
            full_name: m.full_name,
            avatar_url: m.avatar_url,
          })),
        };

        onSuccess(updated);
        onClose();
      } catch (err: any) {
        setErrorMsg(err?.message || "Erreur lors de la modification de la tâche.");
      }
    });
  };

  const toggleAssignee = (userId: string) => {
    setAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Edit2 size={18} className="text-uec-red" />
          <span>Modifier la Tâche</span>
        </div>
      }
      description={`Mise à jour des spécifications et des assignations pour "${task.title}".`}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1">
            Titre de la tâche *
          </label>
          <Input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Conception affiche match retour derby"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Projet rattaché (Optionnel)
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full bg-[#111827] border border-[#27354F] text-white text-xs rounded-lg p-2.5 focus:border-uec-red focus:outline-none"
            >
              <option value="">-- Aucun projet spécifique --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.code})
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
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full bg-[#111827] border border-[#27354F] text-white text-xs rounded-lg p-2.5 focus:border-uec-red focus:outline-none"
            >
              <option value="LOW">Faible (LOW)</option>
              <option value="MEDIUM">Normale (MEDIUM)</option>
              <option value="HIGH">Haute (HIGH)</option>
              <option value="CRITICAL">Urgente (CRITICAL)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1">
            Date d'échéance
          </label>
          <Input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1">
            Description des travaux
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Objectifs, périmètre et livrables attendus..."
            className="w-full bg-[#111827] border border-[#27354F] text-white text-xs rounded-lg p-2.5 focus:border-uec-red focus:outline-none resize-none"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1">
            Critères d'acceptation
          </label>
          <textarea
            rows={2}
            value={acceptanceCriteria}
            onChange={(e) => setAcceptanceCriteria(e.target.value)}
            placeholder="Formats attendus, résolutions, conformité charte UEC..."
            className="w-full bg-[#111827] border border-[#27354F] text-white text-xs rounded-lg p-2.5 focus:border-uec-red focus:outline-none resize-none"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1.5">
            Membres assignés ({assigneeIds.length} sélectionnés)
          </label>
          <div className="max-h-36 overflow-y-auto p-2 rounded-lg bg-[#111827] border border-[#27354F] grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {members.map((m) => {
              const selected = assigneeIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleAssignee(m.id)}
                  className={`text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between transition-colors ${
                    selected
                      ? "bg-uec-red/20 border border-uec-red text-white font-medium"
                      : "bg-[#172033] border border-[#27354F] text-slate-400 hover:text-white"
                  }`}
                >
                  <span className="truncate">{m.full_name}</span>
                  {selected && <Check size={12} className="text-uec-red shrink-0" />}
                </button>
              );
            })}
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
                <span>Enregistrer les modifications</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
