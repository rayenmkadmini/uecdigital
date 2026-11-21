"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth, type UserRole } from "@/lib/auth/auth-context";
import { useTranslation } from "@/lib/i18n/context";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
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
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface AppSidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function AppSidebar({
  collapsed = false,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { role, setDemoRole, isDemoMode, profile } = useAuth();
  const { t, dir } = useTranslation();

  const isSuperAdmin = role === "SUPER_ADMIN";
  const isCoordinator = role === "COORDINATOR";

  const navigationSections = [
    {
      title: t("sections.general"),
      items: [
        {
          title: t("nav.dashboard"),
          href: "/dashboard",
          icon: LayoutDashboard,
          badge: null,
        },
      ],
    },
    {
      title: t("sections.projects_tasks"),
      items: [
        {
          title: t("nav.projects"),
          href: "/dashboard/projects",
          icon: FolderKanban,
          badge: null,
        },
        {
          title: t("nav.tasks"),
          href: "/dashboard/tasks",
          icon: CheckSquare,
          badge: null,
        },
        // Approvals is visible to everyone, but highlighted for Super Admin
        {
          title: t("nav.approvals"),
          href: "/dashboard/approvals",
          icon: ShieldCheck,
          badge: isSuperAdmin ? "EXCLUSIF" : null,
          badgeVariant: "superAdmin" as const,
        },
      ],
    },
    {
      title: t("sections.governance"),
      items: [
        {
          title: t("nav.departments"),
          href: "/dashboard/departments",
          icon: Building2,
          badge: null,
        },
        {
          title: t("nav.users"),
          href: "/dashboard/users",
          icon: Users,
          badge: null,
        },
        {
          title: t("nav.requests"),
          href: "/dashboard/requests",
          icon: Inbox,
          badge: null,
        },
      ],
    },
    {
      title: t("sections.resources"),
      items: [
        {
          title: t("nav.media"),
          href: "/dashboard/media",
          icon: FolderArchive,
          badge: null,
        },
        {
          title: t("nav.calendar"),
          href: "/dashboard/calendar",
          icon: Calendar,
          badge: null,
        },
        {
          title: t("nav.meetings"),
          href: "/dashboard/meetings",
          icon: Users2,
          badge: null,
        },
        {
          title: t("nav.equipment"),
          href: "/dashboard/equipment",
          icon: Package,
          badge: null,
        },
        {
          title: t("nav.announcements"),
          href: "/dashboard/announcements",
          icon: Megaphone,
          badge: null,
        },
      ],
    },
    {
      title: t("sections.analytics_audit"),
      items: [
        {
          title: t("nav.analytics"),
          href: "/dashboard/analytics",
          icon: BarChart3,
          badge: null,
        },
        {
          title: t("nav.settings"),
          href: "/dashboard/settings",
          icon: Settings,
          badge: null,
        },
      ],
    },
  ];

  const roleBadgeVariants: Record<UserRole, "superAdmin" | "coordinator" | "member"> = {
    SUPER_ADMIN: "superAdmin",
    COORDINATOR: "coordinator",
    MEMBER: "member",
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 z-50 flex flex-col bg-[#0B1020] border-r border-[#1F2937] transition-all duration-300 select-none",
          dir === "rtl" ? "right-0 border-r-0 border-l" : "left-0",
          collapsed ? "w-20" : "w-64",
          isMobileOpen
            ? "translate-x-0"
            : dir === "rtl"
            ? "translate-x-full lg:translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-[#1F2937]">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 overflow-hidden group"
          >
            <div className="relative h-10 w-10 shrink-0 rounded-lg p-1 bg-[#111827] border border-[#27354F] group-hover:border-uec-red/50 transition-colors">
              <Image
                src="/assets/uec-shield.webp"
                alt="UEC Shield"
                fill
                className="object-contain p-1"
                priority
              />
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-white tracking-wider">UEC</span>
                  <span className="text-xs text-uec-red font-semibold uppercase">Digital</span>
                </div>
                <span className="text-[10px] text-uec-muted truncate tracking-tight">
                  أصحاب الفكرة والعقول
                </span>
              </div>
            )}
          </Link>

          {/* Collapse Button (Desktop) */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 rounded-md text-uec-muted hover:text-white hover:bg-slate-800 transition-colors"
            title={collapsed ? "Agrandir le menu" : "Réduire le menu"}
          >
            {collapsed ? (
              dir === "rtl" ? <ChevronLeft size={16} /> : <ChevronRight size={16} />
            ) : (
              dir === "rtl" ? <ChevronRight size={16} /> : <ChevronLeft size={16} />
            )}
          </button>
        </div>

        {/* User Role Tag Banner */}
        <div className="px-4 py-3 bg-[#111827]/70 border-b border-[#1F2937]">
          {!collapsed ? (
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-uec-muted uppercase">
                  Rôle Actif
                </span>
                <span className="text-xs font-bold text-slate-200 truncate">
                  {profile?.full_name || t(`roles.${role}`)}
                </span>
              </div>
              <Badge variant={roleBadgeVariants[role]}>
                {t(`roles.${role}`)}
              </Badge>
            </div>
          ) : (
            <div className="flex justify-center" title={t(`roles.${role}`)}>
              <span className="h-2.5 w-2.5 rounded-full bg-uec-red animate-pulse" />
            </div>
          )}
        </div>

        {/* Scrollable Navigation Menu */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
          {navigationSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              {!collapsed && (
                <p className="px-3 text-[10px] font-bold text-uec-muted/60 tracking-wider">
                  {section.title}
                </p>
              )}
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group relative",
                      isActive
                        ? "bg-uec-elevated text-white border border-[#27354F] shadow-sm"
                        : "text-slate-400 hover:text-slate-200 hover:bg-[#111827]/60",
                      collapsed && "justify-center px-2"
                    )}
                    title={collapsed ? item.title : undefined}
                  >
                    <Icon
                      size={18}
                      className={cn(
                        "shrink-0 transition-colors",
                        isActive
                          ? "text-uec-red"
                          : "text-slate-400 group-hover:text-slate-200"
                      )}
                    />
                    {!collapsed && (
                      <span className="truncate flex-1">{item.title}</span>
                    )}

                    {!collapsed && item.badge && (
                      <Badge
                        variant={item.badgeVariant || "default"}
                        size="sm"
                        className="text-[9px] py-0 px-1.5"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Role Preview Switcher (Quick Dev Testing) */}
        {!collapsed && isDemoMode && (
          <div className="p-3 mx-3 mb-3 bg-[#111827] border border-[#27354F] rounded-lg">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-400 mb-2">
              <Sparkles size={12} />
              <span>Aperçu de Rôle (Test)</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => setDemoRole("SUPER_ADMIN")}
                className={cn(
                  "text-[10px] py-1 px-1 rounded text-center font-bold transition-all",
                  role === "SUPER_ADMIN"
                    ? "bg-uec-red text-white shadow"
                    : "bg-slate-800/80 text-slate-400 hover:text-white"
                )}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => setDemoRole("COORDINATOR")}
                className={cn(
                  "text-[10px] py-1 px-1 rounded text-center font-bold transition-all",
                  role === "COORDINATOR"
                    ? "bg-uec-blue text-white shadow"
                    : "bg-slate-800/80 text-slate-400 hover:text-white"
                )}
              >
                Coord
              </button>
              <button
                type="button"
                onClick={() => setDemoRole("MEMBER")}
                className={cn(
                  "text-[10px] py-1 px-1 rounded text-center font-bold transition-all",
                  role === "MEMBER"
                    ? "bg-slate-600 text-white shadow"
                    : "bg-slate-800/80 text-slate-400 hover:text-white"
                )}
              >
                Membre
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
