"use client";

import React, { useState } from "react";
import Link from "next/link";
import { SuperAdminDashboard } from "@/components/dashboard/super-admin-dashboard";
import { CoordinatorDashboard } from "@/components/dashboard/coordinator-dashboard";
import { MemberDashboard } from "@/components/dashboard/member-dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Users, User, ArrowLeft, AlertTriangle } from "lucide-react";

type PreviewRole = "SUPER_ADMIN" | "COORDINATOR" | "MEMBER";

export default function PreviewPage() {
  const [activeRole, setActiveRole] = useState<PreviewRole>("SUPER_ADMIN");

  return (
    <div className="min-h-screen bg-[#0B1020] text-uec-text p-4 lg:p-8 space-y-6">
      {/* Strict Sandbox Warning Header */}
      <div className="max-w-7xl mx-auto p-4 rounded-xl bg-amber-950/50 border border-amber-800/80 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={22} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-amber-200 uppercase tracking-wide">
                Bac à Sable de Prévisualisation UI (Sandbox Isolé)
              </span>
              <Badge variant="pending" size="sm">HORS PRODUCTION</Badge>
            </div>
            <p className="text-xs text-amber-300/80">
              Cet écran est un environnement de prévisualisation strictement visuel.
              Aucune session d'authentification n'est active, aucune donnée Supabase n'est lue ni modifiée,
              et aucune autorisation n'est accordée.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href="/login">
            <Button variant="outline" size="sm" className="text-xs border-amber-800/60 text-amber-300 hover:text-white">
              <ArrowLeft size={14} className="mr-1.5 rtl:rotate-180" />
              Retour à la Connexion
            </Button>
          </Link>
        </div>
      </div>

      {/* Role Switcher Controls for Sandbox UI Evaluation */}
      <div className="max-w-7xl mx-auto bg-[#111827] border border-[#27354F] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white">
            Gabarits de Rôles en Évaluation :
          </span>
          <span className="text-[11px] text-slate-400">
            Sélectionnez la vue à prévisualiser
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveRole("SUPER_ADMIN")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeRole === "SUPER_ADMIN"
                ? "bg-uec-red text-white shadow-md shadow-uec-red/20"
                : "bg-slate-800 text-slate-300 hover:text-white"
            }`}
          >
            <Shield size={13} />
            <span>Super Admin</span>
          </button>

          <button
            onClick={() => setActiveRole("COORDINATOR")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeRole === "COORDINATOR"
                ? "bg-uec-blue text-white shadow-md shadow-uec-blue/20"
                : "bg-slate-800 text-slate-300 hover:text-white"
            }`}
          >
            <Users size={13} />
            <span>Coordinateur</span>
          </button>

          <button
            onClick={() => setActiveRole("MEMBER")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeRole === "MEMBER"
                ? "bg-slate-700 text-white shadow"
                : "bg-slate-800 text-slate-300 hover:text-white"
            }`}
          >
            <User size={13} />
            <span>Membre</span>
          </button>
        </div>
      </div>

      {/* Render Selected View */}
      <div className="max-w-7xl mx-auto">
        {activeRole === "SUPER_ADMIN" && <SuperAdminDashboard />}
        {activeRole === "COORDINATOR" && <CoordinatorDashboard />}
        {activeRole === "MEMBER" && <MemberDashboard />}
      </div>
    </div>
  );
}
