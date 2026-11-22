"use client";

import React, { useState } from "react";
import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";
import { useTranslation } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { dir } = useTranslation();

  return (
    <div className="min-h-screen bg-[#0B1020] text-uec-text flex">
      {/* Sidebar */}
      <AppSidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 min-h-screen transition-all duration-300",
          dir === "rtl"
            ? collapsed
              ? "lg:mr-20"
              : "lg:mr-64"
            : collapsed
            ? "lg:ml-20"
            : "lg:ml-64"
        )}
      >
        {/* Header */}
        <AppHeader
          collapsed={collapsed}
          onOpenMobileMenu={() => setIsMobileOpen(true)}
        />

        {/* Page View Container */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-8">
            {children}
          </div>
        </main>

        {/* Enterprise Platform Footer */}
        <footer className="py-4 px-6 border-t border-[#1F2937] text-xs text-uec-muted flex flex-col sm:flex-row items-center justify-between gap-2 bg-[#0B1020]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">UEC — Espace Digital</span>
            <span>•</span>
            <span className="text-slate-400">Union des Étudiants Clubistes</span>
            <span>•</span>
            <span className="text-uec-red font-semibold">Depuis 2021</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>أصحاب الفكرة والعقول</span>
            <span>•</span>
            <span>v1.0.0 Enterprise</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
