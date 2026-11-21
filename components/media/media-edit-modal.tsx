"use client";

import React, { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, AlertCircle, Loader2, Edit2 } from "lucide-react";
import { updateMediaFileAction } from "@/app/actions/media";
import type { MediaFileItem, MediaCategory } from "@/lib/data/media";
import type { DepartmentWithStats } from "@/lib/data/departments";

interface MediaEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: MediaFileItem | null;
  departments: DepartmentWithStats[];
  onSuccess: (updated: MediaFileItem) => void;
}

const CATEGORY_OPTIONS: Array<{ value: MediaCategory; label: string }> = [
  { value: "BRANDING", label: "Identité & Branding" },
  { value: "PHOTO", label: "Photos & Couvertures" },
  { value: "VIDEO", label: "Vidéos & Teasers" },
  { value: "DOCUMENT", label: "Documents & Chartes" },
  { value: "DESIGN_ASSET", label: "Ressources Graphiques" },
  { value: "AUDIO", label: "Sons & Chants" },
  { value: "AUTRE", label: "Divers" },
];

export function MediaEditModal({
  isOpen,
  onClose,
  file,
  departments,
  onSuccess,
}: MediaEditModalProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [title, setTitle] = useState(file?.title || "");
  const [category, setCategory] = useState<MediaCategory>(file?.category || "BRANDING");
  const [departmentId, setDepartmentId] = useState(file?.department_id || "");
  const [isPublic, setIsPublic] = useState(file?.is_public_within_team ?? true);

  React.useEffect(() => {
    if (file) {
      setTitle(file.title);
      setCategory(file.category);
      setDepartmentId(file.department_id || "");
      setIsPublic(file.is_public_within_team);
    }
    setErrorMsg(null);
  }, [file, isOpen]);

  if (!file) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    startTransition(async () => {
      try {
        const res = await updateMediaFileAction(file.id, {
          title: title.trim(),
          category,
          department_id: departmentId || null,
          is_public_within_team: isPublic,
        });

        if (!res.success) {
          setErrorMsg(res.message);
          return;
        }

        const dept = departments.find((d) => d.id === departmentId);
        const updated: MediaFileItem = {
          ...file,
          title: title.trim(),
          category,
          department_id: departmentId || null,
          department_name: dept?.name || null,
          is_public_within_team: isPublic,
          updated_at: new Date().toISOString(),
        };

        onSuccess(updated);
        onClose();
      } catch (err: any) {
        setErrorMsg(err?.message || "Erreur lors de la mise à jour du fichier.");
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Edit2 size={18} className="text-uec-red" />
          <span>Modifier les Métadonnées du Fichier</span>
        </div>
      }
      description={`Édition des informations de classification pour "${file.file_name}".`}
      maxWidth="md"
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
            Titre d'affichage *
          </label>
          <Input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Logo Officiel UEC Vectoriel 2026"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1">
            Catégorie de média *
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as MediaCategory)}
            className="w-full bg-[#111827] border border-[#27354F] text-white text-xs rounded-lg p-2.5 focus:border-uec-red focus:outline-none"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1">
            Pôle d'appartenance
          </label>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="w-full bg-[#111827] border border-[#27354F] text-white text-xs rounded-lg p-2.5 focus:border-uec-red focus:outline-none"
          >
            <option value="">-- Pôle transversal / Tous --</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="media-public"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="rounded border-[#27354F] text-uec-red focus:ring-uec-red"
          />
          <label htmlFor="media-public" className="text-xs text-slate-300 cursor-pointer">
            Ressource partagée visible par l'ensemble des membres UEC
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
                <span>Enregistrer</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
