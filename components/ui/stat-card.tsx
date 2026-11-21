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
  const accentBorders = {
    red: "hover:border-uec-red/50 hover:shadow-uec-red/10",
    blue: "hover:border-uec-blue/50 hover:shadow-uec-blue/10",
    cyan: "hover:border-uec-cyan/50 hover:shadow-uec-cyan/10",
    gold: "hover:border-amber-500/50 hover:shadow-amber-500/10",
    green: "hover:border-emerald-500/50 hover:shadow-emerald-500/10",
  };

  const topGlowLines = {
    red: "from-transparent via-uec-red to-transparent",
    blue: "from-transparent via-uec-blue to-transparent",
    cyan: "from-transparent via-uec-cyan to-transparent",
    gold: "from-transparent via-amber-400 to-transparent",
    green: "from-transparent via-emerald-400 to-transparent",
  };

  const iconColors = {
    red: "text-red-400 bg-red-950/40 border-red-800/40 shadow-sm shadow-red-950/50",
    blue: "text-blue-400 bg-blue-950/40 border-blue-800/40 shadow-sm shadow-blue-950/50",
    cyan: "text-cyan-400 bg-cyan-950/40 border-cyan-800/40 shadow-sm shadow-cyan-950/50",
    gold: "text-amber-400 bg-amber-950/40 border-amber-800/40 shadow-sm shadow-amber-950/50",
    green: "text-emerald-400 bg-emerald-950/40 border-emerald-800/40 shadow-sm shadow-emerald-950/50",
  };

  return (
    <div
      className={cn(
        "group relative bg-[#0e0e12]/90 hover:bg-[#111827] border border-white/10 rounded-xl p-5 shadow-lg shadow-black/40 transition-all duration-300 hover:-translate-y-0.5 overflow-hidden backdrop-blur-sm",
        accentBorders[accentColor],
        className
      )}
    >
      {/* Top subtle ambient highlight */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-500",
          topGlowLines[accentColor]
        )}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">
            {title}
          </p>
          <div className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
            {value}
          </div>
        </div>
        {icon && (
          <div
            className={cn(
              "h-11 w-11 rounded-xl flex items-center justify-center border shrink-0 transition-transform duration-300 group-hover:scale-105",
              iconColors[accentColor]
            )}
          >
            {icon}
          </div>
        )}
      </div>

      {(description || trend) && (
        <div className="mt-3.5 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
          {description && <span className="truncate pr-2 rtl:pr-0 rtl:pl-2">{description}</span>}
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full text-[11px] shrink-0",
                trend.isPositive
                  ? "text-emerald-400 bg-emerald-950/50 border border-emerald-800/40"
                  : "text-amber-400 bg-amber-950/50 border border-amber-800/40"
              )}
            >
              <span>{trend.isPositive ? "↑" : "↓"}</span>
              <span>{trend.value}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
