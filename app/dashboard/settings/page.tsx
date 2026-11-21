"use client";

import React, { useState, useTransition } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useTranslation, type Locale } from "@/lib/i18n/context";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, User, Globe, Bell, Shield, Save, CheckCircle2, AlertCircle } from "lucide-react";
import { updateProfileSettingsAction, updateUserPreferencesAction } from "@/app/actions/settings";

export default function SettingsPage() {
  const { profile, role, refreshProfile } = useAuth();
  const { locale, setLocale, t, dir } = useTranslation();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateProfileSettingsAction({
        full_name: fullName,
        phone: phone || null,
        bio: bio || null,
      });

      if (res.success) {
        setActionMessage({ text: res.message });
        if (refreshProfile) refreshProfile();
      } else {
        setActionMessage({ text: res.message, error: true });
      }
      setTimeout(() => setActionMessage(null), 4000);
    });
  };

  const handleLanguageChange = (newLocale: Locale) => {
    setLocale(newLocale);
    startTransition(async () => {
      await updateUserPreferencesAction({
        language: newLocale,
        theme: "dark",
        email_notifications: emailNotifs,
        push_notifications: pushNotifs,
      });
      setActionMessage({ text: "Langue mise à jour et mémorisée" });
      setTimeout(() => setActionMessage(null), 3000);
    });
  };

  const handleNotifToggle = (type: "email" | "push", checked: boolean) => {
    if (type === "email") setEmailNotifs(checked);
    if (type === "push") setPushNotifs(checked);

    startTransition(async () => {
      await updateUserPreferencesAction({
        language: locale,
        theme: "dark",
        email_notifications: type === "email" ? checked : emailNotifs,
        push_notifications: type === "push" ? checked : pushNotifs,
      });
      setActionMessage({ text: "Préférences de notification enregistrées" });
      setTimeout(() => setActionMessage(null), 3000);
    });
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

      {actionMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 shadow-lg transition-all ${
            actionMessage.error
              ? "bg-rose-950/70 border-rose-700 text-rose-200"
              : "bg-emerald-950/70 border-emerald-700 text-emerald-200"
          }`}
        >
          {actionMessage.error ? (
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          )}
          <span>{actionMessage.text}</span>
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
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nom Complet *
                </label>
                <Input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Yassine Ayari"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Adresse Email (Identifiant UEC)
                </label>
                <Input
                  value={profile?.email || ""}
                  disabled
                  className="opacity-60 cursor-not-allowed"
                />
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
                    size="sm"
                  >
                    {role ? t(`roles.${role}`) : "Membre"}
                  </Badge>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Bio / Présentation au sein de l'UEC
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Rédigez quelques lignes sur votre parcours, spécialités graphiques ou missions..."
                className="w-full bg-[#0B1020] text-xs text-white placeholder-slate-500 rounded-lg p-3 border border-[#1F2937] focus:border-uec-blue focus:outline-none resize-none leading-relaxed"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" variant="primary" size="sm" disabled={isPending} className="bg-uec-red hover:bg-uec-red/90 text-white">
                <Save size={14} className="mr-1.5" />
                <span>{isPending ? "Enregistrement..." : "Enregistrer les modifications"}</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Language Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Globe size={18} className="text-uec-red" />
            <span>Langue & Paramètres Régionaux</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-slate-400">
            Choisissez la langue principale de l'interface. L'arabe activera la mise en page RTL (de droite à gauche).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { code: "fr", label: "Français", flag: "🇫🇷", desc: "Langue par défaut (LTR)" },
              { code: "ar", label: "العربية", flag: "🇹🇳", desc: "Arabe Clubiste (RTL)" },
              { code: "en", label: "English", flag: "🇬🇧", desc: "International (LTR)" },
            ].map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code as Locale)}
                className={`p-3.5 rounded-xl border text-left rtl:text-right transition-all flex flex-col justify-between ${
                  locale === lang.code
                    ? "bg-uec-red/10 border-uec-red text-white shadow-md shadow-red-950/20"
                    : "bg-[#0B1020] border-[#1F2937] text-slate-400 hover:text-white hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xl">{lang.flag}</span>
                  {locale === lang.code && (
                    <span className="text-[10px] font-bold text-uec-red bg-uec-red/20 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">{lang.label}</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">{lang.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Bell size={18} className="text-amber-400" />
            <span>Préférences de Notification</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center justify-between p-3 rounded-lg bg-[#0B1020] border border-[#1F2937] cursor-pointer">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-white block">Notifications par Email</span>
              <span className="text-[11px] text-slate-400 block">
                Recevoir les alertes d'assignation de tâche, de validation de livrable et de convocations.
              </span>
            </div>
            <input
              type="checkbox"
              checked={emailNotifs}
              onChange={(e) => handleNotifToggle("email", e.target.checked)}
              className="rounded border-[#1F2937] text-uec-red focus:ring-uec-red h-4 w-4"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg bg-[#0B1020] border border-[#1F2937] cursor-pointer">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-white block">Notifications In-App</span>
              <span className="text-[11px] text-slate-400 block">
                Activer la cloche de notification et le flux d'événements en direct.
              </span>
            </div>
            <input
              type="checkbox"
              checked={pushNotifs}
              onChange={(e) => handleNotifToggle("push", e.target.checked)}
              className="rounded border-[#1F2937] text-uec-red focus:ring-uec-red h-4 w-4"
            />
          </label>
        </CardContent>
      </Card>
    </div>
  );
}
