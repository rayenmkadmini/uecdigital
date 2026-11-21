"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, ShieldAlert } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0B1020] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-uec-red/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md z-10 text-center space-y-6">
        <div className="relative h-20 w-20 mx-auto rounded-2xl p-2.5 bg-[#111827] border border-[#27354F] shadow-2xl shadow-uec-red/20">
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
            <ShieldAlert size={14} />
            <span>Erreur 404 — Page Introuvable</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Destination Inexistante
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            La ressource demandée n'existe pas ou a été déplacée au sein de la plateforme UEC Espace Digital.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button variant="primary" className="w-full bg-uec-red hover:bg-uec-red/90 text-white">
              <Home size={15} className="mr-1.5" />
              <span>Tableau de bord</span>
            </Button>
          </Link>
          <Link href="/login" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full text-slate-300 border-slate-700 hover:bg-white/5">
              <ArrowLeft size={15} className="mr-1.5 rtl:rotate-180" />
              <span>Page de Connexion</span>
            </Button>
          </Link>
        </div>

        <p className="text-[11px] text-slate-500 pt-6">
          © 2021 — 2026 Union des Étudiants Clubistes • Pôle Digital
        </p>
      </div>
    </div>
  );
}
