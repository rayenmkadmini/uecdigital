"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "superAdmin"
    | "coordinator"
    | "member"
    | "approved"
    | "pending"
    | "review"
    | "rejected"
    | "revision"
    | "planning"
    | "cyan"
    | "red"
    | "gold"
    | "emerald"
    | "blue"
    | "success"
    | "warning"
    | "danger";
  size?: "sm" | "md";
  dot?: boolean;
}

export function Badge({
  className,
  variant = "default",
  size = "sm",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const variants: Record<string, string> = {
    default: "bg-[#172033]/90 text-slate-300 border-[#27354F]",
    superAdmin:
      "bg-red-950/80 text-red-200 border-red-700/60 shadow-sm shadow-red-950/50",
    coordinator:
      "bg-blue-950/80 text-blue-200 border-blue-700/60 shadow-sm shadow-blue-950/50",
    member:
      "bg-slate-800/90 text-slate-300 border-slate-700/80",
    approved:
      "bg-emerald-950/80 text-emerald-300 border-emerald-600/60 shadow-sm shadow-emerald-950/40",
    pending:
      "bg-amber-950/80 text-amber-300 border-amber-600/60 shadow-sm shadow-amber-950/40",
    review:
      "bg-indigo-950/80 text-indigo-200 border-indigo-600/60 shadow-sm shadow-indigo-950/40",
    rejected:
      "bg-rose-950/80 text-rose-300 border-rose-700/60 shadow-sm shadow-rose-950/40",
    revision:
      "bg-orange-950/80 text-orange-300 border-orange-600/60 shadow-sm shadow-orange-950/40",
    planning:
      "bg-sky-950/80 text-sky-300 border-sky-600/60 shadow-sm shadow-sky-950/40",
    cyan:
      "bg-cyan-950/80 text-cyan-300 border-cyan-500/50 shadow-sm shadow-cyan-950/40",
    red:
      "bg-red-950/80 text-red-300 border-red-600/60 shadow-sm shadow-red-950/40",
    gold:
      "bg-amber-950/80 text-amber-300 border-amber-500/60 shadow-sm shadow-amber-950/40",
    emerald:
      "bg-emerald-950/80 text-emerald-300 border-emerald-600/60 shadow-sm shadow-emerald-950/40",
    blue:
      "bg-blue-950/80 text-blue-200 border-blue-600/60 shadow-sm shadow-blue-950/40",
    success:
      "bg-emerald-950/80 text-emerald-300 border-emerald-600/60 shadow-sm shadow-emerald-950/40",
    warning:
      "bg-amber-950/80 text-amber-300 border-amber-600/60 shadow-sm shadow-amber-950/40",
    danger:
      "bg-red-950/80 text-red-300 border-red-700/60 shadow-sm shadow-red-950/40",
  };

  const dotColors: Record<string, string> = {
    default: "bg-slate-400",
    superAdmin: "bg-red-400 shadow-sm shadow-red-400/80",
    coordinator: "bg-blue-400 shadow-sm shadow-blue-400/80",
    member: "bg-slate-400",
    approved: "bg-emerald-400 shadow-sm shadow-emerald-400/80",
    pending: "bg-amber-400 shadow-sm shadow-amber-400/80",
    review: "bg-indigo-400 shadow-sm shadow-indigo-400/80",
    rejected: "bg-rose-400 shadow-sm shadow-rose-400/80",
    revision: "bg-orange-400 shadow-sm shadow-orange-400/80",
    planning: "bg-sky-400 shadow-sm shadow-sky-400/80",
    cyan: "bg-cyan-400 shadow-sm shadow-cyan-400/80",
    red: "bg-red-400 shadow-sm shadow-red-400/80",
    gold: "bg-amber-400 shadow-sm shadow-amber-400/80",
    emerald: "bg-emerald-400 shadow-sm shadow-emerald-400/80",
    blue: "bg-blue-400 shadow-sm shadow-blue-400/80",
    success: "bg-emerald-400 shadow-sm shadow-emerald-400/80",
    warning: "bg-amber-400 shadow-sm shadow-amber-400/80",
    danger: "bg-red-400 shadow-sm shadow-red-400/80",
  };

  const sizes = {
    sm: "text-[11px] px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium rounded-md border tracking-wide uppercase font-sans select-none transition-colors",
        variants[variant] || variants.default,
        sizes[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0 animate-pulse-subtle",
            dotColors[variant] || "bg-slate-400"
          )}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
