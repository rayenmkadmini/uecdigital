"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckSquare, Plus, Clock, Search, Filter, ShieldCheck, CheckCircle2 } from "lucide-react";

interface TaskItem {
  id: string;
  title: string;
  project: string;
  assignee: string;
  department: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "BACKLOG" | "TODO" | "IN_PROGRESS" | "SUBMITTED" | "COORDINATOR_REVIEW" | "SUPER_ADMIN_APPROVAL" | "APPROVED" | "DONE";
  dueDate: string;
}

const TASKS_DATA: TaskItem[] = [
  {
    id: "t-01",
    title: "Affiche Officielle Derby Tunisien",
    project: "Campagne Visuelle Derby",
    assignee: "Yassine Ayari",
    department: "Créatif & Design",
    priority: "CRITICAL",
    status: "SUPER_ADMIN_APPROVAL",
    dueDate: "22 Nov 2026",
  },
  {
    id: "t-02",
    title: "Teaser Vidéo Lancement",
    project: "Communication Digitale",
    assignee: "Karim Zouari",
    department: "Audiovisuel & Montage",
    priority: "HIGH",
    status: "COORDINATOR_REVIEW",
    dueDate: "23 Nov 2026",
  },
  {
    id: "t-03",
    title: "Module Paiement Adhésions",
    project: "Portail Numérique",
    assignee: "Rayen Mkadmini",
    department: "Développement Web",
    priority: "HIGH",
    status: "IN_PROGRESS",
    dueDate: "25 Nov 2026",
  },
  {
    id: "t-04",
    title: "Grille de Publication Instagram Décembre",
    project: "Réseaux Sociaux",
    assignee: "Mehdi Bouzid",
    department: "Social Media",
    priority: "MEDIUM",
    status: "TODO",
    dueDate: "28 Nov 2026",
  },
  {
    id: "t-05",
    title: "Charte Éditoriale Saison 2026/27",
    project: "Communication Digitale",
    assignee: "Sarra Ben Amor",
    department: "Stratégie",
    priority: "MEDIUM",
    status: "APPROVED",
    dueDate: "15 Nov 2026",
  },
];

export default function TasksPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = TASKS_DATA.filter((t) => {
    const matchSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === "ALL" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getStatusBadge = (status: TaskItem["status"]) => {
    switch (status) {
      case "SUPER_ADMIN_APPROVAL":
        return <Badge variant="superAdmin">Validation Super Admin</Badge>;
      case "COORDINATOR_REVIEW":
        return <Badge variant="coordinator">Revue Coordinateur</Badge>;
      case "APPROVED":
        return <Badge variant="approved">Validé Définitivement</Badge>;
      case "IN_PROGRESS":
        return <Badge variant="review">En cours</Badge>;
      case "TODO":
        return <Badge variant="default">À faire</Badge>;
      case "DONE":
        return <Badge variant="approved">Achevé</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <CheckSquare size={24} className="text-uec-red" />
            <span>Gestion des Tâches & Livrables</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Cycle opérationnel complet : assignation, revue de conformité et validation finale Super Admin.
          </p>
        </div>

        <Button variant="primary" size="sm">
          <Plus size={15} className="mr-1.5" />
          Nouvelle Tâche
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher une tâche..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-[#111827] border border-[#1F2937] p-1 rounded-lg overflow-x-auto">
          {["ALL", "IN_PROGRESS", "COORDINATOR_REVIEW", "SUPER_ADMIN_APPROVAL", "APPROVED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${
                statusFilter === st
                  ? "bg-uec-red text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {st === "ALL" ? "Toutes" : st.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-[#1F2937]">
            {filtered.map((task) => (
              <div
                key={task.id}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-900/40 transition-colors"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{task.title}</span>
                    <Badge variant={task.priority === "CRITICAL" ? "red" : "default"} size="sm">
                      {task.priority}
                    </Badge>
                    {getStatusBadge(task.status)}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>Projet : <strong className="text-slate-300">{task.project}</strong></span>
                    <span>•</span>
                    <span>Assigné : <strong className="text-slate-300">{task.assignee}</strong></span>
                    <span>•</span>
                    <span>Pôle : <strong className="text-uec-cyan">{task.department}</strong></span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> Échéance : {task.dueDate}
                    </span>
                  </div>
                </div>

                <div className="self-end md:self-center">
                  <Button variant="outline" size="sm" className="text-xs">
                    Consulter Livrable
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
