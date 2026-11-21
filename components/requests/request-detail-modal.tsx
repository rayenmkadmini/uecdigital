"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Inbox,
  User,
  Building2,
  Calendar,
  Clock,
  Paperclip,
  Check,
  XCircle,
  ArrowRight,
  CheckCircle2,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import type { ServiceRequestListItem } from "@/lib/data/requests";

interface RequestDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ServiceRequestListItem | null;
  canManage: boolean;
  canDelete: boolean;
  isPending: boolean;
  onAccept?: (id: string) => void;
  onOpenReject?: (request: ServiceRequestListItem) => void;
  onConvertToTask?: (id: string) => void;
  onComplete?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function RequestDetailModal({
  isOpen,
  onClose,
  request,
  canManage,
  canDelete,
  isPending,
  onAccept,
  onOpenReject,
  onConvertToTask,
  onComplete,
  onDelete,
}: RequestDetailModalProps) {
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  if (!request) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Inbox size={18} className="text-uec-red" />
          <span className="font-mono text-sm">{request.code}</span>
          <span className="text-slate-400 font-normal text-xs">— Détails de la Demande</span>
        </div>
      }
      description={request.title}
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* Header badges */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default" size="sm" className="font-mono">
            {request.category}
          </Badge>
          <Badge
            variant={
              request.status === "COMPLETED"
                ? "approved"
                : request.status === "REJECTED"
                ? "rejected"
                : request.status === "IN_PROGRESS"
                ? "planning"
                : "pending"
            }
            size="sm"
          >
            {request.status}
          </Badge>
          <Badge
            variant={
              request.priority === "CRITICAL"
                ? "rejected"
                : request.priority === "HIGH"
                ? "review"
                : "default"
            }
            size="sm"
          >
            Priorité: {request.priority}
          </Badge>
        </div>

        {/* Rejection notice if any */}
        {request.status === "REJECTED" && request.rejection_reason && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-rose-400">
              <XCircle size={14} />
              <span>Motif de refus formulé par le pôle :</span>
            </div>
            <p className="italic pl-5">{request.rejection_reason}</p>
          </div>
        )}

        {/* Converted task notice if any */}
        {request.status === "CONVERTED_TO_TASK" && (
          <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0 text-cyan-400" />
            <span>Cette demande a été validée et convertie en tâche de production opérationnelle.</span>
          </div>
        )}

        {/* Main description */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-slate-300">Description et spécifications du livrable</h4>
          <div className="p-3.5 rounded-lg bg-[#111827] border border-[#27354F] text-slate-200 text-xs whitespace-pre-wrap leading-relaxed">
            {request.description}
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-[#172033] border border-[#27354F] space-y-2">
            <div className="flex items-center gap-2 text-slate-400">
              <User size={14} className="text-uec-blue" />
              <span>Demandeur :</span>
              <strong className="text-white font-medium">{request.requester_name}</strong>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Building2 size={14} className="text-uec-red" />
              <span>Pôle d'origine :</span>
              <span className="text-slate-200">{request.requesting_department_name || "Général"}</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#172033] border border-[#27354F] space-y-2">
            <div className="flex items-center gap-2 text-slate-400">
              <Building2 size={14} className="text-uec-cyan" />
              <span>Pôle destinataire :</span>
              <strong className="text-white font-medium">{request.target_department_name}</strong>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <User size={14} className="text-emerald-400" />
              <span>Coordinateur en charge :</span>
              <span className="text-slate-200">{request.assigned_coordinator_name || "En attente d'affectation"}</span>
            </div>
          </div>
        </div>

        {/* Dates & Attachments */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-[#111827] border border-[#27354F] space-y-1 text-slate-400">
            <div className="flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-400" />
              <span>Déposée le : {new Date(request.created_at).toLocaleDateString("fr-FR")} à {new Date(request.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            {request.desired_deadline && (
              <div className="flex items-center gap-1.5 text-amber-400 font-medium">
                <Clock size={13} />
                <span>Échéance souhaitée : {new Date(request.desired_deadline).toLocaleDateString("fr-FR")}</span>
              </div>
            )}
          </div>

          <div className="p-3 rounded-lg bg-[#111827] border border-[#27354F] space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Paperclip size={13} />
              <span>Pièces jointes ({request.attachments?.length || 0})</span>
            </div>
            {request.attachments && request.attachments.length > 0 ? (
              <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                {request.attachments.map((att, idx) => (
                  <a
                    key={idx}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-uec-cyan hover:underline truncate block"
                  >
                    📎 {att.name}
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 italic">Aucun fichier joint à cette demande.</p>
            )}
          </div>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#1F2937]">
          <div>
            {canDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => setIsConfirmDeleteOpen(true)}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/30"
              >
                <Trash2 size={14} className="mr-1" />
                Supprimer
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canManage && request.status === "NEW" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => onAccept?.(request.id)}
                  className="border-emerald-600/40 text-emerald-400 hover:bg-emerald-950/30"
                >
                  <Check size={14} className="mr-1" />
                  Accepter
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={isPending}
                  onClick={() => onOpenReject?.(request)}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  <XCircle size={14} className="mr-1" />
                  Refuser
                </Button>
              </>
            )}

            {canManage && (request.status === "NEW" || request.status === "ACCEPTED") && (
              <Button
                variant="primary"
                size="sm"
                disabled={isPending}
                onClick={() => onConvertToTask?.(request.id)}
                className="bg-uec-red hover:bg-uec-red/90 text-white"
              >
                <ArrowRight size={14} className="mr-1" />
                Convertir en Tâche
              </Button>
            )}

            {canManage && request.status === "IN_PROGRESS" && (
              <Button
                variant="primary"
                size="sm"
                disabled={isPending}
                onClick={() => onComplete?.(request.id)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 size={14} className="mr-1" />
                Marquer Livré
              </Button>
            )}

            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={() => {
          setIsConfirmDeleteOpen(false);
          onDelete?.(request.id);
        }}
        title="Supprimer la demande de prestation ?"
        description={`Confirmez-vous la suppression définitive du dossier ${request.code} (${request.title}) ?`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="danger"
        isLoading={isPending}
      />
    </Modal>
  );
}
