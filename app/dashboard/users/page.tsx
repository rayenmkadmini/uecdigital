"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Users, UserPlus, Search, Shield, Mail, Phone } from "lucide-react";

interface Member {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "COORDINATOR" | "MEMBER";
  department: string;
  status: "ACTIVE" | "INACTIVE";
}

const MEMBERS_DATA: Member[] = [
  {
    id: "m-01",
    name: "Yassine Ben Salem",
    email: "superadmin@uec.tn",
    role: "SUPER_ADMIN",
    department: "Direction Digitale",
    status: "ACTIVE",
  },
  {
    id: "m-02",
    name: "Nourhene Trabelsi",
    email: "nourhene.t@uec.tn",
    role: "COORDINATOR",
    department: "Pôle Créatif & Design",
    status: "ACTIVE",
  },
  {
    id: "m-03",
    name: "Fares Mansouri",
    email: "fares.m@uec.tn",
    role: "COORDINATOR",
    department: "Pôle Audiovisuel & Montage",
    status: "ACTIVE",
  },
  {
    id: "m-04",
    name: "Aziz Gharbi",
    email: "aziz.g@uec.tn",
    role: "COORDINATOR",
    department: "Pôle Développement Web",
    status: "ACTIVE",
  },
  {
    id: "m-05",
    name: "Yassine Ayari",
    email: "yassine.a@uec.tn",
    role: "MEMBER",
    department: "Pôle Créatif & Design",
    status: "ACTIVE",
  },
  {
    id: "m-06",
    name: "Karim Zouari",
    email: "karim.z@uec.tn",
    role: "MEMBER",
    department: "Pôle Audiovisuel & Montage",
    status: "ACTIVE",
  },
  {
    id: "m-07",
    name: "Rayen Mkadmini",
    email: "rayen.m@uec.tn",
    role: "MEMBER",
    department: "Pôle Développement Web",
    status: "ACTIVE",
  },
];

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const filtered = MEMBERS_DATA.filter((m) => {
    const matchSearch =
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = roleFilter === "ALL" || m.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users size={24} className="text-uec-red" />
            <span>Membres & Rôles du Pôle Digital</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gouvernance stricte à 3 niveaux : Super Admin, Coordinateurs d'équipe, Membres.
          </p>
        </div>

        <Button variant="primary" size="sm">
          <UserPlus size={15} className="mr-1.5" />
          Inviter un Membre
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher par nom, email ou pôle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-[#111827] border border-[#1F2937] p-1 rounded-lg">
          {["ALL", "SUPER_ADMIN", "COORDINATOR", "MEMBER"].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                roleFilter === r
                  ? "bg-uec-red text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {r === "ALL" ? "Tous" : r.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-[#1F2937]">
            {filtered.map((member) => (
              <div
                key={member.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-900/40 transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  <Avatar name={member.name} size="md" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{member.name}</span>
                      <Badge
                        variant={
                          member.role === "SUPER_ADMIN"
                            ? "superAdmin"
                            : member.role === "COORDINATOR"
                            ? "coordinator"
                            : "member"
                        }
                        size="sm"
                      >
                        {member.role.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{member.email}</p>
                    <p className="text-[11px] text-uec-cyan font-medium">{member.department}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Button variant="outline" size="sm" className="text-xs">
                    Gérer Accès
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
