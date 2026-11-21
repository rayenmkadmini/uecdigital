"use client";

import React, { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import {
  Users,
  Search,
  Shield,
  Building2,
  CheckCircle2,
  AlertCircle,
  X,
  Settings,
  UserCheck,
  UserX,
  UserMinus,
  Mail,
} from "lucide-react";
import type { MemberListItem } from "@/lib/data/members";
import type { DepartmentWithStats } from "@/lib/data/departments";
import type { UserRole } from "@/lib/auth/rbac";
import {
  assignDepartmentMemberAction,
  removeDepartmentMemberAction,
  updateMemberRoleAction,
  toggleMemberActiveStatusAction,
} from "@/app/actions/members";

interface MembersViewProps {
  members: MemberListItem[];
  departments: DepartmentWithStats[];
  currentUserRole: UserRole;
}

export function MembersView({
  members: initialMembers,
  departments,
  currentUserRole,
}: MembersViewProps) {
  const [members, setMembers] = useState<MemberListItem[]>(initialMembers);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");

  // Selected member for modal management
  const [selectedMember, setSelectedMember] = useState<MemberListItem | null>(null);
  const [targetDeptId, setTargetDeptId] = useState<string>("");
  const [targetRole, setTargetRole] = useState<UserRole>("MEMBER");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const isSuperAdmin = currentUserRole === "SUPER_ADMIN";

  const openManageModal = (member: MemberListItem) => {
    setSelectedMember(member);
    setTargetDeptId(member.department_id || "");
    setTargetRole(member.role);
    setFeedback(null);
  };

  const closeModal = () => {
    setSelectedMember(null);
    setFeedback(null);
  };

  const handleUpdateRole = () => {
    if (!selectedMember) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await updateMemberRoleAction(selectedMember.id, targetRole);
        if (res.success) {
          setFeedback({ type: "success", message: res.message });
          setMembers((prev) =>
            prev.map((m) => (m.id === selectedMember.id ? { ...m, role: targetRole } : m))
          );
          setSelectedMember({ ...selectedMember, role: targetRole });
        } else {
          setFeedback({ type: "error", message: res.message });
        }
      } catch (err: any) {
        setFeedback({ type: "error", message: err.message || "Erreur de modification" });
      }
    });
  };

  const handleAssignDept = () => {
    if (!selectedMember || !targetDeptId) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await assignDepartmentMemberAction(targetDeptId, selectedMember.id);
        if (res.success) {
          setFeedback({ type: "success", message: res.message });
          const assignedDept = departments.find((d) => d.id === targetDeptId);
          setMembers((prev) =>
            prev.map((m) =>
              m.id === selectedMember.id
                ? {
                    ...m,
                    department_id: targetDeptId,
                    department_name: assignedDept?.name || null,
                    department_code: assignedDept?.code || null,
                  }
                : m
            )
          );
          setSelectedMember({
            ...selectedMember,
            department_id: targetDeptId,
            department_name: assignedDept?.name || null,
            department_code: assignedDept?.code || null,
          });
        } else {
          setFeedback({ type: "error", message: res.message });
        }
      } catch (err: any) {
        setFeedback({ type: "error", message: err.message || "Erreur d'assignation" });
      }
    });
  };

  const handleRemoveDept = () => {
    if (!selectedMember || !selectedMember.department_id) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await removeDepartmentMemberAction(
          selectedMember.department_id!,
          selectedMember.id
        );
        if (res.success) {
          setFeedback({ type: "success", message: res.message });
          setMembers((prev) =>
            prev.map((m) =>
              m.id === selectedMember.id
                ? { ...m, department_id: null, department_name: null, department_code: null }
                : m
            )
          );
          setSelectedMember({
            ...selectedMember,
            department_id: null,
            department_name: null,
            department_code: null,
          });
          setTargetDeptId("");
        } else {
          setFeedback({ type: "error", message: res.message });
        }
      } catch (err: any) {
        setFeedback({ type: "error", message: err.message || "Erreur de désassignation" });
      }
    });
  };

  const handleToggleStatus = (member: MemberListItem) => {
    const actionLabel = member.is_active ? "suspendre" : "réactiver";
    if (!confirm(`Confirmez-vous vouloir ${actionLabel} le compte de ${member.full_name} ?`)) {
      return;
    }

    startTransition(async () => {
      try {
        const res = await toggleMemberActiveStatusAction(member.id, !member.is_active);
        if (res.success) {
          setMembers((prev) =>
            prev.map((m) => (m.id === member.id ? { ...m, is_active: !member.is_active } : m))
          );
          if (selectedMember?.id === member.id) {
            setSelectedMember({ ...selectedMember, is_active: !member.is_active });
          }
          setFeedback({ type: "success", message: res.message });
        } else {
          setFeedback({ type: "error", message: res.message });
        }
      } catch (err: any) {
        setFeedback({ type: "error", message: err.message || "Erreur de changement de statut" });
      }
    });
  };

  const filtered = members.filter((m) => {
    const s = searchTerm.toLowerCase().trim();
    const matchSearch =
      !s ||
      m.full_name.toLowerCase().includes(s) ||
      m.email.toLowerCase().includes(s) ||
      (m.department_name && m.department_name.toLowerCase().includes(s));
    const matchRole = roleFilter === "ALL" || m.role === roleFilter;
    const matchDept =
      deptFilter === "ALL" ||
      (deptFilter === "NONE" ? !m.department_id : m.department_id === deptFilter);
    return matchSearch && matchRole && matchDept;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users size={24} className="text-uec-red" />
            <span>Membres & Gouvernance du Pôle Digital</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gouvernance matricielle à 3 niveaux : Super Admin, Coordinateurs de pôle, Membres.
            Données synchronisées en temps réel avec PostgreSQL ({members.length} membres répertoriés).
          </p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 rtl:left-auto rtl:right-3.5" />
          <Input
            placeholder="Rechercher par nom, email ou pôle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 rtl:pl-3 rtl:pr-9"
          />
        </div>

        {/* Role Filters */}
        <div className="flex items-center gap-1.5 bg-[#111827] border border-[#1F2937] p-1 rounded-lg overflow-x-auto">
          {["ALL", "SUPER_ADMIN", "COORDINATOR", "MEMBER"].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                roleFilter === r ? "bg-uec-red text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {r === "ALL" ? "Tous Rôles" : r.replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Dept Selector */}
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="bg-[#111827] border border-[#1F2937] text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-uec-red"
        >
          <option value="ALL">Tous les pôles</option>
          <option value="NONE">Sans pôle assigné</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.code})
            </option>
          ))}
        </select>
      </div>

      {/* Members List */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-slate-400 space-y-3">
          <Users size={40} className="mx-auto text-slate-600" />
          <h3 className="text-base font-bold text-white">Aucun membre trouvé</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Aucun membre ne correspond à vos critères de recherche ou de filtre actuels.
          </p>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-[#1F2937]">
              {filtered.map((member) => (
                <div
                  key={member.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-900/40 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <Avatar name={member.full_name || member.email} size="md" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{member.full_name || "Utilisateur"}</span>
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
                        <span
                          className={`h-2 w-2 rounded-full ${
                            member.is_active ? "bg-emerald-400" : "bg-rose-500"
                          }`}
                          title={member.is_active ? "Compte actif" : "Compte suspendu"}
                        />
                        {!member.is_active && (
                          <span className="text-[10px] text-rose-400 font-semibold bg-rose-950/60 border border-rose-800/40 px-1.5 py-0.2 rounded">
                            Suspendu
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <Mail size={12} className="text-slate-500" />
                        <span>{member.email}</span>
                      </p>
                      <p className="text-[11px] text-uec-cyan font-medium flex items-center gap-1 mt-0.5">
                        <Building2 size={11} />
                        <span>{member.department_name || "Sans pôle assigné"}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {isSuperAdmin && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleToggleStatus(member)}
                          className={`text-xs flex items-center gap-1 ${
                            member.is_active
                              ? "text-slate-400 hover:text-rose-400"
                              : "text-emerald-400 hover:text-emerald-300"
                          }`}
                          title={member.is_active ? "Suspendre l'accès" : "Réactiver le compte"}
                        >
                          {member.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
                          <span>{member.is_active ? "Suspendre" : "Activer"}</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs flex items-center gap-1.5 text-slate-300 hover:text-white"
                          onClick={() => openManageModal(member)}
                        >
                          <Settings size={13} className="text-uec-red" />
                          <span>Gérer Accès</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal for Super Admin member management */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-[#0e0e12] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl shadow-black/90 relative">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-uec-blue"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 pb-4 border-b border-[#1F2937]">
              <Avatar name={selectedMember.full_name} size="md" />
              <div>
                <h3 className="text-base font-bold text-white">{selectedMember.full_name}</h3>
                <p className="text-xs text-slate-400">{selectedMember.email}</p>
              </div>
            </div>

            {feedback && (
              <div
                className={`mt-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
                  feedback.type === "success"
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                    : "bg-red-500/10 border border-red-500/30 text-red-400"
                }`}
              >
                {feedback.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                <span>{feedback.message}</span>
              </div>
            )}

            <div className="space-y-4 mt-5">
              {/* Role adjustment */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Rôle Système (RBAC PostgreSQL)
                </label>
                <div className="flex gap-2">
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value as UserRole)}
                    className="flex-1 bg-[#172033] border border-[#27354F] text-white text-xs rounded-lg px-3 py-2 focus:border-uec-red focus:outline-none"
                  >
                    <option value="MEMBER">MEMBER (Membre de production)</option>
                    <option value="COORDINATOR">COORDINATOR (Coordinateur de pôle)</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN (Directeur Digital)</option>
                  </select>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isPending || targetRole === selectedMember.role}
                    onClick={handleUpdateRole}
                    className="bg-uec-red hover:bg-uec-red/90 text-white"
                  >
                    Changer
                  </Button>
                </div>
              </div>

              {/* Department assignment */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Assignation de Pôle
                </label>
                <div className="flex gap-2">
                  <select
                    value={targetDeptId}
                    onChange={(e) => setTargetDeptId(e.target.value)}
                    className="flex-1 bg-[#172033] border border-[#27354F] text-white text-xs rounded-lg px-3 py-2 focus:border-uec-red focus:outline-none"
                  >
                    <option value="">Sélectionner un pôle...</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending || !targetDeptId || targetDeptId === selectedMember.department_id}
                    onClick={handleAssignDept}
                  >
                    Assigner
                  </Button>
                </div>
              </div>

              {/* Remove from current pole if any */}
              {selectedMember.department_id && (
                <div className="pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={handleRemoveDept}
                    className="text-xs text-rose-400 hover:text-rose-300 w-full justify-start"
                  >
                    <UserMinus size={13} className="mr-1.5" />
                    <span>Désassigner du pôle actuel ({selectedMember.department_name})</span>
                  </Button>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-[#1F2937] flex justify-end">
              <Button variant="ghost" size="sm" onClick={closeModal}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
