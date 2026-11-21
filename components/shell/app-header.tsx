"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { useTranslation, type Locale } from "@/lib/i18n/context";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CommandPalette } from "@/components/shell/command-palette";
import { createClient } from "@/lib/supabase/client";
import { markAllNotificationsAsReadAction } from "@/app/actions/notifications";
import {
  Menu,
  Bell,
  Search,
  Globe,
  LogOut,
  User as UserIcon,
  ChevronDown,
  Shield,
  Command,
} from "lucide-react";

interface AppHeaderProps {
  onOpenMobileMenu: () => void;
  collapsed?: boolean;
}

export function AppHeader({ onOpenMobileMenu, collapsed = false }: AppHeaderProps) {
  const pathname = usePathname();
  const { profile, role, signOut } = useAuth();
  const { locale, setLocale, t, dir } = useTranslation();
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    const supabase = createClient();

    const fetchNotifs = async () => {
      const { data } = await (supabase.from("notifications") as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter((n: any) => !n.is_read).length);
      }
    };

    fetchNotifs();
  }, [profile?.id]);

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsReadAction();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  // Derive breadcrumb from pathname
  const pathSegments = pathname.split("/").filter(Boolean);
  const currentPageKey = pathSegments[pathSegments.length - 1] || "dashboard";

  const languages: { code: Locale; label: string; flag: string }[] = [
    { code: "fr", label: "Français", flag: "🇫🇷" },
    { code: "ar", label: "العربية", flag: "🇹🇳" },
    { code: "en", label: "English", flag: "🇬🇧" },
  ];

  return (
    <>
      <header className="h-16 bg-[#0B1020]/95 backdrop-blur-md border-b border-white/10 px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30 shadow-md shadow-black/30">
        {/* Left: Mobile hamburger & Page Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg border border-white/10 transition-colors"
            aria-label="Ouvrir le menu"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-2 text-sm">
            <Link
              href="/dashboard"
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 font-semibold text-xs lg:text-sm tracking-wide"
            >
              <span>UEC</span>
              <span className="text-slate-600">/</span>
            </Link>
            <span className="font-bold text-white text-xs lg:text-sm capitalize truncate max-w-[150px] sm:max-w-none">
              {t(`nav.${currentPageKey}`) || currentPageKey}
            </span>
          </div>
        </div>

        {/* Right: Actions (Search/Command Palette, Language, Notifications, User) */}
        <div className="flex items-center gap-2 lg:gap-3">
          {/* Quick Search / Command Palette Desktop Trigger */}
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="hidden md:flex items-center justify-between gap-3 bg-[#0e0e12]/90 hover:bg-[#172033] text-xs text-slate-400 hover:text-white rounded-lg px-3 py-2 border border-white/10 hover:border-uec-red/40 transition-all duration-200 w-48 lg:w-64 group shadow-sm shadow-black/40 cursor-pointer"
            aria-label={t("commandPalette.searchPlaceholder")}
          >
            <span className="flex items-center gap-2 truncate">
              <Search
                size={14}
                className="text-uec-cyan group-hover:text-uec-red transition-colors shrink-0"
              />
              <span className="truncate">{t("actions.search") || "Rechercher..."}</span>
            </span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono font-medium text-slate-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded shadow-sm group-hover:border-white/20">
              <Command size={10} className="inline" />
              <span>K</span>
            </kbd>
          </button>

          {/* Quick Search Mobile Trigger */}
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg border border-white/10 transition-all"
            aria-label="Rechercher"
          >
            <Search size={16} />
          </button>

          {/* Language Switcher */}
          <div className="relative">
            <button
              onClick={() => {
                setIsLangOpen(!isLangOpen);
                setIsUserMenuOpen(false);
                setIsNotificationsOpen(false);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 border border-white/10 transition-all"
              aria-label="Changer de langue"
            >
              <Globe size={14} className="text-uec-cyan" />
              <span className="uppercase">{locale}</span>
              <ChevronDown size={12} className="text-slate-400" />
            </button>

            {isLangOpen && (
              <div
                className={`absolute top-full mt-2 w-36 bg-[#0e0e12] border border-white/10 rounded-xl shadow-2xl shadow-black/80 py-1.5 z-50 backdrop-blur-xl ${
                  dir === "rtl" ? "left-0" : "right-0"
                }`}
              >
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLocale(lang.code);
                      setIsLangOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left rtl:text-right hover:bg-white/5 transition-colors ${
                      locale === lang.code
                        ? "text-uec-red font-bold bg-white/[0.04]"
                        : "text-slate-300"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                    </span>
                    {locale === lang.code && <span className="text-[10px] text-uec-red">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => {
                setIsNotificationsOpen(!isNotificationsOpen);
                setIsLangOpen(false);
                setIsUserMenuOpen(false);
              }}
              className="relative p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg border border-white/10 transition-all"
              aria-label="Notifications"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 rtl:right-auto rtl:left-1.5 h-2 w-2 rounded-full bg-uec-red ring-2 ring-[#0B1020] animate-pulse" />
              )}
            </button>

            {isNotificationsOpen && (
              <div
                className={`absolute top-full mt-2 w-80 sm:w-96 bg-[#0e0e12] border border-white/10 rounded-2xl shadow-2xl shadow-black/90 p-3.5 z-50 backdrop-blur-xl ${
                  dir === "rtl" ? "left-0" : "right-0"
                }`}
              >
                <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-bold bg-uec-red/20 text-uec-red border border-uec-red/40 px-1.5 py-0.2 rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-uec-cyan font-semibold hover:underline"
                    >
                      Tout marquer comme lu
                    </button>
                  )}
                </div>

                <div className="py-2 space-y-2 text-xs max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs space-y-1">
                      <p className="font-semibold text-slate-400">Toutes les notifications sont lues</p>
                      <p className="text-[11px]">Aucun nouveau message pour le moment.</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-2.5 rounded-xl border transition-colors ${
                          n.is_read
                            ? "bg-white/[0.02] border-white/5 text-slate-400"
                            : "bg-[#172033]/80 border-blue-600/40 text-slate-200 shadow-sm shadow-black/40"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] mb-1">
                          <span className="font-bold text-uec-cyan truncate max-w-[180px]">{n.title}</span>
                          <span className="text-slate-500 shrink-0">
                            {new Date(n.created_at).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-white/90 leading-relaxed">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => {
                setIsUserMenuOpen(!isUserMenuOpen);
                setIsLangOpen(false);
                setIsNotificationsOpen(false);
              }}
              className="flex items-center gap-2 p-1 pl-2 rtl:pl-1 rtl:pr-2 rounded-xl border border-white/10 hover:border-white/20 bg-[#0e0e12]/80 hover:bg-[#172033] transition-all"
            >
              <Avatar name={profile?.full_name || "UEC"} size="sm" />
              <div className="hidden sm:flex flex-col text-left rtl:text-right">
                <span className="text-xs font-bold text-white truncate max-w-[120px]">
                  {profile?.full_name?.split(" ")[0] || "Membre"}
                </span>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">
                  {role === "SUPER_ADMIN"
                    ? "Admin"
                    : role === "COORDINATOR"
                    ? "Coord"
                    : "Membre"}
                </span>
              </div>
              <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
            </button>

            {isUserMenuOpen && (
              <div
                className={`absolute top-full mt-2 w-64 bg-[#0e0e12] border border-white/10 rounded-2xl shadow-2xl shadow-black/90 py-2.5 z-50 backdrop-blur-xl ${
                  dir === "rtl" ? "left-0" : "right-0"
                }`}
              >
                <div className="px-4 py-2 border-b border-white/10">
                  <p className="text-xs font-bold text-white truncate">
                    {profile?.full_name}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">{profile?.email}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    {role && (
                      <Badge
                        variant={
                          role === "SUPER_ADMIN"
                            ? "superAdmin"
                            : role === "COORDINATOR"
                            ? "coordinator"
                            : "member"
                        }
                        size="sm"
                        dot
                      >
                        {t(`roles.${role}`)}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="py-1">
                  <Link
                    href="/dashboard/settings"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <UserIcon size={14} className="text-slate-400" />
                    <span>{t("nav.settings")}</span>
                  </Link>
                  {role === "SUPER_ADMIN" && (
                    <Link
                      href="/dashboard/approvals"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-uec-red font-semibold hover:bg-red-950/20 transition-colors"
                    >
                      <Shield size={14} />
                      <span>{t("nav.approvals")}</span>
                    </Link>
                  )}
                </div>

                <div className="pt-1.5 border-t border-white/10">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      signOut();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-colors cursor-pointer"
                  >
                    <LogOut size={14} />
                    <span>{t("nav.logout")}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Command Palette Dialog */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </>
  );
}
