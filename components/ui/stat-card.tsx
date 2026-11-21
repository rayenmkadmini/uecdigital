"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  icon?: React.ReactNode;
  accentColor?: "red" | "blue" | "cyan" | "gold" | "green";
  className?: string;
}

export function StatCard({
  title,
  value,
  description,
  trend,
  icon,
  accentColor = "blue",
  className,
}: StatCardProps) {
  const accentGlow = {
    red: "hover:border-uec-red/40 group-hover:text-uec-red",
    blue: "hover:border-uec-blue/40 group-hover:text-uec-blue",
    cyan: "hover:border-uec-cyan/40 group-hover:text-uec-cyan",
    gold: "hover:border-amber-500/40 group-hover:text-amber-400",
    green: "hover:border-emerald-500/40 group-hover:text-emerald-400",
  };

  const iconColors = {
    red: "text-uec-red bg-uec-red/10 border-uec-red/20",
    blue: "text-uec-blue bg-uec-blue/10 border-uec-blue/20",
    cyan: "text-uec-cyan bg-uec-cyan/10 border-uec-cyan/20",
    gold: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    green: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  };

  return (
    <div
      className={cn(
        "group relative bg-[#111827] border border-[#1F2937] rounded-xl p-5 shadow-lg shadow-black/30 transition-all duration-200 hover:-translate-y-0.5",
        accentGlow[accentColor],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-uec-muted uppercase tracking-wider">
            {title}
          </p>
          <div className="text-2xl font-bold text-uec-text tracking-tight">
            {value}
          </div>
        </div>
        {icon && (
          <div
            className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center border",
              iconColors[accentColor]
            )}
          >
            {icon}
          </div>
        )}
      </div>

      {(description || trend) && (
        <div className="mt-3 pt-3 border-t border-[#1F2937]/60 flex items-center justify-between text-xs text-uec-muted">
          {description && <span>{description}</span>}
          {trend && (
            <span
              className={cn(
                "font-semibold flex items-center gap-1",
                trend.isPositive ? "text-emerald-400" : "text-amber-400"
              )}
            >
              {trend.isPositive ? "↑" : "↓"} {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
