"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  icon,
  badge,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-3 pb-4 border-b border-[#1F2937]/70", className)}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          aria-label="Fil d'Ariane"
          className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium"
        >
          <Link
            href="/dashboard"
            className="hover:text-slate-200 transition-colors flex items-center gap-1"
          >
            <Home size={12} />
            <span>UEC</span>
          </Link>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              <ChevronRight size={11} className="text-slate-600 rtl:rotate-180" />
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="hover:text-slate-200 transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-slate-300 font-semibold">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Main Title Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center flex-wrap gap-2.5">
            {icon && (
              <div className="h-9 w-9 rounded-xl bg-[#111827] border border-[#1F2937] flex items-center justify-center text-uec-red shadow-md shadow-black/40 shrink-0">
                {icon}
              </div>
            )}
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              {title}
            </h1>
            {badge && <div>{badge}</div>}
          </div>
          {subtitle && (
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
