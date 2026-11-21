"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { BarChart3, TrendingUp, CheckCircle2, ShieldCheck, Activity } from "lucide-react";

export default function AnalyticsPage() {
  const deptPerformance = [
    { name: "Pôle Créatif & Design", rate: 88, tasks: 24 },
    { name: "Pôle Audiovisuel & Montage", rate: 76, tasks: 18 },
    { name: "Pôle Développement Web", rate: 92, tasks: 14 },
    { name: "Stratégie & Communication", rate: 70, tasks: 10 },
    { name: "Réseaux Sociaux", rate: 85, tasks: 20 },
    { name: "Innovation Numérique", rate: 65, tasks: 6 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <BarChart3 size={24} className="text-uec-red" />
          <span>Analyses de Performance & Audit Opérationnel</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Mesure de productivité des pôles, respect des délais et traçabilité des validations.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Taux Global d'Achèvement"
          value="82.4%"
          description="Sur l'ensemble des 6 pôles"
          trend={{ value: "+5.2%", isPositive: true }}
          icon={<CheckCircle2 size={20} />}
          accentColor="green"
        />

        <StatCard
          title="Délai Moyen d'Approbation"
          value="3.4h"
          description="Entre revue et validation finale"
          trend={{ value: "-45 min", isPositive: true }}
          icon={<ShieldCheck size={20} />}
          accentColor="blue"
        />

        <StatCard
          title="Opérations Tracées"
          value="1,420"
          description="Dans la table audit_logs PostgreSQL"
          trend={{ value: "100% audité", isPositive: true }}
          icon={<Activity size={20} />}
          accentColor="cyan"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-white">Productivité et Taux de Livraison par Pôle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {deptPerformance.map((dept) => (
            <div key={dept.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">{dept.name}</span>
                <span className="text-slate-400">
                  <strong className="text-white">{dept.rate}%</strong> ({dept.tasks} livrables validés)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-uec-blue to-uec-red rounded-full"
                  style={{ width: `${dept.rate}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
