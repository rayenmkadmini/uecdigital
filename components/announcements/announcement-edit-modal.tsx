"use client";

import React, { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, AlertCircle, Loader2, Edit2 } from "lucide-react";
import { updateAnnouncementAction } from "@/app/actions/announcements";
import type { AnnouncementItem } from "@/lib/data/announcements";
import type { DepartmentWithStats } from "@/lib/data/departments";

interface AnnouncementEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcement: AnnouncementItem | null;
  departments: DepartmentWithStats[];
  onSuccess: (updated: AnnouncementItem) => void;
}

function normalizePriority(p: string | undefined): "LOW" | "NORMAL" | "HIGH" | "CRITICAL" {
  if (p === "URGENT") return "CRITICAL";
  if (p === "IMPORTANT") return "HIGH";
  if (p === "CRITICAL" || p === "HIGH" || p === "LOW") return p;
  return "NORMAL";
}

export function AnnouncementEditModal({
  isOpen,
  onClose,
  announcement,
  departments,
  onSuccess,
}: AnnouncementEditModalProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [title, setTitle] = useState(announcement?.title || "");
  const [content, setContent] = useState(announcement?.content || "");
  const [priority, setPriority] = useState<"LOW" | "NORMAL" | "HIGH" | "CRITICAL">(
    normalizePriority(announcement?.priority)
  );
  const [targetAudience, setTargetAudience] = useState(announcement?.target_audience || "ALL");
  const [departmentId, setDepartmentId] = useState(announcement?.department_id || "");

  React.useEffect(() => {
    if (announcement) {
      setTitle(announcement.title);
      setContent(announcement.content);
      setPriority(normalizePriority(announcement.priority));
      setTargetAudience(announcement.target_audience);
      setDepartmentId(announcement.department_id || "");
    }
    setErrorMsg(null);
  }, [announcement, isOpen]);

  if (!announcement) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    startTransition(async () => {
      try {
        const res = await updateAnnouncementAction(announcement.id, {
          title: title.trim(),
          content: content.trim(),
          priority,
          target_audience: targetAudience,
          department_id: departmentId || null,
        });

        if (!res.success) {
          setErrorMsg(res.message);
          return;
        }

        const dept = departments.find((d) => d.id === departmentId);
        const updated: AnnouncementItem = {
          ...announcement,
          title: title.trim(),
          content: content.trim(),
          priority,
          target_audience: targetAudience,
          department_id: departmentId || null,
          department_name: dept?.name || null,
          updated_at: new Date().toISOString(),
        };

        onSuccess(updated);
        onClose();
      } catch (err: any) {
        setErrorMsg(err?.message || "Erreur lors de la mise à jour de l'annonce.");
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
          <span>Modifier l'Annonce Officielle</span>
        </div>
      }
      description={`Mise à jour de la directive "${announcement.title}".`}
      maxWidth="lg"
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
            Titre de la directive *
          </label>
          <Input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Consignes impératives pour la campagne derbies"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Niveau d'importance *
            </label>
            <select
              value={priority}
              onChange={(e) =>
                setPriority(e.target.value as "LOW" | "NORMAL" | "HIGH" | "CRITICAL")
              }
              className="w-full bg-[#111827] border border-[#27354F] text-white text-xs rounded-lg p-2.5 focus:border-uec-red focus:outline-none"
            >
              <option value="NORMAL">Information Générale (NORMAL)</option>
              <option value="HIGH">Important (HIGH)</option>
              <option value="CRITICAL">Urgent & Prioritaire (CRITICAL)</option>
              <option value="LOW">Note Interne (LOW)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Public cible / Pôle
            </label>
            <select
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setTargetAudience(e.target.value ? "DEPARTMENT" : "ALL");
              }}
              className="w-full bg-[#111827] border border-[#27354F] text-white text-xs rounded-lg p-2.5 focus:border-uec-red focus:outline-none"
            >
              <option value="">Tous les membres UEC</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  Pôle {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1">
            Contenu de la communication *
          </label>
          <textarea
            required
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Rédigez la directive, les consignes ou les annonces opérationnelles..."
            className="w-full bg-[#111827] border border-[#27354F] text-white text-xs rounded-lg p-3 focus:border-uec-red focus:outline-none resize-none leading-relaxed"
          />
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
