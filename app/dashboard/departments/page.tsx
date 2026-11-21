"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Users, FolderKanban, Plus, CheckCircle2, Shield } from "lucide-react";

interface Department {
  id: string;
  code: string;
  name: string;
  coordinator: string;
  memberCount: number;
  projectCount: number;
  description: string;
  color: string;
}

const DEPARTMENTS_DATA: Department[] = [
  {
    id: "dept-01",
    code: "DESIGN",
    name: "Pôle Créatif & Design",
    coordinator: "Nourhene Trabelsi",
    memberCount: 8,
    projectCount: 4,
    description: "Création graphique, affiches officielles de match, identité visuelle et branding UEC.",
    color: "#D62839",
  },
  {
    id: "dept-02",
    code: "VIDEO",
    name: "Pôle Audiovisuel & Montage",
    coordinator: "Fares Mansouri",
    memberCount: 7,
    projectCount: 3,
    description: "Captation vidéo, aftermovies de tifos et derbys, montages dynamiques et teasers officiels.",
    color: "#2563EB",
  },
  {
    id: "dept-03",
    code: "WEB",
    name: "Pôle Développement Web & Systèmes",
    coordinator: "Aziz Gharbi",
    memberCount: 6,
    projectCount: 2,
    description: "Maintenance du portail UEC, gestion de la plateforme Espace Digital, bots et outils internes.",
    color: "#22D3EE",
  },
  {
    id: "dept-04",
    code: "STRATEGY",
    name: "Stratégie & Communication Digitale",
    coordinator: "Sarra Ben Amor",
    memberCount: 5,
    projectCount: 3,
    description: "Lignes éditoriales, relations publiques numériques, campagnes de sponsoring et d'adhésion.",
    color: "#F59E0B",
  },
  {
    id: "dept-05",
    code: "SOCIAL_MEDIA",
    name: "Réseaux Sociaux & Modération",
    coordinator: "Mehdi Bouzid",
    memberCount: 5,
    projectCount: 2,
    description: "Gestion des pages Facebook, Instagram, TikTok, modération de communauté et live-tweet.",
    color: "#8B5CF6",
  },
  {
    id: "dept-06",
    code: "INNOVATION",
    name: "Innovation & Projets Numériques",
    coordinator: "Mohamed Ali Dridi",
    memberCount: 3,
    projectCount: 1,
    description: "Veille technologique, intelligence artificielle, automatisation de workflows et archives.",
    color: "#10B981",
  },
];

export default function DepartmentsPage() {
  const [departments] = useState<Department[]>(DEPARTMENTS_DATA);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Building2 size={24} className="text-uec-red" />
            <span>Pôles Spécialisés du Département Digital</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Organisation matricielle officielle : 6 pôles opérationnels avec un coordinateur dédié par pôle.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {departments.map((dept) => (
          <Card key={dept.id} className="hover:border-slate-700 transition-all flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between w-full">
                <Badge
                  style={{
                    backgroundColor: `${dept.color}20`,
                    borderColor: `${dept.color}60`,
                    color: dept.color,
                  }}
                  size="sm"
                >
                  {dept.code}
                </Badge>
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Shield size={12} className="text-uec-cyan" />
                  {dept.coordinator}
                </span>
              </div>
              <CardTitle className="text-base text-white mt-2">{dept.name}</CardTitle>
              <CardDescription className="text-slate-400 line-clamp-2 mt-1">
                {dept.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-2">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-[#172033] border border-[#27354F] text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <Users size={14} className="text-uec-blue" />
                  <span><strong>{dept.memberCount}</strong> Membres</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <FolderKanban size={14} className="text-uec-red" />
                  <span><strong>{dept.projectCount}</strong> Projets</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
