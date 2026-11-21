"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FolderKanban,
  ShieldCheck,
  Activity,
  User,
  Layers,
} from "lucide-react";
import type { AnalyticsData } from "@/lib/data/analytics";

interface AnalyticsViewProps {
  data: AnalyticsData;
  userRole: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  CREATE_TASK: { label: "Création d'une tâche", color: "text-blue-400" },
  UPDATE_TASK_STATUS: { label: "Avancement de statut", color: "text-cyan-400" },
  SUBMIT_FOR_APPROVAL: { label: "Soumission de livrable", color: "text-amber-400" },
  APPROVE_TASK: { label: "Validation finale", color: "text-emerald-400" },
  CREATE_PROJECT: { label: "Lancement de projet", color: "text-indigo-400" },
  CREATE_CALENDAR_ITEM: { label: "Planification contenu", color: "text-pink-400" },
  CREATE_SERVICE_REQUEST: { label: "Demande de service", color: "text-purple-400" },
  CREATE_MEETING: { label: "Convocation réunion", color: "text-sky-400" },
  SAVE_MEETING_MINUTES: { label: "Archivage PV", color: "text-emerald-300" },
  CREATE_EQUIPMENT: { label: "Enregistrement matériel", color: "text-blue-300" },
  REQUEST_EQUIPMENT_LOAN: { label: "Demande d'emprunt", color: "text-amber-300" },
  APPROVE_EQUIPMENT_LOAN: { label: "Autorisation de prêt", color: "text-emerald-400" },
  RETURN_EQUIPMENT: { label: "Retour de matériel", color: "text-emerald-300" },
  UPLOAD_MEDIA_FILE: { label: "Import médiathèque", color: "text-cyan-300" },
};

export function AnalyticsView({ data, userRole }: AnalyticsViewProps) {
  const { tasks, projects, approvals, equipment, departments, recentActivity } = data;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <BarChart3 size={24} className="text-uec-red" />
          <span>Analyses de Performance & Audit Opérationnel</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Indicateurs d'efficacité en temps réel agrégés sur l'ensemble de la base de données UEC.
        </p>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Taux d'Achèvement"
          value={`${tasks.completionRate}%`}
          description={`${tasks.completed} sur ${tasks.total} tâches terminées`}
          icon={<CheckCircle2 size={18} />}
          accentColor="green"
        />
        <StatCard
          title="Tâches Hors Délais"
          value={tasks.overdue.toString()}
          description="Échéance dépassée non clôturée"
          icon={<AlertTriangle size={18} />}
          accentColor="red"
        />
        <StatCard
          title="Projets Actifs"
          value={projects.active.toString()}
          description={`${projects.total} projets au total`}
          icon={<FolderKanban size={18} />}
          accentColor="cyan"
        />
        <StatCard
          title="Livrables Validés"
          value={approvals.approved.toString()}
          description={`${approvals.pendingCoordinator + approvals.pendingSuperAdmin} en attente`}
          icon={<ShieldCheck size={18} />}
          accentColor="blue"
        />
      </div>

      {/* Pipeline Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task Pipeline Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Layers size={16} className="text-uec-cyan" />
              <span>Pipeline Opérationnel des Tâches</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">À Faire (Backlog)</span>
                  <span className="text-white font-mono font-semibold">{tasks.todo}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-slate-500 h-2 rounded-full"
                    style={{
                      width: `${tasks.total > 0 ? (tasks.todo / tasks.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-blue-400">En Cours de Réalisation</span>
                  <span className="text-white font-mono font-semibold">{tasks.inProgress}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{
                      width: `${tasks.total > 0 ? (tasks.inProgress / tasks.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-amber-400">En Revue & Approbation</span>
                  <span className="text-white font-mono font-semibold">{tasks.inReview}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-amber-500 h-2 rounded-full"
                    style={{
                      width: `${tasks.total > 0 ? (tasks.inReview / tasks.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-emerald-400">Terminées & Validées</span>
                  <span className="text-white font-mono font-semibold">{tasks.completed}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2 rounded-full"
                    style={{
                      width: `${tasks.total > 0 ? (tasks.completed / tasks.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#1F2937] flex items-center justify-between text-xs text-slate-400">
              <span>Équipements en prêt :</span>
              <span className="text-white font-bold">
                {equipment.loaned} / {equipment.total} ({equipment.available} libres)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Department Performance */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp size={16} className="text-uec-red" />
              <span>Productivité & Vélocité des 6 Pôles UEC</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {departments.map((dept) => (
              <div
                key={dept.id}
                className="p-3 rounded-xl bg-[#0B1020]/60 border border-[#1F2937] space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: dept.color }}
                    />
                    <span className="text-xs font-bold text-white">{dept.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">[{dept.code}]</span>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-slate-400">
                      Membres : <strong className="text-slate-200">{dept.memberCount}</strong>
                    </span>
                    <span className="text-slate-400">
                      Tâches :{" "}
                      <strong className="text-slate-200">
                        {dept.completedTaskCount} / {dept.taskCount}
                      </strong>
                    </span>
                    <span className="font-mono font-bold text-uec-cyan">
                      {dept.completionRate}%
                    </span>
                  </div>
                </div>

                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${dept.completionRate}%`,
                      backgroundColor: dept.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Activity Audit Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
            <Activity size={16} className="text-uec-cyan" />
            <span>Journal d'Audit & Traçabilité Opérationnelle (PostgreSQL Activity Logs)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              Aucun événement d'activité consigné pour le moment.
            </div>
          ) : (
            <div className="divide-y divide-[#1F2937] text-xs">
              {recentActivity.map((log) => {
                const actionCfg = ACTION_LABELS[log.action] || {
                  label: log.action,
                  color: "text-slate-300",
                };
                const timeAgo = new Date(log.created_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={log.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-800/30 px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700">
                        <User size={13} className="text-slate-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-white">{log.actor_name}</strong>
                          <span className={`font-semibold ${actionCfg.color}`}>
                            {actionCfg.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Table: <span className="font-mono text-slate-300">{log.entity_type}</span>
                          {log.details?.title && (
                            <>
                              {" "}
                              • <span className="text-slate-200">« {log.details.title} »</span>
                            </>
                          )}
                          {log.details?.code && (
                            <>
                              {" "}
                              • <span className="font-mono text-uec-cyan">[{log.details.code}]</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 font-mono shrink-0 flex items-center gap-1">
                      <Clock size={12} />
                      {timeAgo}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
