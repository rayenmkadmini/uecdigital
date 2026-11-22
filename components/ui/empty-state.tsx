"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/context";
import type { LucideIcon } from "lucide-react";

export interface EmptyStateProps {
  icon?: LucideIcon | React.ReactNode;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    icon?: LucideIcon;
    variant?: "primary" | "secondary" | "outline" | "cyan";
  };
  children?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  children,
  className,
}: EmptyStateProps) {
  const { t } = useTranslation();
  const ActionIcon = action?.icon;
  const displayTitle = title || t("emptyState.noData");
  const displayDescription = description !== undefined ? description : t("emptyState.noDataDesc");

  return (
    <div
      className={cn(
        "relative bg-[#0e0e12]/70 border border-dashed border-white/10 rounded-2xl p-8 lg:p-12 text-center flex flex-col items-center justify-center space-y-4 backdrop-blur-sm shadow-xl shadow-black/20",
        className
      )}
    >
      {/* Icon halo */}
      {Icon && (
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-b from-[#172033] to-[#0B1020] border border-white/10 shadow-lg shadow-black/50 flex items-center justify-center text-slate-400">
            {typeof Icon === "function" ? (
              <Icon size={30} className="text-slate-400" />
            ) : (
              Icon
            )}
          </div>
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-uec-red/20 via-transparent to-uec-blue/20 blur-sm -z-10" />
        </div>
      )}

      {/* Typography */}
      <div className="space-y-1.5 max-w-md mx-auto">
        <h3 className="text-base font-bold text-white tracking-tight">{displayTitle}</h3>
        {displayDescription && (
          <p className="text-xs text-slate-400 leading-relaxed">{displayDescription}</p>
        )}
      </div>

      {/* Actions */}
      {action && (
        <div className="pt-2">
          <Button
            variant={action.variant || "outline"}
            size="sm"
            onClick={action.onClick}
            className="flex items-center gap-1.5"
          >
            {ActionIcon && <ActionIcon size={14} className="shrink-0 rtl:rotate-180" />}
            <span>{action.label}</span>
          </Button>
        </div>
      )}

      {children}
    </div>
  );
}
