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
  AlertCircle,
} from "lucide-react";
import { executeFinalApproval } from "@/app/actions/approvals";

export interface ApprovalItem {
  id: string;
  taskTitle: string;
  projectTitle: string;
  department: string;
  submittedBy: string;
  submittedAt: string;
  version: number;
  notes: string;
}

interface ApprovalsViewProps {
  userEmail: string;
  initialApprovals: ApprovalItem[];
}

export function ApprovalsView({ userEmail, initialApprovals }: ApprovalsViewProps) {
  const [approvals, setApprovals] = useState<ApprovalItem[]>(initialApprovals);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const handleAction = async (id: string, action: "APPROVED" | "REVISION" | "REJECTED", title: string) => {
    setIsProcessing(id);
    setNotice(null);

    try {
      if (action === "APPROVED") {
        const res = await executeFinalApproval(id, "Validé définitivement par le Super Administrateur.");
        if (res.success) {
          setApprovals((prev) => prev.filter((a) => a.id !== id));
          setNotice({
            type: "success",
            message: `Livrable "${title}" validé définitivement par le Super Administrateur.`,
          });
        } else {
          setNotice({ type: "error", message: res.message });
        }
      } else {
        const reason = window.prompt(
          action === "REVISION" ? "Motif de la demande de révision :" : "Motif du rejet officiel :",
          action === "REVISION" ? "Modifications techniques requises." : "Non conforme aux critères UEC."
        );
        if (!reason) {
          setIsProcessing(null);
          return;
        }

        setApprovals((prev) => prev.filter((a) => a.id !== id));
        setNotice({
          type: "success",
          message: action === "REVISION"
            ? `Demande de révision transmise pour "${title}".`
            : `Livrable "${title}" rejeté.`,
        });
      }
    } catch (err: any) {
      setNotice({ type: "error", message: err.message || "Erreur de traitement" });
    } finally {
      setIsProcessing(null);
    }
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
              <p className="text-xs text-slate-400 mt-1">Aucun livrable en attente de décision dans la base PostgreSQL.</p>
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
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <div className="text-xs text-slate-400">
                      Soumis par : <strong className="text-slate-200">{item.submittedBy}</strong> • Projet :{" "}
                      <strong className="text-slate-200">{item.projectTitle}</strong>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={isProcessing === item.id}
                        onClick={() => handleAction(item.id, "REJECTED", item.taskTitle)}
                        className="text-xs bg-rose-700 hover:bg-rose-800"
                      >
                        <XCircle size={14} className="mr-1" />
                        Rejeter
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isProcessing === item.id}
                        onClick={() => handleAction(item.id, "REVISION", item.taskTitle)}
                        className="text-xs text-amber-300 border-amber-800 hover:bg-amber-950/40"
                      >
                        <RotateCcw size={14} className="mr-1" />
                        Révision Requise
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={isProcessing === item.id}
                        onClick={() => handleAction(item.id, "APPROVED", item.taskTitle)}
                        className="text-xs bg-emerald-600 hover:bg-emerald-500 border-emerald-500/50"
                      >
                        <CheckCircle2 size={14} className="mr-1" />
                        {isProcessing === item.id ? "Validation..." : "Valider Définitivement"}
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
