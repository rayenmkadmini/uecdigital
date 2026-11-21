"use client";

import React, { useEffect } from "react";
import { AlertTriangle, AlertCircle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "danger",
  isLoading = false,
}: ConfirmDialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: <AlertTriangle size={22} className="text-rose-500" />,
      border: "border-rose-900/40",
      buttonVariant: "danger" as const,
      bgIcon: "bg-rose-950/50",
    },
    warning: {
      icon: <AlertCircle size={22} className="text-amber-500" />,
      border: "border-amber-900/40",
      buttonVariant: "primary" as const,
      bgIcon: "bg-amber-950/50",
    },
    info: {
      icon: <Info size={22} className="text-uec-cyan" />,
      border: "border-cyan-900/40",
      buttonVariant: "cyan" as const,
      bgIcon: "bg-cyan-950/50",
    },
  };

  const style = variantStyles[variant];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        className={`bg-[#0e0e12] border ${style.border} rounded-2xl w-full max-w-md shadow-2xl shadow-black/90 p-6 relative overflow-hidden`}
      >
        <button
          onClick={onClose}
          disabled={isLoading}
          aria-label="Fermer"
          className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-uec-blue disabled:opacity-50"
        >
          <X size={18} />
        </button>

        <div className="flex items-start gap-4">
          <div
            className={`h-11 w-11 rounded-xl ${style.bgIcon} border ${style.border} flex items-center justify-center shrink-0 mt-0.5`}
          >
            {style.icon}
          </div>
          <div className="space-y-1.5 flex-1 pr-6 rtl:pr-0 rtl:pl-6">
            <h2
              id="confirm-dialog-title"
              className="text-base font-bold text-white tracking-tight"
            >
              {title}
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-5 mt-4 border-t border-[#1F2937]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={style.buttonVariant}
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
