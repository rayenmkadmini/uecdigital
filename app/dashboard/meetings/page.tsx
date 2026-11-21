"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users2, Plus, Clock, MapPin, FileText } from "lucide-react";

export default function MeetingsPage() {
  const meetings = [
    {
      id: "meet-01",
      title: "Réunion Hebdomadaire de Coordination",
      date: "Dimanche 22 Nov 2026 - 20:30",
      location: "Google Meet & Siège UEC",
      participants: "Coordinateurs + Super Admin",
      status: "SCHEDULED",
    },
    {
      id: "meet-02",
      title: "Brainstorming Campagne Derby 2026",
      date: "Vendredi 20 Nov 2026 - 18:00",
      location: "Local UEC",
      participants: "Pôles Design & Vidéo",
      status: "COMPLETED",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users2 size={24} className="text-uec-red" />
            <span>Réunions & Procès-Verbaux (PV)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Traçabilité des réunions de pôle, ordres du jour et feuilles de présence.
          </p>
        </div>

        <Button variant="primary" size="sm">
          <Plus size={15} className="mr-1.5" />
          Planifier une Réunion
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-[#1F2937]">
            {meetings.map((m) => (
              <div
                key={m.id}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-900/40 transition-colors"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{m.title}</span>
                    <Badge variant={m.status === "COMPLETED" ? "approved" : "review"} size="sm">
                      {m.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1 text-slate-300">
                      <Clock size={12} /> {m.date}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MapPin size={12} /> {m.location}
                    </span>
                    <span>•</span>
                    <span>{m.participants}</span>
                  </div>
                </div>

                <div className="self-end md:self-center">
                  <Button variant="outline" size="sm" className="text-xs">
                    <FileText size={14} className="mr-1" />
                    Consulter le PV
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
