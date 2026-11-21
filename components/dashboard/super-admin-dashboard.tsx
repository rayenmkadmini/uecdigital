"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/context";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FolderKanban,
  ShieldCheck,
  Users,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Building2,
  Clock,
  ArrowUpRight,
  TrendingUp,
  FileCheck2,
  XCircle,
  RotateCcw,
} from "lucide-react";

interface PendingApproval {
  id: string;
  taskTitle: string;
  projectTitle: string;
  department: string;
  submittedBy: string;
  submittedAt: string;
  version: number;
  previewUrl?: string;
  notes: string;
}

const MOCK_PENDING_APPROVALS: PendingApproval[] = [
  {
    id: "sub-101",
    taskTitle: "Affiche Officielle — Derby Tunisien 2026",
    projectTitle: "Campagne Visuelle Derby",
    department: "Créatif & Design",
    submittedBy: "Yassine Ayari (Designer)",
    submittedAt: "Il y a 35 min",
    version: 2,
    notes: "Modifications des contrastes et ajout des sponsors officiels validées par le coordinateur.",
  },
  {
    id: "sub-102",
    taskTitle: "Teaser Vidéo — Lancement Espace Digital",
    projectTitle: "Communication Digitale UEC",
    department: "Audiovisuel & Montage",
    submittedBy: "Karim Zouari (Monteur Vidéo)",
    submittedAt: "Il y a 2 heures",
    version: 1,
    notes: "Étalonnage aux couleurs rouge et bleu UEC, rendu final 4K 60fps.",
  },
  {
    id: "sub-103",
    taskTitle: "Refonte Système d'Adhésion en Ligne",
    projectTitle: "Plateforme Numérique UEC",
    department: "Développement Web",
    submittedBy: "Rayen Mkadmini (Tech Lead)",
    submittedAt: "Il y a 4 heures",
    version: 1,
    notes: "Intégration du paiement et vérification des matricules étudiants. Prêt pour mise en prod.",
  },
];

const DEPARTMENTS = [
  {
    code: "DESIGN",
    name: "Pôle Créatif & Design",
    coordinator: "Nourhene Trabelsi",
    activeProjects: 4,
    pendingTasks: 8,
    progress: 82,
    color: "border-rose-500/30 hover:border-rose-500/60",
    badgeColor: "red" as const,
  },
  {
    code: "VIDEO",
    name: "Pôle Audiovisuel & Montage",
    coordinator: "Fares Mansouri",
    activeProjects: 3,
    pendingTasks: 5,
    progress: 74,
    color: "border-blue-500/30 hover:border-blue-500/60",
    badgeColor: "coordinator" as const,
  },
  {
    code: "WEB",
    name: "Pôle Développement Web & Systèmes",
    coordinator: "Aziz Gharbi",
    activeProjects: 2,
    pendingTasks: 7,
    progress: 90,
    color: "border-cyan-500/30 hover:border-cyan-500/60",
    badgeColor: "cyan" as const,
  },
  {
    code: "STRATEGY",
    name: "Stratégie & Communication Digitale",
    coordinator: "Sarra Ben Amor",
    activeProjects: 3,
    pendingTasks: 4,
    progress: 68,
    color: "border-amber-500/30 hover:border-amber-500/60",
    badgeColor: "pending" as const,
  },
  {
    code: "SOCIAL_MEDIA",
    name: "Réseaux Sociaux & Modération",
    coordinator: "Mehdi Bouzid",
    activeProjects: 2,
    pendingTasks: 6,
    progress: 85,
    color: "border-indigo-500/30 hover:border-indigo-500/60",
    badgeColor: "review" as const,
  },
  {
    code: "INNOVATION",
    name: "Innovation & Projets Numériques",
    coordinator: "Mohamed Ali Dridi",
    activeProjects: 1,
    pendingTasks: 3,
    progress: 60,
    color: "border-emerald-500/30 hover:border-emerald-500/60",
    badgeColor: "approved" as const,
  },
];

export function SuperAdminDashboard() {
  const { t } = useTranslation();
  const [approvals, setApprovals] = useState<PendingApproval[]>(MOCK_PENDING_APPROVALS);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const handleApprove = (id: string, title: string) => {
    setApprovals(approvals.filter((a) => a.id !== id));
    setActionNotice(`Livrable "${title}" validé définitivement par le Super Admin.`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleRevision = (id: string, title: string) => {
    setApprovals(approvals.filter((a) => a.id !== id));
    setActionNotice(`Demande de révision envoyée à l'équipe pour "${title}".`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  return (
    <div className="space-y-8">
      {/* Top Welcome & Subtitle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              Console Super Administrateur
            </h1>
            <Badge variant="superAdmin" size="md">
              DÉCISIONNEL FINAL
            </Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Supervision stratégique du Pôle Digital, arbitrages et validation finale des livrables.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard/projects">
            <Button variant="secondary" size="sm">
              <FolderKanban size={15} className="mr-1.5" />
              Nouveau Projet
            </Button>
          </Link>
          <Link href="/dashboard/approvals">
            <Button variant="primary" size="sm">
              <ShieldCheck size={15} className="mr-1.5" />
              File Complète ({approvals.length})
            </Button>
          </Link>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-700 text-xs text-emerald-200 flex items-center justify-between animate-fade-in shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-emerald-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t("dashboard.stats.totalProjects")}
          value="15"
          description="Sur 6 départements actifs"
          trend={{ value: "+3 ce mois", isPositive: true }}
          icon={<FolderKanban size={20} />}
          accentColor="blue"
        />

        <StatCard
          title={t("dashboard.stats.pendingApprovals")}
          value={approvals.length}
          description="Action Super Admin Requise"
          trend={{ value: "Urgent", isPositive: false }}
          icon={<ShieldCheck size={20} />}
          accentColor="red"
          className="ring-1 ring-uec-red/40"
        />

        <StatCard
          title={t("dashboard.stats.activeMembers")}
          value="34"
          description="Coordonnateurs & Membres"
          trend={{ value: "100% assignés", isPositive: true }}
          icon={<Users size={20} />}
          accentColor="cyan"
        />

        <StatCard
          title={t("dashboard.stats.storageUsed")}
          value="1.8 GB"
          description="Bucket espace-digital-media (50MB max/fichier)"
          trend={{ value: "Sécurisé RLS", isPositive: true }}
          icon={<HardDrive size={20} />}
          accentColor="gold"
        />
      </div>

      {/* Section: Pending Final Approvals Queue (Super Admin Exclusive Authority) */}
      <Card className="border-uec-red/30 shadow-xl">
        <CardHeader className="bg-red-950/20 border-b border-red-900/40">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-uec-red" />
              <CardTitle className="text-white">
                Validations Finales en Attente (Autorité Exclusive Super Admin)
              </CardTitle>
            </div>
            <CardDescription className="text-slate-300">
              Conformément aux statuts UEC, seul le Super Administrateur peut prononcer la validation finale d'un livrable.
            </CardDescription>
          </div>
          <Badge variant="superAdmin">{approvals.length} en attente</Badge>
        </CardHeader>

        <CardContent className="p-0">
          {approvals.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <CheckCircle2 size={36} className="text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-medium">{t("dashboard.noPendingApprovals")}</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1F2937]">
              {approvals.map((item) => (
                <div
                  key={item.id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-900/40 transition-colors"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white hover:text-uec-red transition-colors">
                        {item.taskTitle}
                      </span>
                      <Badge variant="coordinator" size="sm">
                        {item.department}
                      </Badge>
                      <span className="text-[10px] text-slate-400 px-2 py-0.5 rounded bg-slate-800">
                        v{item.version}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 italic">
                      "{item.notes}"
                    </p>

                    <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
                      <span>Projet : <strong className="text-slate-300">{item.projectTitle}</strong></span>
                      <span>•</span>
                      <span>Soumis par : <strong className="text-slate-300">{item.submittedBy}</strong></span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock size={12} /> {item.submittedAt}
                      </span>
                    </div>
                  </div>

                  {/* Super Admin Action Controls */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevision(item.id, item.taskTitle)}
                      className="text-amber-300 hover:text-amber-200 border-amber-900/60 hover:bg-amber-950/40 text-xs"
                      title="Renvoyer pour modifications"
                    >
                      <RotateCcw size={14} className="mr-1" />
                      Révision
                    </Button>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApprove(item.id, item.taskTitle)}
                      className="bg-emerald-600 hover:bg-emerald-500 border-emerald-500/50 text-xs"
                      title="Validation définitive"
                    >
                      <CheckCircle2 size={14} className="mr-1" />
                      Valider Définitivement
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid: 6 Specialized Departments */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              {t("dashboard.departmentOverview")}
            </h2>
            <p className="text-xs text-slate-400">
              Organisation matricielle par pôles de spécialité du département digital.
            </p>
          </div>
          <Link
            href="/dashboard/departments"
            className="text-xs text-uec-cyan hover:underline flex items-center gap-1 font-semibold"
          >
            <span>Gérer les pôles</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DEPARTMENTS.map((dept) => (
            <div
              key={dept.code}
              className={`p-5 rounded-xl bg-[#111827] border ${dept.color} transition-all duration-200 hover:-translate-y-0.5 space-y-4`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <Badge variant={dept.badgeColor} size="sm">
                    {dept.code}
                  </Badge>
                  <h3 className="text-sm font-bold text-white mt-1.5">{dept.name}</h3>
                  <p className="text-xs text-slate-400">Coord: {dept.coordinator}</p>
                </div>
                <Building2 size={20} className="text-slate-400" />
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Avancement Global</span>
                  <span className="font-bold text-slate-200">{dept.progress}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-uec-blue to-uec-red rounded-full"
                    style={{ width: `${dept.progress}%` }}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-[#1F2937] flex items-center justify-between text-xs text-slate-400">
                <span>{dept.activeProjects} Projets Actifs</span>
                <span>{dept.pendingTasks} Tâches en cours</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
