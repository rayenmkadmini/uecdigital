"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabase = createClient();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMessage("Les mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 8) {
      setErrorMessage("Le mot de passe doit comporter au moins 8 caractères.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur lors de la mise à jour.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1020] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-6">
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
            Nouveau Mot de Passe
          </h1>
          <p className="text-xs text-slate-400">
            Définissez votre nouveau mot de passe sécurisé pour l'Espace Digital UEC.
          </p>
        </div>

        <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          {isSuccess ? (
            <div className="text-center space-y-3 py-4">
              <CheckCircle2 size={48} className="text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-white">Mot de passe mis à jour !</h3>
              <p className="text-xs text-slate-300">
                Redirection automatique vers votre tableau de bord...
              </p>
            </div>
          ) : (
            <form onSubmit={handleUpdate} className="space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-300">
                  {errorMessage}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nouveau mot de passe
                </label>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 caractères"
                  icon={<Lock size={16} />}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Confirmer le mot de passe
                </label>
                <Input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Répétez le mot de passe"
                  icon={<Lock size={16} />}
                />
              </div>

              <Button
                type="submit"
                className="w-full mt-2"
                isLoading={isLoading}
                variant="primary"
              >
                Valider et Accéder à la Plateforme
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
