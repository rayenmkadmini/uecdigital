"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Plus, Clock, AlertCircle } from "lucide-react";

interface CalendarEntry {
  id: string;
  title: string;
  channel: string;
  scheduledDate: string;
  workflowStage: "IDEA" | "DRAFT" | "DESIGN" | "REVIEW" | "SUPER_ADMIN_APPROVAL" | "SCHEDULED" | "PUBLISHED";
  author: string;
}

const CALENDAR_ENTRIES: CalendarEntry[] = [
  {
    id: "cal-01",
    title: "Post Visuel Annonce Derby UEC",
    channel: "Instagram & Facebook",
    scheduledDate: "21 Nov 2026 - 19:00",
    workflowStage: "SUPER_ADMIN_APPROVAL",
    author: "Mehdi Bouzid",
  },
  {
    id: "cal-02",
    title: "Reel TikTok Teaser Supporters",
    channel: "TikTok",
    scheduledDate: "22 Nov 2026 - 21:00",
    workflowStage: "DESIGN",
    author: "Karim Zouari",
  },
  {
    id: "cal-03",
    title: "Communiqué Officiel du Bureau",
    channel: "Site Web & Facebook",
    scheduledDate: "23 Nov 2026 - 12:00",
    workflowStage: "DRAFT",
    author: "Sarra Ben Amor",
  },
];

export default function CalendarPage() {
  const [entries] = useState<CalendarEntry[]>(CALENDAR_ENTRIES);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Calendar size={24} className="text-uec-red" />
            <span>Calendrier Éditorial & Publications</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Planification des contenus. Règle de sécurité : la validation finale n'enclenche aucune publication automatique externe.
          </p>
        </div>

        <Button variant="primary" size="sm">
          <Plus size={15} className="mr-1.5" />
          Planifier un Contenu
        </Button>
      </div>

      <div className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-900/60 text-xs text-blue-300 flex items-start gap-2.5">
        <AlertCircle size={16} className="shrink-0 text-uec-cyan mt-0.5" />
        <span>
          <strong>Gouvernance de diffusion :</strong> Même après validation par le Super Administrateur,
          la publication reste manuelle et sous le contrôle opérationnel exclusif du pôle Réseaux Sociaux.
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-[#1F2937]">
            {entries.map((item) => (
              <div
                key={item.id}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-900/40 transition-colors"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{item.title}</span>
                    <Badge variant="cyan" size="sm">
                      {item.channel}
                    </Badge>
                    <Badge
                      variant={
                        item.workflowStage === "SUPER_ADMIN_APPROVAL"
                          ? "superAdmin"
                          : item.workflowStage === "SCHEDULED"
                          ? "approved"
                          : "review"
                      }
                      size="sm"
                    >
                      {item.workflowStage.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1 text-slate-300">
                      <Clock size={12} /> Prévu le : {item.scheduledDate}
                    </span>
                    <span>•</span>
                    <span>Auteur : {item.author}</span>
                  </div>
                </div>

                <div className="self-end md:self-center">
                  <Button variant="outline" size="sm" className="text-xs">
                    Consulter Brouillon
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
