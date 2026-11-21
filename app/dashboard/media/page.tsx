"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FolderArchive, UploadCloud, Search, FileImage, FileVideo, HardDrive, Shield } from "lucide-react";

interface MediaItem {
  id: string;
  name: string;
  department: string;
  size: string;
  mimeType: string;
  uploadedAt: string;
  previewUrl?: string;
}

const MEDIA_FILES: MediaItem[] = [
  {
    id: "m-01",
    name: "uec-shield.webp",
    department: "Créatif & Design",
    size: "24 KB",
    mimeType: "image/webp",
    uploadedAt: "20 Nov 2026",
    previewUrl: "/assets/uec-shield.webp",
  },
  {
    id: "m-02",
    name: "uec-emblem.webp",
    department: "Créatif & Design",
    size: "133 KB",
    mimeType: "image/webp",
    uploadedAt: "20 Nov 2026",
    previewUrl: "/assets/uec-emblem.webp",
  },
  {
    id: "m-03",
    name: "uec-mascot.webp",
    department: "Créatif & Design",
    size: "172 KB",
    mimeType: "image/webp",
    uploadedAt: "20 Nov 2026",
    previewUrl: "/assets/uec-mascot.webp",
  },
  {
    id: "m-04",
    name: "card-tribune.webp",
    department: "Audiovisuel",
    size: "69 KB",
    mimeType: "image/webp",
    uploadedAt: "20 Nov 2026",
    previewUrl: "/assets/card-tribune.webp",
  },
];

export default function MediaPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = MEDIA_FILES.filter((f) =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FolderArchive size={24} className="text-uec-red" />
            <span>Médiathèque & Assets Officiels</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Stockage cloud privé (<code className="text-uec-cyan">espace-digital-media</code>) sécurisé par RLS (max 50 MB / fichier).
          </p>
        </div>

        <Button variant="primary" size="sm">
          <UploadCloud size={15} className="mr-1.5" />
          Téléverser un Fichier
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher par nom d'asset..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((item) => (
          <Card key={item.id} className="group hover:border-slate-700 transition-all overflow-hidden">
            <div className="relative h-36 bg-[#0E1526] flex items-center justify-center border-b border-[#1F2937] p-2">
              {item.previewUrl ? (
                <Image
                  src={item.previewUrl}
                  alt={item.name}
                  fill
                  className="object-contain p-3 group-hover:scale-105 transition-transform"
                />
              ) : (
                <FileImage size={36} className="text-slate-500" />
              )}
            </div>

            <CardContent className="p-3.5 space-y-1.5">
              <p className="text-xs font-bold text-white truncate" title={item.name}>
                {item.name}
              </p>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>{item.size}</span>
                <span className="text-uec-cyan">{item.department}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
