"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/context";
import { useAuth } from "@/lib/auth/auth-context";
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
  ArrowRight,
  Send,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";

interface TeamDeliverable {
  id: string;
  taskTitle: string;
  assignee: string;
  submittedAt: string;
  version: number;
  description: string;
}

const MOCK_TEAM_SUBMISSIONS: TeamDeliverable[] = [
  {
    id: "sub-201",
    taskTitle: "Pack Visuel Réseaux — Victoire CA vs ESS",
    assignee: "Yassine Ayari",
    submittedAt: "Il y a 45 min",
    version: 1,
    description: "Format 1080x1350 et Stories Instagram avec la charte officielle UEC.",
  },
  {
    id: "sub-202",
    taskTitle: "Bannière Officielle Site Web 2026",
    assignee: "Mariem Cherif",
    submittedAt: "Il y a 3 heures",
    version: 2,
    description: "Correction des marges et intégration de la nouvelle typographie UEC.",
  },
];

const MOCK_TEAM_MEMBERS = [
  { name: "Yassine Ayari", role: "Graphiste Senior", activeTasks: 3, avatar: null },
  { name: "Mariem Cherif", role: "UI Designer", activeTasks: 2, avatar: null },
  { name: "Selim Mansour", role: "Illustrateur", activeTasks: 1, avatar: null },
  { name: "Amira Jaziri", role: "Motion Designer", activeTasks: 2, avatar: null },
];

export function CoordinatorDashboard() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [submissions, setSubmissions] = useState<TeamDeliverable[]>(MOCK_TEAM_SUBMISSIONS);
  const [notice, setNotice] = useState<string | null>(null);

  const deptName = profile?.department_name || "Pôle Créatif & Design";

  const handleForwardToSuperAdmin = (id: string, title: string) => {
    setSubmissions(submissions.filter((s) => s.id !== id));
    setNotice(`Livrable "${title}" validé par le coordinateur et transmis au Super Admin pour validation finale.`);
    setTimeout(() => setNotice(null), 5000);
  };

  const handleRequestRevision = (id: string, title: string) => {
    setSubmissions(submissions.filter((s) => s.id !== id));
    setNotice(`Demande de retouche renvoyée au membre pour "${title}".`);
    setTimeout(() => setNotice(null), 5000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              Espace Coordinateur — {deptName}
            </h1>
            <Badge variant="coordinator" size="md">
              PILOTAGE ÉQUIPE
            </Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Gestion des membres de votre pôle, assignation des tâches et première revue des livrables.
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
        <div className="p-3.5 rounded-xl bg-blue-950/70 border border-blue-700 text-xs text-blue-200 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-blue-400 shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-blue-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Membres du Pôle"
          value={MOCK_TEAM_MEMBERS.length}
          description="Actifs et mobilisés"
          icon={<Users size={20} />}
          accentColor="blue"
        />

        <StatCard
          title="Tâches en Cours"
          value="8"
          description="Réparties dans l'équipe"
          icon={<CheckSquare size={20} />}
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
          title="Taux de Validation"
          value="92%"
          description="Approbation finale Super Admin"
          trend={{ value: "+4%", isPositive: true }}
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
                      <span>Créateur : <strong className="text-slate-300">{sub.assignee}</strong></span>
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
                      onClick={() => handleRequestRevision(sub.id, sub.taskTitle)}
                      className="text-amber-300 hover:text-amber-200 border-amber-800/60 text-xs"
                    >
                      <RotateCcw size={14} className="mr-1" />
                      Demander Retouches
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleForwardToSuperAdmin(sub.id, sub.taskTitle)}
                      className="bg-uec-blue hover:bg-uec-blueHover text-xs"
                    >
                      <Send size={14} className="mr-1" />
                      Transmettre au Super Admin
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
              <span>Composition de l'Équipe</span>
            </CardTitle>
            <CardDescription className="text-slate-400">
              Charge de travail actuelle par membre
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-[#1F2937]">
              {MOCK_TEAM_MEMBERS.map((member) => (
                <div key={member.name} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={member.name} size="sm" />
                    <div>
                      <p className="text-xs font-bold text-white">{member.name}</p>
                      <p className="text-[11px] text-slate-400">{member.role}</p>
                    </div>
                  </div>
                  <Badge variant="member" size="sm">
                    {member.activeTasks} tâches actives
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Projets Actifs du Département */}
        <Card>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FolderKanban size={18} className="text-uec-red" />
              <span>Projets Opérationnels du Pôle</span>
            </CardTitle>
            <CardDescription className="text-slate-400">
              Objectifs en cours dans votre spécialité
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3.5 rounded-lg bg-[#172033] border border-[#27354F] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Campagne Visuelle Derby 2026</span>
                <Badge variant="red" size="sm">Priorité Haute</Badge>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800">
                <div className="h-full bg-uec-red rounded-full" style={{ width: "85%" }} />
              </div>
              <p className="text-[11px] text-slate-400">4 sur 5 livrables finalisés</p>
            </div>

            <div className="p-3.5 rounded-lg bg-[#172033] border border-[#27354F] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Charte Graphique Espace Digital</span>
                <Badge variant="approved" size="sm">90% Achevé</Badge>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: "90%" }} />
              </div>
              <p className="text-[11px] text-slate-400">Finalisation des tokens et icons</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
