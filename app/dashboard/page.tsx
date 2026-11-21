"use client";

import React from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { SuperAdminDashboard } from "@/components/dashboard/super-admin-dashboard";
import { CoordinatorDashboard } from "@/components/dashboard/coordinator-dashboard";
import { MemberDashboard } from "@/components/dashboard/member-dashboard";

export default function DashboardPage() {
  const { role, loading } = useAuth();

  if (loading || !role) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <div className="h-8 w-8 rounded-full border-2 border-uec-red border-t-transparent animate-spin" />
        <p className="text-xs text-uec-muted font-medium">Chargement de votre espace sécurisé...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dynamic Role Dashboard rendering based exclusively on trusted database role */}
      {role === "SUPER_ADMIN" && <SuperAdminDashboard />}
      {role === "COORDINATOR" && <CoordinatorDashboard />}
      {role === "MEMBER" && <MemberDashboard />}
    </div>
  );
}
