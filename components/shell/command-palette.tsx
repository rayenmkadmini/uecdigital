"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/context";
import { useAuth } from "@/lib/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Search,
  X,
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  ShieldCheck,
  Building2,
  Users,
  Inbox,
  FolderArchive,
  Calendar,
  Users2,
  Package,
  Megaphone,
  BarChart3,
  Settings,
  CornerDownLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PaletteItem {
  id: string;
  titleKey: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  sectionKey: string;
  descKey: string;
  keywords: string[];
  roleRequired?: "SUPER_ADMIN" | "COORDINATOR";
  badge?: string;
  badgeVariant?: "superAdmin" | "coordinator" | "gold" | "cyan" | "default";
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { t, dir } = useTranslation();
  const { role } = useAuth();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isSuperAdmin = role === "SUPER_ADMIN";

  const allItems: PaletteItem[] = useMemo(
    () => [
      // 1. Projects
      {
        id: "projects",
        titleKey: "nav.projects",
        href: "/dashboard/projects",
        icon: FolderKanban,
        sectionKey: "sections.projects_tasks",
        descKey: "commandPalette.descriptions.projects",
        keywords: ["projets", "projects", "kanban", "jalons", "budget", "مشاريع"],
      },
      // 2. Tasks
      {
        id: "tasks",
        titleKey: "nav.tasks",
        href: "/dashboard/tasks",
        icon: CheckSquare,
        sectionKey: "sections.projects_tasks",
        descKey: "commandPalette.descriptions.tasks",
        keywords: ["taches", "tasks", "livrables", "todo", "done", "missions", "مهام"],
      },
      // 3. Approvals
      {
        id: "approvals",
        titleKey: "nav.approvals",
        href: "/dashboard/approvals",
        icon: ShieldCheck,
        sectionKey: "sections.projects_tasks",
        descKey: "commandPalette.descriptions.approvals",
        keywords: ["approbations", "approvals", "validation", "superadmin", "arbitrage", "مصادقة"],
        badge: isSuperAdmin ? t("commandPalette.exclusive") : t("commandPalette.admin"),
        badgeVariant: "superAdmin",
      },
      // 4. Calendar
      {
        id: "calendar",
        titleKey: "nav.calendar",
        href: "/dashboard/calendar",
        icon: Calendar,
        sectionKey: "sections.resources",
        descKey: "commandPalette.descriptions.calendar",
        keywords: ["calendrier", "calendar", "planning", "editorial", "dates", "evenements", "تقويم"],
      },
      // 5. Media
      {
        id: "media",
        titleKey: "nav.media",
        href: "/dashboard/media",
        icon: FolderArchive,
        sectionKey: "sections.resources",
        descKey: "commandPalette.descriptions.media",
        keywords: ["media", "assets", "photos", "videos", "fichiers", "mediatheque", "مكتبة"],
      },
      // 6. Equipment
      {
        id: "equipment",
        titleKey: "nav.equipment",
        href: "/dashboard/equipment",
        icon: Package,
        sectionKey: "sections.resources",
        descKey: "commandPalette.descriptions.equipment",
        keywords: ["materiel", "equipment", "cameras", "prets", "inventaire", "regie", "معدات"],
      },
      // 7. Meetings
      {
        id: "meetings",
        titleKey: "nav.meetings",
        href: "/dashboard/meetings",
        icon: Users2,
        sectionKey: "sections.resources",
        descKey: "commandPalette.descriptions.meetings",
        keywords: ["reunions", "meetings", "pv", "assemblee", "ag", "emargement", "اجتماعات"],
      },
      // 8. Requests
      {
        id: "requests",
        titleKey: "nav.requests",
        href: "/dashboard/requests",
        icon: Inbox,
        sectionKey: "sections.governance",
        descKey: "commandPalette.descriptions.requests",
        keywords: ["demandes", "requests", "achats", "besoins", "requetes", "validation", "طلبات"],
      },
      // 9. Departments
      {
        id: "departments",
        titleKey: "nav.departments",
        href: "/dashboard/departments",
        icon: Building2,
        sectionKey: "sections.governance",
        descKey: "commandPalette.descriptions.departments",
        keywords: ["departements", "poles", "departments", "structure", "equipes", "اقسام"],
      },
      // 10. Members
      {
        id: "users",
        titleKey: "nav.users",
        href: "/dashboard/users",
        icon: Users,
        sectionKey: "sections.governance",
        descKey: "commandPalette.descriptions.users",
        keywords: ["membres", "users", "utilisateurs", "roles", "annuaire", "اعضاء"],
        badge: isSuperAdmin ? t("commandPalette.admin") : undefined,
        badgeVariant: isSuperAdmin ? "superAdmin" : undefined,
      },
      // 11. Analytics
      {
        id: "analytics",
        titleKey: "nav.analytics",
        href: "/dashboard/analytics",
        icon: BarChart3,
        sectionKey: "sections.analytics_audit",
        descKey: "commandPalette.descriptions.analytics",
        keywords: ["analytics", "statistiques", "audit", "rapports", "kpi", "suivi", "تحليلات"],
      },
      // 12. Announcements
      {
        id: "announcements",
        titleKey: "nav.announcements",
        href: "/dashboard/announcements",
        icon: Megaphone,
        sectionKey: "sections.resources",
        descKey: "commandPalette.descriptions.announcements",
        keywords: ["annonces", "announcements", "actualites", "news", "communiques", "اعلانات"],
      },
      // Home & Settings
      {
        id: "dashboard",
        titleKey: "nav.dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        sectionKey: "sections.general",
        descKey: "commandPalette.descriptions.dashboard",
        keywords: ["dashboard", "accueil", "home", "vue generale", "tableau bord", "لوحة"],
      },
      {
        id: "settings",
        titleKey: "nav.settings",
        href: "/dashboard/settings",
        icon: Settings,
        sectionKey: "sections.general",
        descKey: "commandPalette.descriptions.settings",
        keywords: ["settings", "parametres", "profil", "securite", "compte", "اعدادات"],
      },
    ],
    [isSuperAdmin, t]
  );

  // Filter items according to search query
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;

    return allItems.filter((item) => {
      const title = t(item.titleKey).toLowerCase();
      const section = t(item.sectionKey).toLowerCase();
      const desc = t(item.descKey).toLowerCase();
      const matchKeyword = item.keywords.some((kw) => kw.toLowerCase().includes(q));

      return (
        title.includes(q) ||
        section.includes(q) ||
        desc.includes(q) ||
        matchKeyword ||
        item.href.toLowerCase().includes(q)
      );
    });
  }, [allItems, query, t]);

  // Reset selected index when filtered items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const handleSelect = (item: PaletteItem) => {
    router.push(item.href);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-black/80 backdrop-blur-md transition-all animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("commandPalette.searchPlaceholder")}
    >
      <div
        className="w-full max-w-2xl bg-[#0e0e12] border border-white/10 rounded-2xl shadow-2xl shadow-black/90 overflow-hidden flex flex-col text-white ring-1 ring-white/10 transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Top Search Input Box */}
        <div className="flex items-center px-4 py-3.5 border-b border-white/10 bg-[#111827]/60 gap-3">
          <Search size={18} className="text-uec-cyan shrink-0 animate-pulse-subtle" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("commandPalette.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm lg:text-base text-white placeholder-slate-500 focus:outline-none"
            aria-autocomplete="list"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/5 transition-colors"
              aria-label={t("commandPalette.clear")}
            >
              <X size={15} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded shadow-sm">
            ESC
          </kbd>
        </div>

        {/* Results / Navigation List */}
        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto p-2 space-y-1 divide-y divide-white/[0.04]"
          role="listbox"
        >
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Sparkles size={28} className="mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-white">
                {t("commandPalette.noResults")}
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {t("commandPalette.noResultsDesc")}
              </p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const IconComponent = item.icon;

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-150 group relative",
                    isSelected
                      ? "bg-gradient-to-r from-[#172033] to-[#111827] text-white shadow-md shadow-black/40 border border-white/10"
                      : "text-slate-300 hover:bg-white/[0.03] border border-transparent"
                  )}
                  role="option"
                  aria-selected={isSelected}
                >
                  {/* Left active indicator pill */}
                  {isSelected && (
                    <span
                      className="absolute left-0 rtl:left-auto rtl:right-0 top-2 bottom-2 w-1 bg-gradient-to-b from-uec-red via-uec-blue to-uec-cyan rounded-full"
                      aria-hidden="true"
                    />
                  )}

                  <div className="flex items-center gap-3 min-w-0 pl-2 rtl:pl-0 rtl:pr-2">
                    <div
                      className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center border shrink-0 transition-colors duration-200",
                        isSelected
                          ? "bg-uec-red/20 text-white border-uec-red/40 shadow-sm shadow-uec-red/20"
                          : "bg-white/5 text-slate-400 border-white/10 group-hover:text-white group-hover:border-white/20"
                      )}
                    >
                      <IconComponent size={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs lg:text-sm font-bold text-white tracking-tight truncate">
                          {t(item.titleKey)}
                        </span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider hidden sm:inline">
                          • {t(item.sectionKey)}
                        </span>
                        {item.badge && (
                          <Badge
                            variant={item.badgeVariant || "superAdmin"}
                            size="sm"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {t(item.descKey)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pr-2 rtl:pr-0 rtl:pl-2">
                    {isSelected ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-uec-cyan bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded-md">
                        <CornerDownLeft size={12} className="rtl:rotate-180" />
                        <span className="hidden sm:inline">{t("commandPalette.open")}</span>
                      </span>
                    ) : (
                      <ChevronRight
                        size={15}
                        className="text-slate-600 group-hover:text-slate-300 transition-colors rtl:rotate-180"
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Command Palette Footer */}
        <div className="px-4 py-2.5 bg-[#0B1020]/90 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-white/5 border border-white/10 px-1 py-0.2 rounded text-[10px]">
                ↑↓
              </kbd>
              <span className="hidden sm:inline">{t("commandPalette.navigate")}</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-white/5 border border-white/10 px-1 py-0.2 rounded text-[10px]">
                ↵
              </kbd>
              <span className="hidden sm:inline">{t("commandPalette.select")}</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-white/5 border border-white/10 px-1 py-0.2 rounded text-[10px]">
                ESC
              </kbd>
              <span className="hidden sm:inline">{t("commandPalette.close")}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-semibold text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-uec-red animate-pulse" />
            <span className="text-[10px] uppercase tracking-wider text-slate-400">
              UEC Digital
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
