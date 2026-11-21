"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Plus, CheckCircle2, Clock, AlertCircle } from "lucide-react";

export default function EquipmentPage() {
  const items = [
    {
      id: "eq-01",
      name: "Sony Alpha 7 IV (Boîtier)",
      category: "PHOTO_VIDEO",
      serialNumber: "SN-SNY-78491",
      status: "AVAILABLE",
      borrower: null,
    },
    {
      id: "eq-02",
      name: "Objectif Sigma 24-70mm f/2.8 DG DN",
      category: "PHOTO_VIDEO",
      serialNumber: "SN-SIG-19283",
      status: "LOANED",
      borrower: "Fares Mansouri (Pôle Vidéo)",
    },
    {
      id: "eq-03",
      name: "Micro Cravate Sans Fil DJI Mic 2",
      category: "AUDIO",
      serialNumber: "SN-DJI-48201",
      status: "AVAILABLE",
      borrower: null,
    },
    {
      id: "eq-04",
      name: "Stabilisateur Ronin RS3 Pro",
      category: "ACCESSOIRES",
      serialNumber: "SN-RON-99214",
      status: "LOANED",
      borrower: "Karim Zouari",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Package size={24} className="text-uec-red" />
            <span>Inventaire & Prêts de Matériel</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestion du parc audiovisuel et informatique UEC, réservations et suivi des emprunts.
          </p>
        </div>

        <Button variant="primary" size="sm">
          <Plus size={15} className="mr-1.5" />
          Ajouter Équipement
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((it) => (
          <Card key={it.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] text-uec-cyan font-bold">{it.category}</span>
                <h3 className="text-sm font-bold text-white mt-0.5">{it.name}</h3>
                <p className="text-[11px] text-slate-400">{it.serialNumber}</p>
              </div>
              <Badge variant={it.status === "AVAILABLE" ? "approved" : "pending"} size="sm">
                {it.status === "AVAILABLE" ? "Disponible" : "En Prêt"}
              </Badge>
            </div>

            <div className="pt-2 border-t border-[#1F2937] flex items-center justify-between text-xs text-slate-400">
              <span>{it.borrower ? `Emprunté par : ${it.borrower}` : "Au local UEC"}</span>
              <Button variant="outline" size="sm" className="text-xs h-7">
                {it.status === "AVAILABLE" ? "Emprunter" : "Retourner"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
