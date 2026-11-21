"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Users, FolderKanban, CheckSquare, Shield, AlertCircle, Plus } from "lucide-react";
import type { DepartmentWithStats } from "@/lib/data/departments";
import type { UserRole } from "@/lib/auth/rbac";

interface DepartmentsViewProps {
  departments: DepartmentWithStats[];
  userRole: UserRole;
}

export function DepartmentsView({ departments, userRole }: DepartmentsViewProps) {
  const [filterActive, setFilterActive] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const filtered = departments.filter((d) => {
    if (filterActive === "ACTIVE") return d.is_active;
    if (filterActive === "INACTIVE") return !d.is_active;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Building2 size={24} className="text-uec-red" />
            <span>Pôles Spécialisés du Département Digital</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Organisation matricielle officielle — Données synchronisées en temps réel avec la base PostgreSQL ({departments.length} pôles répertoriés).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#111827] border border-[#1F2937] p-1 rounded-lg">
            {(["ALL", "ACTIVE", "INACTIVE"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilterActive(mode)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  filterActive === mode ? "bg-uec-red text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {mode === "ALL" ? "Tous" : mode === "ACTIVE" ? "Actifs" : "Inactifs"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-slate-400 space-y-3">
          <Building2 size={40} className="mx-auto text-slate-600" />
          <h3 className="text-base font-bold text-white">Aucun département trouvé</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Aucun pôle de compétences ne correspond à ce filtre dans la base de données.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((dept) => (
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
                    <span>{dept.coordinator_name}</span>
                  </span>
                </div>
                <CardTitle className="text-base text-white mt-2">{dept.name}</CardTitle>
                <CardDescription className="text-slate-400 line-clamp-2 mt-1">
                  {dept.description || "Pôle de production et de gouvernance digitale."}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-2">
                <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-[#172033] border border-[#27354F] text-xs">
                  <div className="flex flex-col items-center text-center">
                    <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                      <Users size={12} className="text-uec-blue" />
                      <span>Membres</span>
                    </div>
                    <span className="font-bold text-white text-sm mt-0.5">{dept.member_count}</span>
                  </div>

                  <div className="flex flex-col items-center text-center border-x border-[#27354F]/60">
                    <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                      <FolderKanban size={12} className="text-uec-red" />
                      <span>Projets</span>
                    </div>
                    <span className="font-bold text-white text-sm mt-0.5">{dept.project_count}</span>
                  </div>

                  <div className="flex flex-col items-center text-center">
                    <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                      <CheckSquare size={12} className="text-uec-cyan" />
                      <span>Tâches</span>
                    </div>
                    <span className="font-bold text-white text-sm mt-0.5">{dept.active_task_count}</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 rounded-full ${dept.is_active ? "bg-emerald-400" : "bg-slate-500"}`}
                    />
                    <span>{dept.is_active ? "Opérationnel" : "En pause"}</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Depuis le {new Date(dept.created_at).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
