"use client";

import React, { useState, useTransition, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/context";
import {
  Send,
  RotateCcw,
  AlertCircle,
  X,
  FileCheck2,
  FileText,
} from "lucide-react";
import { submitCoordinatorReview } from "@/app/actions/approvals";

export type CoordinatorReviewAction = "SUBMIT_TO_SUPER_ADMIN" | "REQUEST_REVISION";

export interface CoordinatorSubmissionItem {
  id: string;
  taskTitle: string;
  assignee: string;
  submittedAt?: string;
  version: number;
  description: string;
}

interface CoordinatorReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: CoordinatorSubmissionItem | null;
  actionType: CoordinatorReviewAction;
  onSuccess: (submissionId: string, actionType: CoordinatorReviewAction, message: string) => void;
}

export function CoordinatorReviewModal({
  isOpen,
  onClose,
  submission,
  actionType,
  onSuccess,
}: CoordinatorReviewModalProps) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const presets: Record<CoordinatorReviewAction, string[]> = {
    SUBMIT_TO_SUPER_ADMIN: [
      t("coordinatorReviewModal.presets.submit1"),
      t("coordinatorReviewModal.presets.submit2"),
      t("coordinatorReviewModal.presets.submit3"),
    ],
    REQUEST_REVISION: [
      t("coordinatorReviewModal.presets.revision1"),
      t("coordinatorReviewModal.presets.revision2"),
      t("coordinatorReviewModal.presets.revision3"),
      t("coordinatorReviewModal.presets.revision4"),
    ],
  };

  useEffect(() => {
    if (isOpen) {
      setServerError(null);
      setValidationError(null);
      if (actionType === "SUBMIT_TO_SUPER_ADMIN") {
        setNotes(t("coordinatorReviewModal.defaultSubmitNote"));
      } else {
        setNotes("");
      }
    }
  }, [isOpen, actionType, t]);

  if (!isOpen || !submission) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setServerError(null);

    const trimmed = notes.trim();
    if (trimmed.length < 3) {
      setValidationError(
        actionType === "SUBMIT_TO_SUPER_ADMIN"
          ? t("coordinatorReviewModal.validationErrorSubmit")
          : t("coordinatorReviewModal.validationErrorRevision")
      );
      return;
    }

    startTransition(async () => {
      try {
        const res = await submitCoordinatorReview(submission.id, actionType, trimmed);
        if (res.success) {
          onSuccess(submission.id, actionType, res.message);
          onClose();
        } else {
          setServerError(res.message || "Erreur lors de la soumission de la revue.");
        }
      } catch (err: any) {
        setServerError(err.message || "Erreur de connexion au serveur.");
      }
    });
  };

  const config = {
    SUBMIT_TO_SUPER_ADMIN: {
      title: t("coordinatorReviewModal.titleSubmit"),
      subtitle: t("coordinatorReviewModal.subtitleSubmit"),
      icon: <Send size={20} className="text-uec-blue rtl:rotate-180" />,
      buttonColor: "bg-uec-blue hover:bg-uec-blueHover text-white",
      buttonText: t("coordinatorReviewModal.confirmSubmit"),
      noteLabel: t("coordinatorReviewModal.noteLabelSubmit"),
      notePlaceholder: t("coordinatorReviewModal.placeholderSubmit"),
      borderClass: "border-blue-500/40",
      accentBg: "bg-blue-950/30 border-blue-800/40 text-blue-300",
    },
    REQUEST_REVISION: {
      title: t("coordinatorReviewModal.titleRevision"),
      subtitle: t("coordinatorReviewModal.subtitleRevision"),
      icon: <RotateCcw size={20} className="text-amber-400" />,
      buttonColor: "bg-amber-600 hover:bg-amber-500 text-white",
      buttonText: t("coordinatorReviewModal.confirmRevision"),
      noteLabel: t("coordinatorReviewModal.noteLabelRevision"),
      notePlaceholder: t("coordinatorReviewModal.placeholderRevision"),
      borderClass: "border-amber-500/40",
      accentBg: "bg-amber-950/30 border-amber-800/40 text-amber-300",
    },
  }[actionType];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="coordinator-review-title"
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
              <h2 id="coordinator-review-title" className="text-lg font-bold tracking-tight text-white">
                {config.title}
              </h2>
              <Badge variant="coordinator" size="sm">
                {t("coordinatorReviewModal.roleBadge")}
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
            <span className="text-[10px] text-slate-400 px-2 py-0.5 rounded bg-slate-800 shrink-0">
              v{submission.version}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-slate-400 text-[11px]">
            <span>
              {t("coordinatorReviewModal.assignedMember")} :{" "}
              <strong className="text-slate-200">{submission.assignee}</strong>
            </span>
            {submission.submittedAt && (
              <span>• {t("coordinatorReviewModal.submittedAt")} : <span className="text-slate-300">{submission.submittedAt}</span></span>
            )}
          </div>
          {submission.description && (
            <p className="italic text-slate-300 text-[11px] pt-1 border-t border-slate-800 line-clamp-2">
              "{submission.description}"
            </p>
          )}
        </div>

        {/* Info Banner */}
        <div className={`p-3 rounded-lg border text-xs flex items-start gap-2 mb-4 ${config.accentBg}`}>
          <FileCheck2 size={16} className="shrink-0 mt-0.5" />
          <span>
            {actionType === "SUBMIT_TO_SUPER_ADMIN"
              ? t("coordinatorReviewModal.infoSubmit")
              : t("coordinatorReviewModal.infoRevision")}
          </span>
        </div>

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
              <label htmlFor="coordinatorNotes" className="text-xs font-semibold text-slate-300">
                {config.noteLabel}
              </label>
              <span className="text-[10px] text-slate-400">{notes.length}/1000</span>
            </div>
            <textarea
              id="coordinatorNotes"
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
              <span>{t("coordinatorReviewModal.quickPresets")}</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {presets[actionType].map((preset, idx) => (
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

          {/* Actions */}
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
