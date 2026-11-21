"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/context";
import { useAuth } from "@/lib/auth/auth-context";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckSquare,
  Clock,
  UploadCloud,
  FileCheck2,
  Calendar,
  AlertCircle,
  Megaphone,
  CheckCircle2,
  ExternalLink,
  Send,
} from "lucide-react";

interface MemberTask {
  id: string;
  title: string;
  project: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  dueDate: string;
  status: "TODO" | "IN_PROGRESS" | "SUBMITTED" | "APPROVED" | "REVISION_REQUIRED";
}

const MOCK_MEMBER_TASKS: MemberTask[] = [
  {
    id: "task-01",
    title: "Montage Vidéo Récapitulatif Match CA",
    project: "Contenu Matchday 2026",
    priority: "HIGH",
    dueDate: "Demain, 18:00",
    status: "IN_PROGRESS",
  },
  {
    id: "task-02",
    title: "Création Shorts & Reels TikTok — 5 capsules",
    project: "Stratégie Virale UEC",
    priority: "MEDIUM",
    dueDate: "24 Nov 2026",
    status: "TODO",
  },
  {
    id: "task-03",
    title: "Teaser Audio Podcast Clubiste Ep 04",
    project: "Podcast UEC",
    priority: "LOW",
    dueDate: "28 Nov 2026",
    status: "SUBMITTED",
  },
];

export function MemberDashboard() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<MemberTask[]>(MOCK_MEMBER_TASKS);
  const [selectedTask, setSelectedTask] = useState<MemberTask | null>(null);
  const [submissionLink, setSubmissionLink] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const priorityBadges = {
    LOW: "default" as const,
    MEDIUM: "planning" as const,
    HIGH: "pending" as const,
    CRITICAL: "red" as const,
  };

  const statusBadges = {
    TODO: { label: "À faire", variant: "default" as const },
    IN_PROGRESS: { label: "En cours", variant: "review" as const },
    SUBMITTED: { label: "Soumis (Revue)", variant: "pending" as const },
    APPROVED: { label: "Validé Super Admin", variant: "approved" as const },
    REVISION_REQUIRED: { label: "Révision Demandée", variant: "revision" as const },
  };

  const handleSubmitDeliverable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    setTasks(
      tasks.map((t) =>
        t.id === selectedTask.id ? { ...t, status: "SUBMITTED" } : t
      )
    );

    setNotice(
      `Livrable pour "${selectedTask.title}" soumis avec succès. Transmis au coordinateur de votre pôle pour revue.`
    );
    setSelectedTask(null);
    setSubmissionLink("");
    setSubmissionNotes("");
    setTimeout(() => setNotice(null), 5000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              Bonjour, {profile?.full_name?.split(" ")[0]}
            </h1>
            <Badge variant="member" size="md">
              ESPACE MEMBRE
            </Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {profile?.department_name || "Pôle Audiovisuel & Montage"} — Suivez vos missions et soumettez vos travaux.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard/tasks">
            <Button variant="secondary" size="sm">
              <CheckSquare size={15} className="mr-1.5" />
              Toutes Mes Tâches
            </Button>
          </Link>
        </div>
      </div>

      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-700 text-xs text-emerald-200 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-emerald-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Tâches Assignées"
          value={tasks.filter((t) => t.status !== "APPROVED").length}
          description="En attente ou en cours"
          icon={<CheckSquare size={20} />}
          accentColor="blue"
        />

        <StatCard
          title="Échéances Imminentes"
          value="1"
          description="Dans les prochaines 48h"
          trend={{ value: "Urgent", isPositive: false }}
          icon={<Clock size={20} />}
          accentColor="red"
        />

        <StatCard
          title="Livrables Soumis"
          value={tasks.filter((t) => t.status === "SUBMITTED").length}
          description="En attente de revue"
          icon={<UploadCloud size={20} />}
          accentColor="gold"
        />

        <StatCard
          title="Validés Super Admin"
          value="12"
          description="Depuis le début de saison"
          trend={{ value: "100% approuvé", isPositive: true }}
          icon={<FileCheck2 size={20} />}
          accentColor="green"
        />
      </div>

      {/* Tasks Table */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <CheckSquare size={18} className="text-uec-red" />
              <span>Mes Missions & Livrables</span>
            </CardTitle>
            <CardDescription className="text-slate-400">
              Cliquez sur "Soumettre" dès que votre production est prête pour la revue du coordinateur.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y divide-[#1F2937]">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-900/40 transition-colors"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{task.title}</span>
                    <Badge variant={priorityBadges[task.priority]} size="sm">
                      {task.priority}
                    </Badge>
                    <Badge variant={statusBadges[task.status].variant} size="sm">
                      {statusBadges[task.status].label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>Projet : <strong className="text-slate-300">{task.project}</strong></span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-amber-400">
                      <Clock size={12} /> Échéance : {task.dueDate}
                    </span>
                  </div>
                </div>

                {/* Action button */}
                <div className="self-end sm:self-center">
                  {task.status === "SUBMITTED" ? (
                    <span className="text-xs text-slate-400 italic flex items-center gap-1">
                      <Clock size={13} /> En attente de validation
                    </span>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setSelectedTask(task)}
                      className="text-xs"
                    >
                      <UploadCloud size={14} className="mr-1" />
                      Soumettre Livrable
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Submission Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#111827] border border-[#27354F] rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#1F2937] pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Soumettre un Livrable</h3>
                <p className="text-xs text-slate-400">{selectedTask.title}</p>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitDeliverable} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Lien du Livrable (Drive / Figma / Wetransfer / GitHub / Storage)
                </label>
                <Input
                  required
                  type="url"
                  placeholder="https://..."
                  value={submissionLink}
                  onChange={(e) => setSubmissionLink(e.target.value)}
                  icon={<ExternalLink size={15} />}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Notes & Précisions pour le Coordinateur et le Super Admin
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Décrivez les éléments livrés, les contraintes respectées et les formats inclus..."
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  className="w-full bg-[#172033] text-xs text-white p-3 rounded-lg border border-[#1F2937] focus:border-uec-blue focus:outline-none"
                />
              </div>

              <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-900/60 text-[11px] text-blue-300">
                ℹ️ Votre livrable sera d'abord examiné par votre coordinateur d'équipe avant d'être soumis à la validation finale du Super Administrateur.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedTask(null)}
                >
                  Annuler
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  <Send size={14} className="mr-1" />
                  Confirmer la Soumission
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Announcements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Megaphone size={18} className="text-uec-cyan" />
            <span>Annonces Officielles du Pôle Digital</span>
          </CardTitle>
          <CardDescription className="text-slate-400">
            Notes de service et directives internes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-4 rounded-xl bg-[#172033] border border-[#27354F] space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white">Réunion Mensuelle de Coordination — Dimanche 20:00</span>
              <span className="text-uec-red font-semibold text-[11px]">Obligatoire</span>
            </div>
            <p className="text-xs text-slate-300">
              Point d'avancement sur les projets en cours et préparation de la couverture médiatique du Derby.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
