"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Megaphone, Plus, Clock, Shield } from "lucide-react";

export default function AnnouncementsPage() {
  const announcements = [
    {
      id: "ann-01",
      title: "Lancement Officiel de l'Espace Digital UEC",
      author: "Super Admin",
      date: "20 Nov 2026",
      priority: "CRITICAL",
      content:
        "Bienvenue sur la plateforme centralisée du Pôle Digital de l'Union des Étudiants Clubistes. Tous les projets, tâches et validations de livrables doivent désormais transiter par ce système.",
    },
    {
      id: "ann-02",
      title: "Consignes de Charte Graphique — Saison 2026/2027",
      author: "Pôle Créatif & Design",
      date: "18 Nov 2026",
      priority: "HIGH",
      content:
        "Tous les visuels doivent impérativement respecter le code couleur rouge UEC (#D62839) et la typographie officielle. Téléchargez le pack d'assets dans la section Médiathèque.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Megaphone size={24} className="text-uec-red" />
            <span>Annonces & Directives Internes</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Communications officielles diffusées à l'ensemble des membres ou à des pôles spécifiques.
          </p>
        </div>

        <Button variant="primary" size="sm">
          <Plus size={15} className="mr-1.5" />
          Publier une Annonce
        </Button>
      </div>

      <div className="space-y-4">
        {announcements.map((a) => (
          <Card key={a.id} className="p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant={a.priority === "CRITICAL" ? "red" : "pending"} size="sm">
                    {a.priority}
                  </Badge>
                  <h3 className="text-base font-bold text-white">{a.title}</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Par {a.author} • {a.date}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">{a.content}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
