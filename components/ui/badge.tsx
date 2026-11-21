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
    | "red";
  size?: "sm" | "md";
}

export function Badge({
  className,
  variant = "default",
  size = "sm",
  children,
  ...props
}: BadgeProps) {
  const variants = {
    default: "bg-uec-surface text-uec-muted border-uec-border",
    superAdmin:
      "bg-red-950/70 text-red-300 border-red-800/60 shadow-sm shadow-red-900/30",
    coordinator:
      "bg-blue-950/70 text-blue-300 border-blue-800/60 shadow-sm shadow-blue-900/30",
    member:
      "bg-slate-800 text-slate-300 border-slate-700",
    approved:
      "bg-emerald-950/70 text-emerald-300 border-emerald-800/60",
    pending:
      "bg-amber-950/70 text-amber-300 border-amber-800/60",
    review:
      "bg-indigo-950/70 text-indigo-300 border-indigo-800/60",
    rejected:
      "bg-rose-950/70 text-rose-300 border-rose-800/60",
    revision:
      "bg-orange-950/70 text-orange-300 border-orange-800/60",
    planning:
      "bg-sky-950/70 text-sky-300 border-sky-800/60",
    cyan:
      "bg-cyan-950/70 text-cyan-300 border-cyan-800/60",
    red:
      "bg-uec-red/20 text-red-200 border-uec-red/40",
  };

  const sizes = {
    sm: "text-[11px] px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium rounded-md border tracking-wide uppercase font-sans select-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
