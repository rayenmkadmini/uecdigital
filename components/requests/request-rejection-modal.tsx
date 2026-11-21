"use client";

import React, { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { XCircle, AlertCircle, Loader2 } from "lucide-react";
import { updateRequestStatusAction } from "@/app/actions/requests";
import type { ServiceRequestListItem } from "@/lib/data/requests";

interface RequestRejectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ServiceRequestListItem | null;
  onSuccess: (requestId: string, reason: string) => void;
}

const REJECTION_PRESETS = [
  "Capacité de production insuffisante pour l'échéance demandée.",
  "Spécifications incomplètes ou brief insuffisant pour amorcer la production.",
  "Demande hors du périmètre d'action du pôle sélectionné.",
  "Ressources graphiques ou techniques indisponibles.",
  "Délai trop court pour garantir le niveau d'excellence UEC.",
];

export function RequestRejectionModal({
  isOpen,
  onClose,
  request,
  onSuccess,
}: RequestRejectionModalProps) {
  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  React.useEffect(() => {
    setReason("");
    setErrorMsg(null);
  }, [request, isOpen]);

  if (!request) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg("Veuillez motiver le refus de la demande.");
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      try {
        const res = await updateRequestStatusAction(request.id, "REJECTED", reason.trim());
        if (!res.success) {
          setErrorMsg(res.message);
          return;
        }

        onSuccess(request.id, reason.trim());
        onClose();
      } catch (err: any) {
        setErrorMsg(err?.message || "Une erreur est survenue lors du refus.");
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-rose-400">
          <XCircle size={18} />
          <span>Refuser la demande {request.code}</span>
        </div>
      }
      description={`Motif du refus pour la demande "${request.title}" déposée par ${request.requester_name}.`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-300">
            Motifs standards recommandés :
          </label>
          <div className="flex flex-col gap-1.5">
            {REJECTION_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setReason(preset)}
                className="text-left text-xs p-2 rounded bg-[#111827] border border-[#27354F] hover:border-slate-500 text-slate-300 hover:text-white transition-colors"
              >
                • {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">
            Motif personnalisé ou complément d'information <span className="text-red-400">*</span>
          </label>
          <textarea
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Expliquez au demandeur la raison du refus ou ce qui doit être modifié..."
            className="w-full px-3 py-2 text-xs bg-[#111827] border border-[#27354F] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-uec-red resize-none"
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
            variant="danger"
            size="sm"
            disabled={isPending || !reason.trim()}
            className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
          >
            {isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Enregistrement...</span>
              </>
            ) : (
              <>
                <XCircle size={14} />
                <span>Confirmer le refus</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
