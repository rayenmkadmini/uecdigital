"use client";

import React, { useState } from "react";
import Link from "next/link";
import { SuperAdminDashboard } from "@/components/dashboard/super-admin-dashboard";
import { CoordinatorDashboard } from "@/components/dashboard/coordinator-dashboard";
import { MemberDashboard } from "@/components/dashboard/member-dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Users, User, ArrowLeft, AlertTriangle } from "lucide-react";
import type {
  SuperAdminDashboardData,
  CoordinatorDashboardData,
  MemberDashboardData,
} from "@/lib/data/dashboard";

type PreviewRole = "SUPER_ADMIN" | "COORDINATOR" | "MEMBER";

const MOCK_SUPER_ADMIN_DATA: SuperAdminDashboardData = {
  totalActiveMembers: 34,
  totalDepartments: 6,
  totalProjects: 15,
  pendingApprovalsCount: 2,
  pendingApprovals: [
    {
      id: "demo-sub-1",
      taskTitle: "Affiche Officielle — Derby Tunisien 2026",
      projectTitle: "Campagne Visuelle Derby",
      department: "Créatif & Design",
      submittedBy: "Yassine Ayari (Designer)",
      submittedAt: "Il y a 35 min",
      version: 2,
      notes: "Modifications des contrastes et ajout des sponsors officiels validées par le coordinateur.",
    },
    {
      id: "demo-sub-2",
      taskTitle: "Teaser Vidéo — Lancement Espace Digital",
      projectTitle: "Communication Digitale UEC",
      department: "Audiovisuel & Montage",
      submittedBy: "Karim Zouari (Monteur Vidéo)",
      submittedAt: "Il y a 2 heures",
      version: 1,
      notes: "Étalonnage aux couleurs rouge et bleu UEC, rendu final 4K 60fps.",
    },
  ],
  departmentBreakdown: [
    {
      code: "DESIGN",
      name: "Pôle Créatif & Design",
      coordinator: "Nourhene Trabelsi",
      activeProjects: 4,
      pendingTasks: 8,
      progress: 82,
      color: "#D62839",
    },
    {
      code: "VIDEO",
      name: "Pôle Audiovisuel & Montage",
      coordinator: "Fares Mansouri",
      activeProjects: 3,
      pendingTasks: 5,
      progress: 74,
      color: "#2563EB",
    },
    {
      code: "WEB",
      name: "Pôle Développement Web & Systèmes",
      coordinator: "Aziz Gharbi",
      activeProjects: 2,
      pendingTasks: 7,
      progress: 90,
      color: "#22D3EE",
    },
    {
      code: "STRATEGY",
      name: "Stratégie & Communication Digitale",
      coordinator: "Sarra Ben Amor",
      activeProjects: 3,
      pendingTasks: 4,
      progress: 68,
      color: "#F59E0B",
    },
    {
      code: "SOCIAL_MEDIA",
      name: "Réseaux Sociaux & Modération",
      coordinator: "Mehdi Bouzid",
      activeProjects: 2,
      pendingTasks: 6,
      progress: 85,
      color: "#8B5CF6",
    },
    {
      code: "INNOVATION",
      name: "Innovation & Projets Numériques",
      coordinator: "Mohamed Ali Dridi",
      activeProjects: 1,
      pendingTasks: 3,
      progress: 60,
      color: "#10B981",
    },
  ],
};

const MOCK_COORDINATOR_DATA: CoordinatorDashboardData = {
  departmentName: "Pôle Créatif & Design",
  departmentCode: "DESIGN",
  memberCount: 8,
  activeProjectCount: 4,
  tasksAwaitingReviewCount: 2,
  teamSubmissions: [
    {
      id: "demo-team-1",
      taskTitle: "Pack Visuel Réseaux — Derby 2026",
      assignee: "Yassine Ayari",
      submittedAt: "Il y a 45 min",
      version: 1,
      description: "Format 1080x1350 et Stories Instagram avec la charte officielle UEC.",
    },
    {
      id: "demo-team-2",
      taskTitle: "Bannière Officielle Site Web 2026",
      assignee: "Mariem Cherif",
      submittedAt: "Il y a 3 heures",
      version: 2,
      description: "Correction des marges et intégration de la nouvelle typographie UEC.",
    },
  ],
  teamMembers: [
    { id: "tm-1", name: "Yassine Ayari", role: "MEMBER", email: "yassine.a@uec.tn", avatarUrl: null, activeTaskCount: 3 },
    { id: "tm-2", name: "Mariem Cherif", role: "MEMBER", email: "mariem.c@uec.tn", avatarUrl: null, activeTaskCount: 2 },
    { id: "tm-3", name: "Selim Mansour", role: "MEMBER", email: "selim.m@uec.tn", avatarUrl: null, activeTaskCount: 1 },
  ],
};

const MOCK_MEMBER_DATA: MemberDashboardData = {
  assignedTaskCount: 3,
  upcomingDeadlineCount: 1,
  submittedCount: 2,
  approvedCount: 12,
  revisionRequiredCount: 0,
  myTasks: [
    {
      id: "demo-task-1",
      title: "Montage Vidéo Récapitulatif Match CA",
      project: "Contenu Matchday 2026",
      priority: "HIGH",
      dueDate: "Demain, 18:00",
      status: "IN_PROGRESS",
    },
    {
      id: "demo-task-2",
      title: "Création Shorts & Reels TikTok — 5 capsules",
      project: "Stratégie Virale UEC",
      priority: "MEDIUM",
      dueDate: "24 Nov 2026",
      status: "TODO",
    },
  ],
};

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
          <span className="text-xs font-semibold text-slate-300">
            Prévisualiser la vue du rôle :
          </span>
          <Badge
            variant={
              activeRole === "SUPER_ADMIN"
                ? "superAdmin"
                : activeRole === "COORDINATOR"
                ? "coordinator"
                : "member"
            }
            size="sm"
          >
            {activeRole}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveRole("SUPER_ADMIN")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeRole === "SUPER_ADMIN"
                ? "bg-uec-red text-white shadow"
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
                ? "bg-uec-blue text-white shadow"
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
        {activeRole === "SUPER_ADMIN" && <SuperAdminDashboard data={MOCK_SUPER_ADMIN_DATA} />}
        {activeRole === "COORDINATOR" && <CoordinatorDashboard data={MOCK_COORDINATOR_DATA} />}
        {activeRole === "MEMBER" && (
          <MemberDashboard
            data={MOCK_MEMBER_DATA}
            userName="Membre Démo"
            departmentName="Pôle Créatif & Design"
          />
        )}
      </div>
    </div>
  );
}
