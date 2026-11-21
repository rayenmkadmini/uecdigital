"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/context";
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
  AlertCircle,
  Megaphone,
  CheckCircle2,
  ExternalLink,
  Send,
} from "lucide-react";
import type { MemberDashboardData } from "@/lib/data/dashboard";
import { submitDeliverableAction } from "@/app/actions/tasks";

interface MemberDashboardProps {
  data: MemberDashboardData;
  userName: string;
  departmentName: string;
}

export function MemberDashboard({ data, userName, departmentName }: MemberDashboardProps) {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState(data.myTasks);
  const [selectedTask, setSelectedTask] = useState<(typeof data.myTasks)[0] | null>(null);
  const [deliverableTitle, setDeliverableTitle] = useState("");
  const [submissionLink, setSubmissionLink] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const priorityBadges = {
    LOW: "default" as const,
    MEDIUM: "planning" as const,
    HIGH: "pending" as const,
    CRITICAL: "red" as const,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "TODO":
        return <Badge variant="default" size="sm">À faire</Badge>;
      case "IN_PROGRESS":
        return <Badge variant="review" size="sm">En cours</Badge>;
      case "COORDINATOR_REVIEW":
      case "PENDING_COORDINATOR":
      case "SUBMITTED":
        return <Badge variant="pending" size="sm">Revue Coordinateur</Badge>;
      case "SUPER_ADMIN_APPROVAL":
      case "PENDING_SUPER_ADMIN":
        return <Badge variant="superAdmin" size="sm">Attente Super Admin</Badge>;
      case "APPROVED":
      case "DONE":
        return <Badge variant="approved" size="sm">Validé</Badge>;
      case "REVISION_REQUIRED":
        return <Badge variant="revision" size="sm">Révision Demandée</Badge>;
      default:
        return <Badge variant="default" size="sm">{status}</Badge>;
    }
  };

  const handleSubmitDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    setIsSubmitting(true);
    setNotice(null);

    try {
      const urls = submissionLink ? [submissionLink.trim()] : [];
      const res = await submitDeliverableAction(
        selectedTask.id,
        deliverableTitle || `Livrable pour ${selectedTask.title}`,
        submissionNotes,
        urls
      );

      if (res.success) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === selectedTask.id ? { ...t, status: "COORDINATOR_REVIEW" } : t
          )
        );
        setNotice({
          type: "success",
          message: `Livrable pour "${selectedTask.title}" soumis avec succès au coordinateur.`,
        });
        setSelectedTask(null);
        setDeliverableTitle("");
        setSubmissionLink("");
        setSubmissionNotes("");
      } else {
        setNotice({ type: "error", message: res.message });
      }
    } catch (err: any) {
      setNotice({ type: "error", message: err.message || "Erreur lors de la soumission" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              Bonjour, {userName.split(" ")[0] || "Membre"}
            </h1>
            <Badge variant="member" size="md">
              ESPACE MEMBRE
            </Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {departmentName} — Suivez vos missions assignées et soumettez vos travaux.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard/tasks">
            <Button variant="secondary" size="sm">
              <CheckSquare size={15} className="mr-1.5" />
              Toutes les Tâches
            </Button>
          </Link>
        </div>
      </div>

      {notice && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between shadow-lg ${
            notice.type === "success"
              ? "bg-emerald-950/70 border-emerald-700 text-emerald-200"
              : "bg-red-950/70 border-red-700 text-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === "success" ? (
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
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
          title="Tâches Assignées"
          value={data.assignedTaskCount}
          description="En attente ou en cours"
          icon={<CheckSquare size={20} />}
          accentColor="blue"
        />

        <StatCard
          title="Échéances Imminentes"
          value={data.upcomingDeadlineCount}
          description="Dans les prochaines 48h"
          trend={{ value: data.upcomingDeadlineCount > 0 ? "Urgent" : "À jour", isPositive: data.upcomingDeadlineCount === 0 }}
          icon={<Clock size={20} />}
          accentColor="red"
        />

        <StatCard
          title="Livrables Transmis"
          value={data.submittedCount}
          description="En cours de revue"
          icon={<UploadCloud size={20} />}
          accentColor="gold"
        />

        <StatCard
          title="Validés Super Admin"
          value={data.approvedCount}
          description="Livrables approuvés"
          trend={{ value: "Archivés", isPositive: true }}
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
              <span>Mes Missions & Livrables ({tasks.length})</span>
            </CardTitle>
            <CardDescription className="text-slate-400">
              Cliquez sur "Soumettre Livrable" dès que votre production est prête pour la revue du coordinateur.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {tasks.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <CheckCircle2 size={36} className="text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-medium">Aucune tâche active assignée actuellement.</p>
              <p className="text-xs text-slate-400 mt-1">Consultez le module Tâches pour explorer les opportunités de contribution.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1F2937]">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-900/40 transition-colors"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{task.title}</span>
                      <Badge variant={priorityBadges[task.priority] || "default"} size="sm">
                        {task.priority}
                      </Badge>
                      {getStatusBadge(task.status)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span>Projet : <strong className="text-slate-300">{task.project}</strong></span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock size={12} /> Échéance : {task.dueDate}
                      </span>
                    </div>
                  </div>

                  {/* Action button */}
                  <div className="self-end sm:self-center">
                    {task.status === "COORDINATOR_REVIEW" ||
                    task.status === "SUPER_ADMIN_APPROVAL" ||
                    task.status === "PENDING_COORDINATOR" ||
                    task.status === "PENDING_SUPER_ADMIN" ? (
                      <span className="text-xs text-slate-400 italic flex items-center gap-1">
                        <Clock size={13} /> En attente de validation
                      </span>
                    ) : task.status === "APPROVED" || task.status === "DONE" ? (
                      <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 size={13} /> Validé
                      </span>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setSelectedTask(task);
                          setDeliverableTitle(`Livrable: ${task.title}`);
                        }}
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
          )}
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
                  Titre du Livrable *
                </label>
                <Input
                  required
                  placeholder="Ex: Version finale haute définition"
                  value={deliverableTitle}
                  onChange={(e) => setDeliverableTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Lien du Livrable (Drive / Figma / Wetransfer / GitHub / Storage)
                </label>
                <Input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={submissionLink}
                  onChange={(e) => setSubmissionLink(e.target.value)}
                  icon={<ExternalLink size={15} />}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Notes & Précisions pour le Coordinateur et le Super Admin *
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
                <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
                  <Send size={14} className="mr-1" />
                  {isSubmitting ? "Envoi..." : "Confirmer la Soumission"}
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
            <span>Directives du Pôle Digital UEC</span>
          </CardTitle>
          <CardDescription className="text-slate-400">
            Charte de production et rigueur méthodologique
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-4 rounded-xl bg-[#172033] border border-[#27354F] space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white">Charte Officielle UEC — أصحاب الفكرة والعقول</span>
              <span className="text-uec-red font-semibold text-[11px]">En vigueur</span>
            </div>
            <p className="text-xs text-slate-300">
              Tous les visuels, vidéos et contenus publiés doivent respecter rigoureusement la palette rouge (#D62839) et bleu (#2563EB) et l'identité historique clubiste.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
