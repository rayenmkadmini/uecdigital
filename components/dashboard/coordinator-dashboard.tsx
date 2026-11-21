"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/context";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  FolderKanban,
  Users,
  CheckSquare,
  Clock,
  Send,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";
import type { CoordinatorDashboardData } from "@/lib/data/dashboard";
import { submitCoordinatorReview } from "@/app/actions/approvals";

interface CoordinatorDashboardProps {
  data: CoordinatorDashboardData;
}

export function CoordinatorDashboard({ data }: CoordinatorDashboardProps) {
  const { t } = useTranslation();
  const [submissions, setSubmissions] = useState(data.teamSubmissions);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const handleForwardToSuperAdmin = async (id: string, title: string) => {
    setIsProcessing(id);
    setNotice(null);
    try {
      const notes = window.prompt(
        "Notes de revue technique pour le Super Admin :",
        "Conformité technique et graphique vérifiée. Prêt pour validation finale."
      );
      if (!notes) {
        setIsProcessing(null);
        return;
      }

      const res = await submitCoordinatorReview(id, "SUBMIT_TO_SUPER_ADMIN", notes);
      if (res.success) {
        setSubmissions((prev) => prev.filter((s) => s.id !== id));
        setNotice({
          type: "success",
          message: `Livrable "${title}" validé par le coordinateur et transmis au Super Admin.`,
        });
      } else {
        setNotice({ type: "error", message: res.message });
      }
    } catch (err: any) {
      setNotice({ type: "error", message: err.message || "Erreur de transmission" });
    } finally {
      setIsProcessing(null);
    }
  };

  const handleRequestRevision = async (id: string, title: string) => {
    setIsProcessing(id);
    setNotice(null);
    try {
      const notes = window.prompt("Instructions de retouche pour le membre :", "Retouches nécessaires sur les formats.");
      if (!notes) {
        setIsProcessing(null);
        return;
      }

      const res = await submitCoordinatorReview(id, "REQUEST_REVISION", notes);
      if (res.success) {
        setSubmissions((prev) => prev.filter((s) => s.id !== id));
        setNotice({
          type: "success",
          message: `Demande de retouche renvoyée au membre pour "${title}".`,
        });
      } else {
        setNotice({ type: "error", message: res.message });
      }
    } catch (err: any) {
      setNotice({ type: "error", message: err.message || "Erreur de demande de retouche" });
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              Espace Coordinateur — {data.departmentName} ({data.departmentCode})
            </h1>
            <Badge variant="coordinator" size="md">
              PILOTAGE ÉQUIPE
            </Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Gestion des membres de votre pôle, assignation des tâches et première revue de conformité.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard/tasks">
            <Button variant="secondary" size="sm">
              <CheckSquare size={15} className="mr-1.5" />
              Créer une Tâche
            </Button>
          </Link>
        </div>
      </div>

      {notice && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between shadow-lg ${
            notice.type === "success"
              ? "bg-blue-950/70 border-blue-700 text-blue-200"
              : "bg-red-950/70 border-red-700 text-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === "success" ? (
              <CheckCircle2 size={16} className="text-blue-400 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-red-400 shrink-0" />
            )}
            <span>{notice.message}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Membres du Pôle"
          value={data.memberCount}
          description="Affectés à ce pôle"
          icon={<Users size={20} />}
          accentColor="blue"
        />

        <StatCard
          title="Projets du Pôle"
          value={data.activeProjectCount}
          description="En cours ou planifiés"
          icon={<FolderKanban size={20} />}
          accentColor="cyan"
        />

        <StatCard
          title="À Réviser (Coord)"
          value={submissions.length}
          description="Avant envoi Super Admin"
          icon={<Clock size={20} />}
          accentColor="gold"
          className="ring-1 ring-amber-500/40"
        />

        <StatCard
          title="Statut Département"
          value="Opérationnel"
          description="PostgreSQL vérifié"
          icon={<CheckCircle2 size={20} />}
          accentColor="green"
        />
      </div>

      {/* Livrables de l'Équipe en Attente de Revue Coordinateur */}
      <Card className="border-blue-900/40">
        <CardHeader className="bg-blue-950/20 border-b border-blue-900/40">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <FileText size={18} className="text-uec-blue" />
              <span>Livrables à Réviser par le Coordinateur</span>
            </CardTitle>
            <CardDescription className="text-slate-300">
              Vérifiez la conformité technique avant de transmettre au Super Administrateur pour validation finale.
            </CardDescription>
          </div>
          <Badge variant="coordinator">{submissions.length} livrables</Badge>
        </CardHeader>

        <CardContent className="p-0">
          {submissions.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <CheckCircle2 size={36} className="text-blue-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-medium">Aucun livrable en attente de revue d'équipe.</p>
              <p className="text-xs text-slate-400 mt-1">Tous les livrables de votre pôle sont à jour.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1F2937]">
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-900/40 transition-colors"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{sub.taskTitle}</span>
                      <span className="text-[10px] text-slate-400 px-2 py-0.5 rounded bg-slate-800">
                        v{sub.version}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{sub.description}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-400 pt-1">
                      <span>Auteur : <strong className="text-slate-300">{sub.assignee}</strong></span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {sub.submittedAt}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isProcessing === sub.id}
                      onClick={() => handleRequestRevision(sub.id, sub.taskTitle)}
                      className="text-amber-300 hover:text-amber-200 border-amber-800/60 text-xs"
                    >
                      <RotateCcw size={14} className="mr-1" />
                      Demander Retouches
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={isProcessing === sub.id}
                      onClick={() => handleForwardToSuperAdmin(sub.id, sub.taskTitle)}
                      className="bg-uec-blue hover:bg-uec-blueHover text-xs"
                    >
                      <Send size={14} className="mr-1" />
                      {isProcessing === sub.id ? "Envoi..." : "Transmettre au Super Admin"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Membres du Pôle */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users size={18} className="text-uec-cyan" />
              <span>Composition de l'Équipe ({data.teamMembers.length})</span>
            </CardTitle>
            <CardDescription className="text-slate-400">
              Membres rattachés à votre pôle dans la base de données
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.teamMembers.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Aucun membre assigné à ce pôle actuellement.
              </div>
            ) : (
              <div className="divide-y divide-[#1F2937]">
                {data.teamMembers.map((member) => (
                  <div key={member.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar name={member.name} size="sm" />
                      <div>
                        <p className="text-xs font-bold text-white">{member.name}</p>
                        <p className="text-[11px] text-slate-400">{member.email}</p>
                      </div>
                    </div>
                    <Badge variant="member" size="sm">
                      {member.activeTaskCount} tâches actives
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Box */}
        <Card>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FolderKanban size={18} className="text-uec-red" />
              <span>Gouvernance & Procédures de Pôle</span>
            </CardTitle>
            <CardDescription className="text-slate-400">
              Rappels opérationnels pour le rôle Coordinateur
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-slate-300">
            <div className="p-3.5 rounded-lg bg-[#172033] border border-[#27354F] space-y-1">
              <p className="font-semibold text-white">1. Attribution des tâches</p>
              <p className="text-slate-400">
                Créez les tâches pour votre pôle dans le module Tâches en précisant les critères d'acceptation stricts.
              </p>
            </div>
            <div className="p-3.5 rounded-lg bg-[#172033] border border-[#27354F] space-y-1">
              <p className="font-semibold text-white">2. Revue de conformité</p>
              <p className="text-slate-400">
                Vérifiez chaque livrable déposé par les membres. Seul le Super Administrateur peut prononcer la validation finale.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
