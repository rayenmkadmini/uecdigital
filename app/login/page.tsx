"use client";

import React, { useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Lock, Eye, EyeOff, ShieldAlert, ArrowRight, ExternalLink } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/dashboard";
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(
          error.message === "Invalid login credentials"
            ? "Identifiants invalides. Vérifiez votre adresse email et votre mot de passe."
            : error.message
        );
        setIsLoading(false);
        return;
      }

      // Hard redirect to ensure server-side middleware and cookies sync
      window.location.href = redirectPath;
    } catch (err: any) {
      setErrorMessage(err.message || "Une erreur inattendue est survenue.");
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/80 space-y-6">
      {errorMessage && (
        <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-300 flex items-start gap-2.5">
          <ShieldAlert size={16} className="shrink-0 text-red-400 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            {t("auth.emailLabel")}
          </label>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("auth.emailPlaceholder")}
            icon={<Mail size={16} />}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300">
              {t("auth.passwordLabel")}
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-uec-cyan hover:underline font-medium"
            >
              {t("auth.forgotPassword")}
            </Link>
          </div>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.passwordPlaceholder")}
              icon={<Lock size={16} />}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full mt-2"
          isLoading={isLoading}
          variant="primary"
        >
          <span>{isLoading ? t("auth.signingIn") : t("auth.signInButton")}</span>
          {!isLoading && <ArrowRight size={16} className="ml-1 rtl:rotate-180" />}
        </Button>
      </form>

      {/* Isolated Static UI Preview Link (Sandboxed, No Auth Bypass) */}
      <div className="pt-4 border-t border-[#1F2937] text-center">
        <Link
          href="/preview"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-uec-cyan transition-colors"
        >
          <span>Consulter le bac à sable de prévisualisation UI</span>
          <ExternalLink size={12} />
        </Link>
        <p className="text-[10px] text-slate-400 mt-0.5">
          Environnement isolé sans persistance ni accès base de données
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { t, locale, setLocale } = useTranslation();

  return (
    <div className="min-h-screen bg-[#0B1020] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-uec-red/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-uec-blue/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Language Switcher in Top Right */}
      <div className="absolute top-6 right-6 flex items-center gap-2 z-20">
        {(["fr", "ar", "en"] as const).map((lang) => (
          <button
            key={lang}
            onClick={() => setLocale(lang)}
            className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-all ${
              locale === lang
                ? "bg-uec-red text-white"
                : "text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800"
            }`}
          >
            {lang.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="w-full max-w-md z-10 space-y-6">
        {/* Brand Banner */}
        <div className="text-center space-y-3">
          <div className="relative h-16 w-16 mx-auto rounded-2xl p-2 bg-[#111827] border border-[#27354F] shadow-2xl shadow-uec-red/20">
            <Image
              src="/assets/uec-shield.webp"
              alt="UEC Shield"
              fill
              className="object-contain p-2"
              priority
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {t("brand.name")}
            </h1>
            <p className="text-xs text-uec-red font-semibold uppercase tracking-wider mt-0.5">
              {t("brand.tagline")}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {t("auth.loginSubtitle")}
            </p>
          </div>
        </div>

        {/* Login Card with Suspense */}
        <Suspense
          fallback={
            <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-8 text-center text-slate-400 text-xs">
              Chargement de la connexion...
            </div>
          }
        >
          <LoginForm />
        </Suspense>

        {/* Footer info */}
        <div className="text-center space-y-1 text-xs text-slate-400">
          <p>© 2021 — 2026 Union des Étudiants Clubistes (UEC)</p>
          <p className="text-[11px] text-slate-400">Plateforme Pôle Digital v1.0.0 Enterprise</p>
        </div>
      </div>
    </div>
  );
}
