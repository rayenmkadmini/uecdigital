"use client";

import React, { useState, useTransition, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/context";
import {
  ShieldCheck,
  CheckCircle2,
  RotateCcw,
  XCircle,
  AlertCircle,
  X,
  FileText,
  AlertTriangle,
} from "lucide-react";
import {
  executeFinalApproval,
  submitCoordinatorReview,
  rejectSubmissionAction,
} from "@/app/actions/approvals";

export type ApprovalDecisionType = "APPROVED" | "REVISION" | "REJECTED";

export interface ApprovalSubmissionItem {
  id: string;
  taskTitle: string;
  projectTitle?: string;
  department?: string;
  submittedBy?: string;
  version?: number;
  notes?: string;
}

interface ApprovalDecisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: ApprovalSubmissionItem | null;
  decisionType: ApprovalDecisionType;
  onSuccess: (submissionId: string, decisionType: ApprovalDecisionType, message: string) => void;
}

export function ApprovalDecisionModal({
  isOpen,
  onClose,
  submission,
  decisionType,
  onSuccess,
}: ApprovalDecisionModalProps) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const presets: Record<ApprovalDecisionType, string[]> = {
    APPROVED: [
      t("approvalDecisionModal.presets.approved1"),
      t("approvalDecisionModal.presets.approved2"),
      t("approvalDecisionModal.presets.approved3"),
    ],
    REVISION: [
      t("approvalDecisionModal.presets.revision1"),
      t("approvalDecisionModal.presets.revision2"),
      t("approvalDecisionModal.presets.revision3"),
      t("approvalDecisionModal.presets.revision4"),
    ],
    REJECTED: [
      t("approvalDecisionModal.presets.rejected1"),
      t("approvalDecisionModal.presets.rejected2"),
      t("approvalDecisionModal.presets.rejected3"),
    ],
  };

  // Reset or initialize state when opened
  useEffect(() => {
    if (isOpen) {
      setServerError(null);
      setValidationError(null);
      if (decisionType === "APPROVED") {
        setNotes(t("approvalDecisionModal.defaultApprovedNote"));
      } else {
        setNotes("");
      }
    }
  }, [isOpen, decisionType, t]);

  if (!isOpen || !submission) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setServerError(null);

    const trimmed = notes.trim();

    if (decisionType !== "APPROVED") {
      if (trimmed.length < 5) {
        setValidationError(
          decisionType === "REVISION"
            ? t("approvalDecisionModal.validationErrorRevision")
            : t("approvalDecisionModal.validationErrorRejected")
        );
        return;
      }
    }

    startTransition(async () => {
      try {
        let res;
        if (decisionType === "APPROVED") {
          res = await executeFinalApproval(
            submission.id,
            trimmed || t("approvalDecisionModal.defaultApprovedNote")
          );
        } else if (decisionType === "REVISION") {
          res = await submitCoordinatorReview(submission.id, "REQUEST_REVISION", trimmed);
        } else {
          res = await rejectSubmissionAction(submission.id, trimmed);
        }

        if (res.success) {
          onSuccess(submission.id, decisionType, res.message);
          onClose();
        } else {
          setServerError(res.message || t("approvalDecisionModal.serverErrorDefault"));
        }
      } catch (err: any) {
        setServerError(err.message || "Erreur de connexion au serveur.");
      }
    });
  };

  const config = {
    APPROVED: {
      title: t("approvalDecisionModal.titleApproved"),
      subtitle: t("approvalDecisionModal.subtitleApproved"),
      icon: <CheckCircle2 size={22} className="text-emerald-400" />,
      accentBadge: "emerald" as const,
      buttonColor: "bg-emerald-600 hover:bg-emerald-500 border-emerald-500/50 text-white",
      buttonText: t("approvalDecisionModal.confirmApproved"),
      noteLabel: t("approvalDecisionModal.noteLabelApproved"),
      notePlaceholder: t("approvalDecisionModal.placeholderApproved"),
      borderClass: "border-emerald-500/30",
    },
    REVISION: {
      title: t("approvalDecisionModal.titleRevision"),
      subtitle: t("approvalDecisionModal.subtitleRevision"),
      icon: <RotateCcw size={22} className="text-amber-400" />,
      accentBadge: "warning" as const,
      buttonColor: "bg-amber-600 hover:bg-amber-500 border-amber-500/50 text-white",
      buttonText: t("approvalDecisionModal.confirmRevision"),
      noteLabel: t("approvalDecisionModal.noteLabelRevision"),
      notePlaceholder: t("approvalDecisionModal.placeholderRevision"),
      borderClass: "border-amber-500/30",
    },
    REJECTED: {
      title: t("approvalDecisionModal.titleRejected"),
      subtitle: t("approvalDecisionModal.subtitleRejected"),
      icon: <XCircle size={22} className="text-uec-red" />,
      accentBadge: "rejected" as const,
      buttonColor: "bg-red-700 hover:bg-red-600 border-red-500/50 text-white",
      buttonText: t("approvalDecisionModal.confirmRejected"),
      noteLabel: t("approvalDecisionModal.noteLabelRejected"),
      notePlaceholder: t("approvalDecisionModal.placeholderRejected"),
      borderClass: "border-uec-red/40",
    },
  }[decisionType];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-decision-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div
        className={`bg-[#0e0e12] border ${config.borderClass} rounded-2xl w-full max-w-lg shadow-2xl p-6 relative text-white backdrop-blur-xl`}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="absolute top-4 right-4 rtl:right-auto rtl:left-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-uec-blue"
          aria-label={t("actions.close")}
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3 mb-5 pr-8 rtl:pr-0 rtl:pl-8">
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 shrink-0">
            {config.icon}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="approval-decision-title" className="text-lg font-bold tracking-tight text-white">
                {config.title}
              </h2>
              <Badge variant="superAdmin" size="sm">
                {t("approvalDecisionModal.roleBadge")}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{config.subtitle}</p>
          </div>
        </div>

        {/* Submission Details Recap */}
        <div className="p-3.5 rounded-xl bg-[#111827] border border-[#1F2937] space-y-2 mb-4 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-white truncate text-sm">
              {submission.taskTitle}
            </span>
            {submission.version !== undefined && (
              <span className="text-[10px] text-slate-400 px-2 py-0.5 rounded bg-slate-800 shrink-0">
                {t("approvalDecisionModal.version", { version: submission.version })}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-400 text-[11px]">
            {submission.department && (
              <span>
                {t("approvalDecisionModal.department")} :{" "}
                <strong className="text-slate-200">{submission.department}</strong>
              </span>
            )}
            {submission.projectTitle && (
              <span>
                {t("approvalDecisionModal.project")} :{" "}
                <strong className="text-slate-200">{submission.projectTitle}</strong>
              </span>
            )}
            {submission.submittedBy && (
              <span>
                {t("approvalDecisionModal.author")} :{" "}
                <strong className="text-slate-200">{submission.submittedBy}</strong>
              </span>
            )}
          </div>
          {submission.notes && (
            <p className="italic text-slate-300 text-[11px] pt-1 border-t border-slate-800 line-clamp-2">
              "{submission.notes}"
            </p>
          )}
        </div>

        {/* Action Warning Notice */}
        {decisionType === "APPROVED" && (
          <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 text-xs flex items-start gap-2 mb-4">
            <ShieldCheck size={16} className="shrink-0 mt-0.5 text-emerald-400" />
            <span>{t("approvalDecisionModal.infoLocked")}</span>
          </div>
        )}

        {decisionType === "REVISION" && (
          <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/40 text-amber-300 text-xs flex items-start gap-2 mb-4">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-400" />
            <span>{t("approvalDecisionModal.infoRevision")}</span>
          </div>
        )}

        {decisionType === "REJECTED" && (
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start gap-2 mb-4">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-uec-red" />
            <span>{t("approvalDecisionModal.infoRejected")}</span>
          </div>
        )}

        {/* Server Error Alert */}
        {serverError && (
          <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2 mb-4">
            <AlertCircle size={16} className="shrink-0 text-rose-400" />
            <span>{serverError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="decisionNotes" className="text-xs font-semibold text-slate-300">
                {config.noteLabel}
              </label>
              <span className="text-[10px] text-slate-400">{notes.length}/1000</span>
            </div>
            <textarea
              id="decisionNotes"
              rows={4}
              maxLength={1000}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder={config.notePlaceholder}
              disabled={isPending}
              className={`w-full bg-[#111827] text-xs text-white placeholder-slate-500 rounded-lg p-3 border focus:outline-none transition-colors ${
                validationError
                  ? "border-rose-500 focus:border-rose-500"
                  : "border-[#1F2937] focus:border-uec-blue focus:ring-1 focus:ring-uec-blue"
              }`}
            />
            {validationError && (
              <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                <AlertCircle size={12} />
                <span>{validationError}</span>
              </p>
            )}
          </div>

          {/* Quick Presets */}
          <div>
            <p className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
              <FileText size={12} />
              <span>{t("approvalDecisionModal.quickPresets")}</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {presets[decisionType].map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isPending}
                  onClick={() => setNotes(preset)}
                  className="text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white px-2.5 py-1 rounded-md border border-slate-800 transition-colors text-left rtl:text-right focus:outline-none focus:ring-1 focus:ring-uec-blue"
                >
                  {preset.length > 50 ? preset.slice(0, 48) + "..." : preset}
                </button>
              ))}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={onClose}
              className="text-xs"
            >
              {t("actions.cancel")}
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={isPending}
              disabled={isPending}
              className={`text-xs ${config.buttonColor}`}
            >
              {config.buttonText}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
