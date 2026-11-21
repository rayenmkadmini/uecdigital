"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Inbox, Plus, Clock, Search, Send, CheckCircle2 } from "lucide-react";

interface ServiceRequest {
  id: string;
  title: string;
  type: "DESIGN_REQUEST" | "VIDEO_REQUEST" | "PHOTOGRAPHY_REQUEST" | "DEVELOPMENT_REQUEST" | "TECHNICAL_SUPPORT";
  requester: string;
  targetDepartment: string;
  status: "PENDING" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  date: string;
}

const REQUESTS_DATA: ServiceRequest[] = [
  {
    id: "req-01",
    title: "Affiche Tournoi Universitaire de Football",
    type: "DESIGN_REQUEST",
    requester: "Bureau Exécutif UEC",
    targetDepartment: "Pôle Créatif & Design",
    status: "ACCEPTED",
    priority: "HIGH",
    date: "19 Nov 2026",
  },
  {
    id: "req-02",
    title: "Couverture Vidéo Cérémonie Remise des Diplômes",
    type: "VIDEO_REQUEST",
    requester: "Commission Événements",
    targetDepartment: "Pôle Audiovisuel & Montage",
    status: "PENDING",
    priority: "MEDIUM",
    date: "20 Nov 2026",
  },
  {
    id: "req-03",
    title: "Correction Bug Formulaire d'Adhésion",
    type: "DEVELOPMENT_REQUEST",
    requester: "Pôle Stratégie",
    targetDepartment: "Pôle Développement Web",
    status: "IN_PROGRESS",
    priority: "CRITICAL",
    date: "20 Nov 2026",
  },
];

export default function RequestsPage() {
  const [requests] = useState<ServiceRequest[]>(REQUESTS_DATA);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Inbox size={24} className="text-uec-red" />
            <span>Demandes de Prestations Internes</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Centralisation des besoins créatifs, techniques et audiovisuels des commissions UEC.
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
          <Plus size={15} className="mr-1.5" />
          Nouvelle Demande
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-[#1F2937]">
            {requests.map((req) => (
              <div
                key={req.id}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-900/40 transition-colors"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{req.title}</span>
                    <Badge variant="cyan" size="sm">
                      {req.type.replace("_", " ")}
                    </Badge>
                    <Badge
                      variant={
                        req.status === "COMPLETED"
                          ? "approved"
                          : req.status === "PENDING"
                          ? "pending"
                          : "review"
                      }
                      size="sm"
                    >
                      {req.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>Demandeur : <strong className="text-slate-200">{req.requester}</strong></span>
                    <span>•</span>
                    <span>Attribué à : <strong className="text-uec-blue">{req.targetDepartment}</strong></span>
                    <span>•</span>
                    <span>Date : {req.date}</span>
                  </div>
                </div>

                <div className="self-end md:self-center">
                  <Button variant="outline" size="sm" className="text-xs">
                    Traiter Demande
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
