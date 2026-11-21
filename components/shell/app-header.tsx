"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { useTranslation, type Locale } from "@/lib/i18n/context";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Menu,
  Bell,
  Search,
  Globe,
  LogOut,
  User as UserIcon,
  ChevronDown,
  Shield,
  Layers,
} from "lucide-react";

interface AppHeaderProps {
  onOpenMobileMenu: () => void;
  collapsed?: boolean;
}

export function AppHeader({ onOpenMobileMenu, collapsed = false }: AppHeaderProps) {
  const pathname = usePathname();
  const { profile, role, signOut, isDemoMode } = useAuth();
  const { locale, setLocale, t, dir } = useTranslation();
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Derive breadcrumb from pathname
  const pathSegments = pathname.split("/").filter(Boolean);
  const currentPageKey = pathSegments[pathSegments.length - 1] || "dashboard";

  const languages: { code: Locale; label: string; flag: string }[] = [
    { code: "fr", label: "Français", flag: "🇫🇷" },
    { code: "ar", label: "العربية", flag: "🇹🇳" },
    { code: "en", label: "English", flag: "🇬🇧" },
  ];

  return (
    <header className="h-16 bg-[#0B1020]/90 backdrop-blur-md border-b border-[#1F2937] px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Mobile hamburger & Page Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          aria-label="Ouvrir le menu"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/dashboard"
            className="text-uec-muted hover:text-white transition-colors flex items-center gap-1 font-medium text-xs lg:text-sm"
          >
            <span>UEC</span>
            <span>/</span>
          </Link>
          <span className="font-semibold text-white text-xs lg:text-sm capitalize">
            {t(`nav.${currentPageKey}`) || currentPageKey}
          </span>
        </div>
      </div>

      {/* Right: Actions (Search, Language, Notifications, User) */}
      <div className="flex items-center gap-2 lg:gap-3">
        {/* Quick Search */}
        <div className="hidden md:flex items-center relative">
          <Search
            size={15}
            className="absolute left-3 rtl:left-auto rtl:right-3 text-uec-muted pointer-events-none"
          />
          <input
            type="text"
            placeholder={t("actions.search")}
            className="bg-[#111827] text-xs text-white placeholder-uec-muted/50 rounded-lg pl-9 pr-4 rtl:pl-4 rtl:pr-9 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none w-44 lg:w-56 transition-all"
          />
        </div>

        {/* Language Switcher */}
        <div className="relative">
          <button
            onClick={() => {
              setIsLangOpen(!isLangOpen);
              setIsUserMenuOpen(false);
              setIsNotificationsOpen(false);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#111827] border border-[#1F2937] transition-all"
            aria-label="Changer de langue"
          >
            <Globe size={14} className="text-uec-cyan" />
            <span className="uppercase">{locale}</span>
            <ChevronDown size={12} className="text-slate-400" />
          </button>

          {isLangOpen && (
            <div
              className={`absolute top-full mt-2 w-36 bg-[#111827] border border-[#27354F] rounded-lg shadow-xl shadow-black/60 py-1 z-50 ${
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
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left rtl:text-right hover:bg-slate-800 transition-colors ${
                    locale === lang.code
                      ? "text-uec-red font-bold bg-slate-800/40"
                      : "text-slate-300"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </span>
                  {locale === lang.code && <span className="text-[10px]">✓</span>}
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
            className="relative p-2 text-slate-400 hover:text-white hover:bg-[#111827] rounded-lg border border-[#1F2937] transition-all"
            aria-label="Notifications"
          >
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 rtl:right-auto rtl:left-1.5 h-2 w-2 rounded-full bg-uec-red ring-2 ring-[#0B1020]" />
          </button>

          {isNotificationsOpen && (
            <div
              className={`absolute top-full mt-2 w-80 bg-[#111827] border border-[#27354F] rounded-xl shadow-2xl shadow-black/80 p-3 z-50 ${
                dir === "rtl" ? "left-0" : "right-0"
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#1F2937]">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Notifications
                </span>
                <span className="text-[10px] text-uec-cyan font-semibold cursor-pointer hover:underline">
                  Tout marquer comme lu
                </span>
              </div>
              <div className="py-2 space-y-2 text-xs text-slate-300">
                <div className="p-2 rounded-lg bg-slate-800/40 border border-[#1F2937] hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between text-[10px] text-uec-muted mb-1">
                    <span className="text-uec-red font-semibold">Validation Requise</span>
                    <span>Il y a 10 min</span>
                  </div>
                  <p className="text-xs text-white font-medium">
                    Nouveau livrable vidéo soumis pour la campagne d'adhésion.
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-slate-800/40 border border-[#1F2937] hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between text-[10px] text-uec-muted mb-1">
                    <span className="text-uec-blue font-semibold">Projet Actif</span>
                    <span>Il y a 1h</span>
                  </div>
                  <p className="text-xs text-white font-medium">
                    Sprint Refonte Web UEC mis à jour par le coordinateur.
                  </p>
                </div>
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
            className="flex items-center gap-2 p-1 pl-2 rtl:pl-1 rtl:pr-2 rounded-lg border border-[#1F2937] hover:border-slate-700 bg-[#111827]/80 hover:bg-[#111827] transition-all"
          >
            <Avatar name={profile?.full_name || "UEC"} size="sm" />
            <div className="hidden sm:flex flex-col text-left rtl:text-right">
              <span className="text-xs font-bold text-white truncate max-w-[120px]">
                {profile?.full_name?.split(" ")[0] || "Membre"}
              </span>
              <span className="text-[10px] text-uec-muted uppercase">
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
              className={`absolute top-full mt-2 w-64 bg-[#111827] border border-[#27354F] rounded-xl shadow-2xl shadow-black/80 py-2 z-50 ${
                dir === "rtl" ? "left-0" : "right-0"
              }`}
            >
              <div className="px-4 py-2 border-b border-[#1F2937]">
                <p className="text-xs font-bold text-white truncate">
                  {profile?.full_name}
                </p>
                <p className="text-[11px] text-uec-muted truncate">{profile?.email}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Badge
                    variant={
                      role === "SUPER_ADMIN"
                        ? "superAdmin"
                        : role === "COORDINATOR"
                        ? "coordinator"
                        : "member"
                    }
                    size="sm"
                  >
                    {t(`roles.${role}`)}
                  </Badge>
                  {isDemoMode && (
                    <span className="text-[9px] text-cyan-400 font-semibold px-1 py-0.5 rounded bg-cyan-950/60 border border-cyan-800">
                      PREVIEW
                    </span>
                  )}
                </div>
              </div>

              <div className="py-1">
                <Link
                  href="/dashboard/settings"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <UserIcon size={14} className="text-slate-400" />
                  <span>Mon Profil & Préférences</span>
                </Link>
                {role === "SUPER_ADMIN" && (
                  <Link
                    href="/dashboard/approvals"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-uec-red font-semibold hover:bg-slate-800 transition-colors"
                  >
                    <Shield size={14} />
                    <span>File d'Approbation Super Admin</span>
                  </Link>
                )}
              </div>

              <div className="pt-1 border-t border-[#1F2937]">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    signOut();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-colors"
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
  );
}
