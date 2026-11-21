"use client";

import React, { useState, useTransition } from "react";
import Image from "next/image";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import {
  FolderArchive,
  UploadCloud,
  Search,
  FileImage,
  FileVideo,
  FileText,
  HardDrive,
  Download,
  Copy,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  X,
  Sparkles,
  Layers,
} from "lucide-react";
import type { MediaFileItem, MediaCategory } from "@/lib/data/media";
import type { DepartmentWithStats } from "@/lib/data/departments";
import { createClient } from "@/lib/supabase/client";
import { recordMediaFileAction } from "@/app/actions/media";

interface MediaViewProps {
  initialFiles: MediaFileItem[];
  departments: DepartmentWithStats[];
  userRole: string;
}

const CATEGORY_LABELS: Record<MediaCategory, string> = {
  BRANDING: "Identité & Branding",
  PHOTO: "Photos & Couvertures",
  VIDEO: "Vidéos & Teasers",
  DOCUMENT: "Documents & Chartes",
  DESIGN_ASSET: "Ressources Graphiques",
  AUDIO: "Sons & Chants",
  AUTRE: "Divers",
};

export function MediaView({ initialFiles, departments, userRole }: MediaViewProps) {
  const [files, setFiles] = useState<MediaFileItem[]>(initialFiles);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"grid" | "list">("grid");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<MediaFileItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState<MediaCategory>("BRANDING");
  const [uploadDeptId, setUploadDeptId] = useState("");

  const filteredFiles = files.filter((f) => {
    if (categoryFilter !== "ALL" && f.category !== categoryFilter) return false;
    if (
      search.trim() &&
      !f.title.toLowerCase().includes(search.toLowerCase()) &&
      !f.file_name.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const totalBytes = files.reduce((acc, f) => acc + (f.file_size || 0), 0);
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);

  const stats = {
    total: files.length,
    branding: files.filter((f) => f.category === "BRANDING" || f.category === "DESIGN_ASSET").length,
    photosVideos: files.filter((f) => f.category === "PHOTO" || f.category === "VIDEO").length,
    storageMB: `${totalMB} Mo`,
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(window.location.origin + url);
    setActionMessage({ text: "Lien de téléchargement copié dans le presse-papier" });
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setIsUploading(true);
    try {
      const supabase = createClient();
      const fileExt = uploadFile.name.split(".").pop();
      const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `uploads/${uniqueFileName}`;

      // Upload file directly to Supabase storage bucket
      const { error: uploadError } = await supabase.storage
        .from("espace-digital-media")
        .upload(filePath, uploadFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // Record metadata in database
      const res = await recordMediaFileAction({
        title: uploadTitle || uploadFile.name,
        file_name: uploadFile.name,
        file_path: filePath,
        bucket_name: "espace-digital-media",
        file_size: uploadFile.size,
        mime_type: uploadFile.type || "application/octet-stream",
        category: uploadCategory,
        department_id: uploadDeptId || null,
        is_public_within_team: true,
        metadata: {},
      });

      if (res.success) {
        setActionMessage({ text: res.message });
        setIsUploadOpen(false);
        const { data: urlData } = supabase.storage
          .from("espace-digital-media")
          .getPublicUrl(filePath);

        const newMedia: MediaFileItem = {
          id: res.data.id,
          title: uploadTitle || uploadFile.name,
          file_name: uploadFile.name,
          file_path: filePath,
          bucket_name: "espace-digital-media",
          file_size: uploadFile.size,
          file_size_formatted: `${(uploadFile.size / 1024).toFixed(0)} Ko`,
          mime_type: uploadFile.type,
          category: uploadCategory,
          department_id: uploadDeptId || null,
          department_name: departments.find((d) => d.id === uploadDeptId)?.name || null,
          project_id: null,
          uploaded_by: "",
          uploader_name: "Moi",
          is_public_within_team: true,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          url: urlData.publicUrl,
        };
        setFiles([newMedia, ...files]);
        setUploadFile(null);
        setUploadTitle("");
      } else {
        setActionMessage({ text: res.message, error: true });
      }
    } catch (err: any) {
      setActionMessage({ text: `Erreur d'envoi: ${err.message}`, error: true });
    } finally {
      setIsUploading(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FolderArchive size={24} className="text-uec-red" />
            <span>Médiathèque & Ressources Officielles</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Banque centralisée des chartes graphiques, logos HD, typographies et livrables validés.
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => setIsUploadOpen(true)}>
          <UploadCloud size={15} className="mr-1.5" />
          Importer un Fichier
        </Button>
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

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Fichiers Indexés"
          value={stats.total.toString()}
          description="Assets disponibles"
          icon={<FolderArchive size={18} />}
          accentColor="blue"
        />
        <StatCard
          title="Branding & Design"
          value={stats.branding.toString()}
          description="Logos, chartes, mascottes"
          icon={<FileImage size={18} />}
          accentColor="cyan"
        />
        <StatCard
          title="Photos & Vidéos"
          value={stats.photosVideos.toString()}
          description="Médias de reportage"
          icon={<FileVideo size={18} />}
          accentColor="gold"
        />
        <StatCard
          title="Volume Stockage"
          value={stats.storageMB}
          description="Stocké sur Supabase R2"
          icon={<HardDrive size={18} />}
          accentColor="green"
        />
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par titre ou nom de fichier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#111827] text-xs text-white placeholder-slate-500 rounded-lg pl-9 pr-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-[#111827] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
            >
              <option value="ALL">Toutes catégories</option>
              <option value="BRANDING">Identité & Branding</option>
              <option value="PHOTO">Photos & Couvertures</option>
              <option value="VIDEO">Vidéos & Teasers</option>
              <option value="DOCUMENT">Documents & Chartes</option>
              <option value="DESIGN_ASSET">Ressources Graphiques</option>
              <option value="AUDIO">Sons & Chants</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 self-end md:self-auto">
            <button
              onClick={() => setActiveTab("grid")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === "grid"
                  ? "bg-uec-red text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              Grille
            </button>
            <button
              onClick={() => setActiveTab("list")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === "list"
                  ? "bg-uec-red text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              Liste
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Grid or List of Media */}
      {filteredFiles.length === 0 ? (
        <Card className="text-center py-12">
          <FolderArchive size={40} className="mx-auto text-slate-600 mb-3" />
          <h3 className="text-sm font-semibold text-white">Aucun fichier trouvé</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Aucun asset ne correspond à vos critères de recherche.
          </p>
        </Card>
      ) : activeTab === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredFiles.map((file) => {
            const isImage = file.mime_type.startsWith("image/");
            return (
              <Card key={file.id} className="overflow-hidden group flex flex-col justify-between">
                {/* Thumbnail Preview Area */}
                <div
                  onClick={() => setPreviewItem(file)}
                  className="h-36 bg-[#0B1020] relative flex items-center justify-center p-3 cursor-pointer overflow-hidden border-b border-[#1F2937]"
                >
                  {isImage ? (
                    <Image
                      src={file.url}
                      alt={file.title}
                      fill
                      className="object-contain p-2 group-hover:scale-105 transition-transform"
                      unoptimized
                    />
                  ) : file.mime_type.startsWith("video/") ? (
                    <FileVideo size={40} className="text-cyan-400" />
                  ) : (
                    <FileText size={40} className="text-uec-red" />
                  )}

                  <span className="absolute top-2 right-2 text-[9px] font-mono font-bold bg-slate-900/80 backdrop-blur-sm border border-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                    {file.file_size_formatted}
                  </span>
                </div>

                {/* Details */}
                <CardContent className="p-3 space-y-2">
                  <div>
                    <h4 className="text-xs font-semibold text-white truncate" title={file.title}>
                      {file.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 truncate">{file.file_name}</p>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-[#1F2937]">
                    <span className="text-uec-cyan font-medium">
                      {CATEGORY_LABELS[file.category]}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopyLink(file.url)}
                        className="p-1 hover:text-white transition-colors"
                        title="Copier le lien"
                      >
                        <Copy size={13} />
                      </button>
                      <a
                        href={file.url}
                        download={file.file_name}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 hover:text-white transition-colors"
                        title="Télécharger"
                      >
                        <Download size={13} />
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="divide-y divide-[#1F2937]">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className="p-3.5 hover:bg-slate-800/30 transition-colors flex items-center justify-between gap-4 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-[#0B1020] border border-[#1F2937] flex items-center justify-center shrink-0">
                    {file.mime_type.startsWith("image/") ? (
                      <FileImage size={20} className="text-uec-cyan" />
                    ) : file.mime_type.startsWith("video/") ? (
                      <FileVideo size={20} className="text-blue-400" />
                    ) : (
                      <FileText size={20} className="text-uec-red" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <h4 className="font-semibold text-white truncate">{file.title}</h4>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      <span>{file.file_name}</span>
                      <span>•</span>
                      <span className="font-mono">{file.file_size_formatted}</span>
                      <span>•</span>
                      <span className="text-slate-300">{CATEGORY_LABELS[file.category]}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyLink(file.url)}
                  >
                    <Copy size={13} className="mr-1" />
                    Lien
                  </Button>
                  <a
                    href={file.url}
                    download={file.file_name}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                  >
                    <Download size={13} className="mr-1" />
                    Télécharger
                  </a>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#27354F] rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
            <button
              onClick={() => setIsUploadOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>

            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <UploadCloud size={18} className="text-uec-red" />
              <span>Importer une Ressource dans la Médiathèque</span>
            </h2>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Sélectionner un fichier * (max 50 Mo)
                </label>
                <input
                  type="file"
                  required
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setUploadFile(f);
                      if (!uploadTitle) setUploadTitle(f.name.replace(/\.[^/.]+$/, ""));
                    }
                  }}
                  className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-uec-red file:text-white hover:file:bg-red-700 cursor-pointer bg-[#0B1020] p-2 rounded-lg border border-[#1F2937]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Titre descriptif de la ressource *
                </label>
                <Input
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Ex: Affiche Officielle Derby UEC 2026 HD"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Catégorie *
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value as MediaCategory)}
                    className="w-full bg-[#0B1020] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
                  >
                    <option value="BRANDING">Identité & Branding</option>
                    <option value="PHOTO">Photos & Couvertures</option>
                    <option value="VIDEO">Vidéos & Teasers</option>
                    <option value="DOCUMENT">Documents & Chartes</option>
                    <option value="DESIGN_ASSET">Ressources Graphiques</option>
                    <option value="AUDIO">Sons & Chants</option>
                    <option value="AUTRE">Autre</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Pôle Propriétaire
                  </label>
                  <select
                    value={uploadDeptId}
                    onChange={(e) => setUploadDeptId(e.target.value)}
                    className="w-full bg-[#0B1020] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
                  >
                    <option value="">Tous les Pôles (Partagé)</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsUploadOpen(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isUploading}>
                  {isUploading ? "Transfert en cours..." : "Téléverser sur Supabase"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#27354F] rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden relative">
            <button
              onClick={() => setPreviewItem(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-slate-900/80 rounded-full text-white hover:bg-slate-800"
            >
              <X size={20} />
            </button>

            <div className="h-96 relative bg-[#0B1020] flex items-center justify-center p-6">
              {previewItem.mime_type.startsWith("image/") ? (
                <Image
                  src={previewItem.url}
                  alt={previewItem.title}
                  fill
                  className="object-contain p-4"
                  unoptimized
                />
              ) : previewItem.mime_type.startsWith("video/") ? (
                <video src={previewItem.url} controls className="max-h-full max-w-full" />
              ) : (
                <FileText size={80} className="text-uec-red" />
              )}
            </div>

            <div className="p-4 border-t border-[#1F2937] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">{previewItem.title}</h3>
                <p className="text-xs text-slate-400">
                  {previewItem.file_name} • {previewItem.file_size_formatted}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyLink(previewItem.url)}
                >
                  <Copy size={14} className="mr-1.5" />
                  Copier le lien
                </Button>
                <a
                  href={previewItem.url}
                  download={previewItem.file_name}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-uec-red text-white hover:bg-red-700 transition-colors"
                >
                  <Download size={14} className="mr-1.5" />
                  Télécharger
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
