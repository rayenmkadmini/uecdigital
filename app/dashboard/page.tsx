"use client";

import React from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { SuperAdminDashboard } from "@/components/dashboard/super-admin-dashboard";
import { CoordinatorDashboard } from "@/components/dashboard/coordinator-dashboard";
import { MemberDashboard } from "@/components/dashboard/member-dashboard";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Shield, Users, User } from "lucide-react";

export default function DashboardPage() {
  const { role, setDemoRole, isDemoMode, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <div className="h-8 w-8 rounded-full border-2 border-uec-red border-t-transparent animate-spin" />
        <p className="text-xs text-uec-muted font-medium">Chargement de votre espace...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Demo Perspective Switcher Bar */}
      {isDemoMode && (
        <div className="bg-[#111827] border border-[#27354F] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-cyan-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-white">
                Banc d'Essai Multi-Rôles UEC Espace Digital
              </p>
              <p className="text-[11px] text-slate-400">
                Basculez instantanément pour tester la gouvernance et l'affichage de chaque profil
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-center">
            <button
              onClick={() => setDemoRole("SUPER_ADMIN")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                role === "SUPER_ADMIN"
                  ? "bg-uec-red text-white shadow-md shadow-uec-red/20"
                  : "bg-slate-800 text-slate-300 hover:text-white"
              }`}
            >
              <Shield size={13} />
              <span>Super Admin</span>
            </button>

            <button
              onClick={() => setDemoRole("COORDINATOR")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                role === "COORDINATOR"
                  ? "bg-uec-blue text-white shadow-md shadow-uec-blue/20"
                  : "bg-slate-800 text-slate-300 hover:text-white"
              }`}
            >
              <Users size={13} />
              <span>Coordinateur</span>
            </button>

            <button
              onClick={() => setDemoRole("MEMBER")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                role === "MEMBER"
                  ? "bg-slate-700 text-white shadow"
                  : "bg-slate-800 text-slate-300 hover:text-white"
              }`}
            >
              <User size={13} />
              <span>Membre</span>
            </button>
          </div>
        </div>
      )}

      {/* Role View Render */}
      {role === "SUPER_ADMIN" && <SuperAdminDashboard />}
      {role === "COORDINATOR" && <CoordinatorDashboard />}
      {role === "MEMBER" && <MemberDashboard />}
    </div>
  );
}
