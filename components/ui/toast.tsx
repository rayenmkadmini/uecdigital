"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", title?: string, duration = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newToast: ToastItem = { id, type, title, message, duration };
      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      {/* Toast viewport */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 rtl:right-auto rtl:left-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-2 duration-200 ${
              toast.type === "success"
                ? "bg-emerald-950/90 border-emerald-700/60 text-emerald-200"
                : toast.type === "error"
                ? "bg-rose-950/90 border-rose-700/60 text-rose-200"
                : toast.type === "warning"
                ? "bg-amber-950/90 border-amber-700/60 text-amber-200"
                : "bg-slate-900/90 border-slate-700/60 text-slate-200"
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === "success" && <CheckCircle2 size={16} className="text-emerald-400" />}
              {toast.type === "error" && <AlertCircle size={16} className="text-rose-400" />}
              {toast.type === "warning" && <AlertTriangle size={16} className="text-amber-400" />}
              {toast.type === "info" && <Info size={16} className="text-uec-cyan" />}
            </div>
            <div className="flex-1 space-y-0.5 text-xs">
              {toast.title && <p className="font-bold text-white">{toast.title}</p>}
              <p className="leading-relaxed">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              aria-label="Fermer la notification"
              className="p-1 text-slate-400 hover:text-white rounded-md transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
