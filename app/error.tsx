"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RotateCcw, Home, AlertOctagon } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected errors securely without leaking sensitive tokens
    console.error("UEC Platform Runtime Error:", error?.message || error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0B1020] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-rose-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md z-10 text-center space-y-6">
        <div className="relative h-20 w-20 mx-auto rounded-2xl p-2.5 bg-[#111827] border border-[#27354F] shadow-2xl shadow-rose-900/30">
          <Image
            src="/assets/uec-shield.webp"
            alt="UEC Shield"
            fill
            className="object-contain p-2"
            priority
          />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-semibold">
            <AlertOctagon size={14} />
            <span>Incident Technique Détecté</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Une erreur inattendue est survenue
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            L'application a intercepté une anomalie d'exécution. Vos données et permissions restent parfaitement sécurisées.
          </p>
        </div>

        {error?.digest && (
          <div className="p-2.5 rounded-lg bg-[#0B1020]/90 border border-slate-800 text-[11px] font-mono text-slate-400">
            Identifiant d'incident : <span className="text-slate-200">{error.digest}</span>
          </div>
        )}

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="primary"
            onClick={() => reset()}
            className="w-full sm:w-auto bg-uec-red hover:bg-uec-red/90 text-white"
          >
            <RotateCcw size={15} className="mr-1.5" />
            <span>Réessayer</span>
          </Button>
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full text-slate-300 border-slate-700 hover:bg-white/5">
              <Home size={15} className="mr-1.5" />
              <span>Tableau de bord</span>
            </Button>
          </Link>
        </div>

        <p className="text-[11px] text-slate-500 pt-6">
          © 2021 — 2026 Union des Étudiants Clubistes • Support Technique
        </p>
      </div>
    </div>
  );
}
