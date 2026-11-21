"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FolderKanban, Plus, Clock, Search, Filter } from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string;
  department: string;
  status: "PLANNING" | "ACTIVE" | "ON_HOLD" | "IN_REVIEW" | "COMPLETED";
  progress: number;
  startDate: string;
  endDate: string;
}

const PROJECTS_DATA: Project[] = [
  {
    id: "proj-01",
    name: "Campagne Visuelle Derby 2026",
    description: "Production des visuels officiels, affiches pour les sections et bannières numériques.",
    department: "Créatif & Design",
    status: "ACTIVE",
    progress: 80,
    startDate: "01 Nov 2026",
    endDate: "30 Nov 2026",
  },
  {
    id: "proj-02",
    name: "Aftermovie Spécial Tifo UEC",
    description: "Captation cinématographique, montage 4K et composition sonore exclusive.",
    department: "Audiovisuel & Montage",
    status: "IN_REVIEW",
    progress: 95,
    startDate: "10 Nov 2026",
    endDate: "05 Déc 2026",
  },
  {
    id: "proj-03",
    name: "Portail Numérique UEC — Phase 2",
    description: "Espace adhésion en ligne, billetterie interne et gestion des cotisations étudiantes.",
    department: "Développement Web",
    status: "ACTIVE",
    progress: 60,
    startDate: "15 Oct 2026",
    endDate: "15 Jan 2027",
  },
  {
    id: "proj-04",
    name: "Stratégie Partenariats & Sponsors 2026/27",
    description: "Dossier de sponsoring interactif et kits médias à destination des entreprises partenaires.",
    department: "Stratégie & Com",
    status: "PLANNING",
    progress: 25,
    startDate: "01 Déc 2026",
    endDate: "28 Fév 2027",
  },
];

export default function ProjectsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filtered = PROJECTS_DATA.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FolderKanban size={24} className="text-uec-red" />
            <span>Gestion des Projets Numériques</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Suivi des initiatives, jalons et échéances du Pôle Digital UEC.
          </p>
        </div>

        <Button variant="primary" size="sm">
          <Plus size={15} className="mr-1.5" />
          Nouveau Projet
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher un projet..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-[#111827] border border-[#1F2937] p-1 rounded-lg">
          {["ALL", "ACTIVE", "IN_REVIEW", "PLANNING"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                statusFilter === st
                  ? "bg-uec-red text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {st === "ALL" ? "Tous" : st}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filtered.map((proj) => (
          <Card key={proj.id} className="hover:border-slate-700 transition-all">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between w-full">
                <Badge variant={proj.status === "ACTIVE" ? "approved" : "review"} size="sm">
                  {proj.status}
                </Badge>
                <span className="text-[11px] text-uec-cyan font-medium">
                  {proj.department}
                </span>
              </div>
              <CardTitle className="text-base text-white mt-2">{proj.name}</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <p className="text-xs text-slate-300">{proj.description}</p>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Progression</span>
                  <span className="font-bold text-white">{proj.progress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-uec-blue to-uec-red rounded-full"
                    style={{ width: `${proj.progress}%` }}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-[#1F2937] flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock size={12} /> {proj.startDate} → {proj.endDate}
                </span>
                <span className="text-uec-cyan hover:underline cursor-pointer font-semibold">
                  Détails & Tâches →
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
