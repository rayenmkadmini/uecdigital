"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/context";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FolderKanban,
  ShieldCheck,
  Users,
  CheckCircle2,
  AlertCircle,
  Building2,
  Clock,
  ArrowUpRight,
  RotateCcw,
  XCircle,
} from "lucide-react";
import type { SuperAdminDashboardData } from "@/lib/data/dashboard";
import {
  ApprovalDecisionModal,
  ApprovalDecisionType,
  ApprovalSubmissionItem,
} from "@/components/dashboard/approval-decision-modal";

interface SuperAdminDashboardProps {
  data: SuperAdminDashboardData;
}

export function SuperAdminDashboard({ data }: SuperAdminDashboardProps) {
  const { t } = useTranslation();
  const [approvals, setApprovals] = useState(data.pendingApprovals);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [activeModal, setActiveModal] = useState<{
    submission: ApprovalSubmissionItem;
    decisionType: ApprovalDecisionType;
  } | null>(null);

  const handleOpenDecision = (item: ApprovalSubmissionItem, decisionType: ApprovalDecisionType) => {
    setActionNotice(null);
    setActiveModal({ submission: item, decisionType });
  };

  const handleDecisionSuccess = (
    submissionId: string,
    decisionType: ApprovalDecisionType,
    message: string
  ) => {
    setApprovals((prev) => prev.filter((a) => a.id !== submissionId));
    setActionNotice({
      type: "success",
      message,
    });
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
            Supervision stratégique du Pôle Digital, arbitrages et validation finale des livrables. Données PostgreSQL en temps réel.
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
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between shadow-lg ${
            actionNotice.type === "success"
              ? "bg-emerald-950/70 border-emerald-700 text-emerald-200"
              : "bg-red-950/70 border-red-700 text-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === "success" ? (
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-red-400 shrink-0" />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t("dashboard.stats.totalProjects")}
          value={data.totalProjects}
          description="Projets actifs et planifiés"
          trend={{ value: "Actifs", isPositive: true }}
          icon={<FolderKanban size={20} />}
          accentColor="blue"
        />

        <StatCard
          title={t("dashboard.stats.pendingApprovals")}
          value={approvals.length}
          description="Action Super Admin Requise"
          trend={{ value: approvals.length > 0 ? "Urgent" : "À jour", isPositive: approvals.length === 0 }}
          icon={<ShieldCheck size={20} />}
          accentColor="red"
          className="ring-1 ring-uec-red/40"
        />

        <StatCard
          title={t("dashboard.stats.activeMembers")}
          value={data.totalActiveMembers}
          description="Membres actifs enregistrés"
          trend={{ value: "Base PostgreSQL", isPositive: true }}
          icon={<Users size={20} />}
          accentColor="cyan"
        />

        <StatCard
          title="Pôles Spécialisés"
          value={data.totalDepartments}
          description="Départements matriciels UEC"
          trend={{ value: "Opérationnels", isPositive: true }}
          icon={<Building2 size={20} />}
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
            <div className="p-6">
              <EmptyState
                icon={CheckCircle2}
                title={t("dashboard.noPendingApprovals")}
                description="Tous les livrables soumis ont été examinés avec succès selon les critères UEC."
              />
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

                    <div className="flex items-center gap-4 text-xs text-slate-400 pt-1 flex-wrap">
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
                      variant="danger"
                      size="sm"
                      onClick={() => handleOpenDecision(item, "REJECTED")}
                      className="bg-rose-700 hover:bg-rose-800 text-xs"
                      title="Rejet officiel"
                    >
                      <XCircle size={14} className="mr-1" />
                      Rejeter
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDecision(item, "REVISION")}
                      className="text-amber-300 hover:text-amber-200 border-amber-900/60 hover:bg-amber-950/40 text-xs"
                      title="Renvoyer pour modifications"
                    >
                      <RotateCcw size={14} className="mr-1" />
                      Révision
                    </Button>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleOpenDecision(item, "APPROVED")}
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
          {data.departmentBreakdown.map((dept) => (
            <div
              key={dept.code}
              className="p-5 rounded-xl bg-[#111827] border border-[#27354F] transition-all duration-200 hover:-translate-y-0.5 space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <Badge
                    style={{
                      backgroundColor: `${dept.color}20`,
                      borderColor: `${dept.color}60`,
                      color: dept.color,
                    }}
                    size="sm"
                  >
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

      {/* Decision Modal */}
      {activeModal && (
        <ApprovalDecisionModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          submission={activeModal.submission}
          decisionType={activeModal.decisionType}
          onSuccess={handleDecisionSuccess}
        />
      )}
    </div>
  );
}
