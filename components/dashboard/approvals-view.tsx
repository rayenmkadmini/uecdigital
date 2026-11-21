"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  AlertTriangle,
} from "lucide-react";

interface ApprovalItem {
  id: string;
  taskTitle: string;
  project: string;
  department: string;
  submittedBy: string;
  coordinatorReviewer: string;
  version: number;
  submittedAt: string;
  notes: string;
}

const INITIAL_APPROVALS: ApprovalItem[] = [
  {
    id: "app-01",
    taskTitle: "Affiche Officielle — Derby Tunisien 2026",
    project: "Campagne Visuelle Derby",
    department: "Créatif & Design",
    submittedBy: "Yassine Ayari",
    coordinatorReviewer: "Nourhene Trabelsi (Validé Coord)",
    version: 2,
    submittedAt: "Aujourd'hui à 14:30",
    notes: "Formats 1080x1350 et stories conformes à la charte. Logos partenaires intégrés.",
  },
  {
    id: "app-02",
    taskTitle: "Teaser Vidéo — Lancement Espace Digital",
    project: "Communication Digitale",
    department: "Audiovisuel & Montage",
    submittedBy: "Karim Zouari",
    coordinatorReviewer: "Fares Mansouri (Validé Coord)",
    version: 1,
    submittedAt: "Aujourd'hui à 11:15",
    notes: "Rendu 4K 60fps. Bande sonore originale UEC synchronisée.",
  },
];

export function ApprovalsView({ userEmail }: { userEmail: string }) {
  const [approvals, setApprovals] = useState<ApprovalItem[]>(INITIAL_APPROVALS);
  const [notice, setNotice] = useState<string | null>(null);

  const handleAction = (id: string, action: "APPROVED" | "REVISION" | "REJECTED", title: string) => {
    setApprovals(approvals.filter((a) => a.id !== id));
    if (action === "APPROVED") {
      setNotice(`✅ Livrable "${title}" validé définitivement par le Super Administrateur.`);
    } else if (action === "REVISION") {
      setNotice(`⚠️ Demande de révision envoyée pour "${title}".`);
    } else {
      setNotice(`❌ Livrable "${title}" rejeté.`);
    }
    setTimeout(() => setNotice(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <ShieldCheck size={24} className="text-uec-red" />
              <span>Chambre d'Approbation Finale</span>
            </h1>
            <Badge variant="superAdmin">SUPER ADMIN ACCÈS VÉRIFIÉ</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Garantie de qualité institutionnelle et validation des productions avant diffusion publique.
            Session auditée pour : <span className="text-slate-200 font-mono">{userEmail}</span>
          </p>
        </div>
      </div>

      {/* Mandatory Rule Banner */}
      <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 flex items-start gap-3 shadow-lg">
        <AlertTriangle size={20} className="text-uec-red shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <p className="font-bold text-red-200">
            Autorité Exclusive : Seul le Super Administrateur peut prononcer la validation finale.
          </p>
          <p className="text-slate-300">
            Cette route est protégée par un contrôle d'accès strict côté serveur (<code className="text-uec-cyan">requireSuperAdmin()</code>).
            Les coordinateurs assurent la revue technique préalable de leur pôle, mais l'approbation définitive,
            le rejet ou la demande de révision officielle relèvent exclusivement du Super Admin.
          </p>
        </div>
      </div>

      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-700 text-xs text-emerald-200 flex items-center justify-between shadow-lg">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-emerald-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Approvals List */}
      <Card className="border-uec-red/30">
        <CardHeader className="bg-red-950/20 border-b border-red-900/30">
          <CardTitle className="text-white">Livrables en Attente de Décision</CardTitle>
          <CardDescription className="text-slate-300">
            {approvals.length} dossier(s) transmis après validation technique par les coordinateurs.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {approvals.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <CheckCircle2 size={36} className="text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-medium">Toutes les approbations sont à jour.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1F2937]">
              {approvals.map((item) => (
                <div key={item.id} className="p-5 space-y-3 hover:bg-slate-900/40 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold text-white">{item.taskTitle}</span>
                      <Badge variant="coordinator" size="sm">
                        {item.department}
                      </Badge>
                      <span className="text-[10px] text-slate-400 px-2 py-0.5 rounded bg-slate-800">
                        Version {item.version}
                      </span>
                    </div>

                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock size={12} /> {item.submittedAt}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#172033] border border-[#27354F] text-xs text-slate-300 space-y-1">
                    <p className="font-semibold text-slate-200">Notes du livrable :</p>
                    <p className="italic">{item.notes}</p>
                    <p className="text-[11px] text-uec-cyan pt-1">
                      ✓ Revue préalable : {item.coordinatorReviewer}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <div className="text-xs text-slate-400">
                      Soumis par : <strong className="text-slate-200">{item.submittedBy}</strong> • Projet :{" "}
                      <strong className="text-slate-200">{item.project}</strong>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleAction(item.id, "REJECTED", item.taskTitle)}
                        className="text-xs bg-rose-700 hover:bg-rose-800"
                      >
                        <XCircle size={14} className="mr-1" />
                        Rejeter
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAction(item.id, "REVISION", item.taskTitle)}
                        className="text-xs text-amber-300 border-amber-800 hover:bg-amber-950/40"
                      >
                        <RotateCcw size={14} className="mr-1" />
                        Révision Requise
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleAction(item.id, "APPROVED", item.taskTitle)}
                        className="text-xs bg-emerald-600 hover:bg-emerald-500 border-emerald-500/50"
                      >
                        <CheckCircle2 size={14} className="mr-1" />
                        Valider Définitivement
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
