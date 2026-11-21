"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import {
  ApprovalDecisionModal,
  ApprovalDecisionType,
  ApprovalSubmissionItem,
} from "@/components/dashboard/approval-decision-modal";

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
  const [activeModal, setActiveModal] = useState<{
    submission: ApprovalItem;
    decisionType: ApprovalDecisionType;
  } | null>(null);

  const handleOpenDecision = (item: ApprovalItem, decisionType: ApprovalDecisionType) => {
    setNotice(null);
    setActiveModal({ submission: item, decisionType });
  };

  const handleDecisionSuccess = (
    submissionId: string,
    decisionType: ApprovalDecisionType,
    message: string
  ) => {
    setApprovals((prev) => prev.filter((a) => a.id !== submissionId));
    setNotice({
      type: "success",
      message,
    });
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
            <div className="p-6">
              <EmptyState
                icon={CheckCircle2}
                title="Toutes les approbations sont à jour"
                description="Aucun livrable en attente de décision finale dans la file Super Admin. Les projets avancent selon les standards UEC."
              />
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
                        onClick={() => handleOpenDecision(item, "REJECTED")}
                        className="text-xs bg-rose-700 hover:bg-rose-800"
                      >
                        <XCircle size={14} className="mr-1" />
                        Rejeter
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDecision(item, "REVISION")}
                        className="text-xs text-amber-300 border-amber-800 hover:bg-amber-950/40"
                      >
                        <RotateCcw size={14} className="mr-1" />
                        Révision Requise
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenDecision(item, "APPROVED")}
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
