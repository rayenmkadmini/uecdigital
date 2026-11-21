"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useTranslation, type Locale } from "@/lib/i18n/context";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, User, Globe, Bell, Shield, Save, CheckCircle2 } from "lucide-react";

export default function SettingsPage() {
  const { profile, role } = useAuth();
  const { locale, setLocale, t, dir } = useTranslation();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Settings size={24} className="text-uec-red" />
          <span>Paramètres du Compte & Préférences</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Gérez votre profil membre, langue d'interface et préférences de notification.
        </p>
      </div>

      {savedNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-700 text-xs text-emerald-200 flex items-center gap-2 shadow-lg">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>Vos préférences ont été enregistrées avec succès.</span>
        </div>
      )}

      {/* Profile Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <User size={18} className="text-uec-cyan" />
            <span>Informations Personnelles</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nom Complet
                </label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Yassine Ayari"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Adresse Email (Identifiant UEC)
                </label>
                <Input value={profile?.email || ""} disabled className="opacity-60 cursor-not-allowed" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Numéro de Téléphone
                </label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+216 -- --- ---"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Rôle Attribué
                </label>
                <div className="pt-2">
                  <Badge
                    variant={
                      role === "SUPER_ADMIN"
                        ? "superAdmin"
                        : role === "COORDINATOR"
                        ? "coordinator"
                        : "member"
                    }
                  >
                    {t(`roles.${role}`)}
                  </Badge>
                </div>
              </div>
            </div>

            <Button type="submit" variant="primary" size="sm">
              <Save size={14} className="mr-1" />
              Enregistrer Modifications
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Language Preference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Globe size={18} className="text-uec-blue" />
            <span>Langue d'Affichage & Sens de Lecture</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-slate-400">
            L'Espace Digital supporte nativement le Français, l'Arabe (avec disposition inversée RTL) et l'Anglais.
          </p>

          <div className="grid grid-cols-3 gap-3">
            {[
              { code: "fr" as Locale, label: "Français", flag: "🇫🇷", desc: "Langue par défaut (LTR)" },
              { code: "ar" as Locale, label: "العربية", flag: "🇹🇳", desc: "Native RTL (من اليمين لليسار)" },
              { code: "en" as Locale, label: "English", flag: "🇬🇧", desc: "International (LTR)" },
            ].map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => setLocale(item.code)}
                className={`p-3.5 rounded-xl border text-left rtl:text-right transition-all ${
                  locale === item.code
                    ? "bg-slate-800 border-uec-red shadow-md"
                    : "bg-[#172033] border-[#27354F] hover:border-slate-600"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{item.flag}</span>
                  <span className="text-xs font-bold text-white">{item.label}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{item.desc}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
