"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      setIsSent(true);
      setIsLoading(false);
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur lors de l'envoi de la demande.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1020] flex flex-col justify-center items-center p-4 relative">
      <div className="w-full max-w-md z-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="relative h-14 w-14 mx-auto rounded-xl p-2 bg-[#111827] border border-[#27354F]">
            <Image
              src="/assets/uec-shield.webp"
              alt="UEC Shield"
              fill
              className="object-contain p-2"
            />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Récupération de Compte
          </h1>
          <p className="text-xs text-slate-400">
            Entrez votre adresse email UEC pour recevoir un lien de réinitialisation.
          </p>
        </div>

        <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/80 space-y-6">
          {isSent ? (
            <div className="text-center space-y-4 py-4">
              <CheckCircle2 size={48} className="text-emerald-400 mx-auto" />
              <div>
                <h3 className="text-base font-bold text-white">
                  {t("auth.resetSentTitle")}
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  {t("auth.resetSentDesc")}
                </p>
              </div>
              <Link href="/login" className="inline-block mt-4">
                <Button variant="secondary" size="sm">
                  <ArrowLeft size={14} className="mr-1 rtl:rotate-180" />
                  {t("auth.backToLogin")}
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-300">
                  {errorMessage}
                </div>
              )}

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

              <Button
                type="submit"
                className="w-full mt-2"
                isLoading={isLoading}
                variant="primary"
              >
                {t("auth.sendResetLink")}
              </Button>

              <div className="text-center pt-2">
                <Link
                  href="/login"
                  className="text-xs text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1"
                >
                  <ArrowLeft size={14} className="rtl:rotate-180" />
                  <span>{t("auth.backToLogin")}</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
