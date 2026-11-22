"use client";

import React, { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Building2, Check, AlertCircle, Loader2 } from "lucide-react";
import { createDepartmentAction, updateDepartmentAction } from "@/app/actions/departments";
import type { DepartmentWithStats } from "@/lib/data/departments";
import type { MemberListItem } from "@/lib/data/members";

interface DepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  department?: DepartmentWithStats | null;
  members: MemberListItem[];
}

const COLOR_PRESETS = [
  "#E01E26", // Rouge Club Africain
  "#3B82F6", // Bleu
  "#06B6D4", // Cyan
  "#10B981", // Émeraude
  "#F59E0B", // Ambre
  "#8B5CF6", // Violet
  "#EC4899", // Rose
  "#64748B", // Ardoise
];

export function DepartmentModal({
  isOpen,
  onClose,
  department,
  members,
}: DepartmentModalProps) {
  const isEditing = Boolean(department);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [name, setName] = useState(department?.name || "");
  const [code, setCode] = useState(department?.code || "");
  const [description, setDescription] = useState(department?.description || "");
  const [color, setColor] = useState(department?.color || "#E01E26");
  const [coordinatorId, setCoordinatorId] = useState(department?.coordinator_id || "");
  const [isActive, setIsActive] = useState(department?.is_active ?? true);

  // Sync state when department changes
  React.useEffect(() => {
    if (department) {
      setName(department.name);
      setCode(department.code);
      setDescription(department.description || "");
      setColor(department.color || "#E01E26");
      setCoordinatorId(department.coordinator_id || "");
      setIsActive(department.is_active);
    } else {
      setName("");
      setCode("");
      setDescription("");
      setColor("#E01E26");
      setCoordinatorId("");
      setIsActive(true);
    }
    setErrorMsg(null);
  }, [department, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    startTransition(async () => {
      try {
        if (isEditing && department) {
          const res = await updateDepartmentAction({
            id: department.id,
            name,
            code: code.toUpperCase().trim(),
            description: description.trim() || null,
            color,
            coordinator_id: coordinatorId || null,
            is_active: isActive,
          });

          if (!res.success) {
            setErrorMsg(res.message);
            return;
          }
        } else {
          const res = await createDepartmentAction({
            name,
            code: code.toUpperCase().trim(),
            description: description.trim() || null,
            color,
            coordinator_id: coordinatorId || null,
            is_active: isActive,
          });

          if (!res.success) {
            setErrorMsg(res.message);
            return;
          }
        }

        onClose();
      } catch (err: any) {
        setErrorMsg(err?.message || "Une erreur inattendue est survenue.");
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Modifier le Pôle ${department?.code}` : "Créer un Nouveau Pôle"}
      description="Administration des départements spécialisés du pôle digital UEC."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {errorMsg && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Nom officiel du pôle <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Pôle Audiovisuel & Multimédia"
              className="w-full px-3 py-2 text-xs bg-[#111827] border border-[#27354F] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-uec-red"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Code identifiant (Majuscules) <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ex: AUDIOVISUEL"
              className="w-full px-3 py-2 text-xs bg-[#111827] border border-[#27354F] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-uec-red font-mono"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">
            Description / Missions du pôle
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Responsable de la production vidéo, couverture live des matchs et montage..."
            className="w-full px-3 py-2 text-xs bg-[#111827] border border-[#27354F] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-uec-red resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Coordinateur désigné
            </label>
            <select
              value={coordinatorId}
              onChange={(e) => setCoordinatorId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#111827] border border-[#27354F] rounded-lg text-white focus:outline-none focus:border-uec-red"
            >
              <option value="">-- Aucun coordinateur désigné --</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} ({m.role})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Couleur thématique
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-10 bg-transparent cursor-pointer rounded border border-[#27354F]"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{ backgroundColor: c }}
                    className={`h-5 w-5 rounded-full transition-transform ${
                      color.toLowerCase() === c.toLowerCase() ? "scale-125 ring-2 ring-white" : "opacity-80 hover:opacity-100"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="dept-active"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-[#27354F] text-uec-red focus:ring-uec-red"
          />
          <label htmlFor="dept-active" className="text-xs text-slate-300 cursor-pointer">
            Pôle opérationnel et ouvert aux affectations
          </label>
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
                <span>{isEditing ? "Mettre à jour" : "Créer le pôle"}</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
