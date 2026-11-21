"use client";

import React, { useState, useTransition } from "react";
import Image from "next/image";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
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
  Edit2,
  Trash2,
} from "lucide-react";
import type { MediaFileItem, MediaCategory } from "@/lib/data/media";
import type { DepartmentWithStats } from "@/lib/data/departments";
import { createClient } from "@/lib/supabase/client";
import {
  recordMediaFileAction,
  deleteMediaFileAction,
} from "@/app/actions/media";
import { MediaEditModal } from "./media-edit-modal";

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
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"grid" | "list">("grid");

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<MediaFileItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<MediaFileItem | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState<MediaCategory>("BRANDING");
  const [uploadDeptId, setUploadDeptId] = useState("");

  const canUpload = Boolean(userRole);
  const canManage = userRole === "SUPER_ADMIN" || userRole === "COORDINATOR";

  const filteredFiles = files.filter((f) => {
    if (categoryFilter !== "ALL" && f.category !== categoryFilter) return false;
    if (deptFilter !== "ALL" && f.department_id !== deptFilter) return false;
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

  const handleDeleteFile = (fileId: string, title: string) => {
    if (!confirm(`Supprimer définitivement le fichier "${title}" de la médiathèque ?`)) return;

    startTransition(async () => {
      const res = await deleteMediaFileAction(fileId);
      if (res.success) {
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
        setActionMessage({ text: "Fichier supprimé avec succès." });
      } else {
        setActionMessage({ text: res.message, error: true });
      }
      setTimeout(() => setActionMessage(null), 3000);
    });
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
          url: urlData.publicUrl,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setFiles([newMedia, ...files]);
        setUploadFile(null);
        setUploadTitle("");
      } else {
        setActionMessage({ text: res.message, error: true });
      }
    } catch (err: any) {
      setActionMessage({ text: err.message || "Erreur de téléversement", error: true });
    } finally {
      setIsUploading(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FolderArchive size={24} className="text-uec-red" />
            <span>Médiathèque & Assets Graphiques</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Banque centralisée des chartes graphiques, photographies, teasers et fichiers officiels ({files.length} fichiers répertoriés).
          </p>
        </div>

        {canUpload && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsUploadOpen(true)}
            className="bg-uec-red hover:bg-uec-red/90 text-white"
          >
            <UploadCloud size={16} className="mr-1.5" />
            Importer un Asset
          </Button>
        )}
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
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 rtl:left-auto rtl:right-3" />
              <input
                type="text"
                placeholder="Rechercher par titre ou nom de fichier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#111827] text-xs text-white placeholder-slate-500 rounded-lg pl-9 pr-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none rtl:pl-3 rtl:pr-9"
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
              <option value="AUTRE">Divers</option>
            </select>

            {/* Department Filter */}
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="bg-[#111827] text-xs text-white rounded-lg px-3 py-2 border border-[#1F2937] focus:border-uec-blue focus:outline-none"
            >
              <option value="ALL">Tous les Pôles</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
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
        <EmptyState
          icon={FolderArchive}
          title="Aucun fichier trouvé"
          description="Aucun asset ne correspond à vos critères de recherche dans la médiathèque UEC."
          action={
            canUpload
              ? {
                  label: "Importer une Ressource",
                  onClick: () => setIsUploadOpen(true),
                  icon: UploadCloud,
                  variant: "outline",
                }
              : undefined
          }
        />
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
                    <span className="text-uec-cyan font-medium truncate max-w-[100px]">
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
                      {canManage && (
                        <>
                          <button
                            onClick={() => {
                              setEditingFile(file);
                              setIsEditOpen(true);
                            }}
                            className="p-1 hover:text-white transition-colors"
                            title="Modifier les métadonnées"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteFile(file.id, file.title)}
                            disabled={isPending}
                            className="p-1 hover:text-rose-400 transition-colors"
                            title="Supprimer le fichier"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
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
                    <p className="font-semibold text-white truncate">{file.title}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <span>{file.file_name}</span>
                      <span>•</span>
                      <span>{file.file_size_formatted}</span>
                      <span>•</span>
                      <span className="text-uec-cyan">{CATEGORY_LABELS[file.category]}</span>
                      {file.department_name && (
                        <>
                          <span>•</span>
                          <span className="text-slate-300">{file.department_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleCopyLink(file.url)}
                    className="p-1.5 rounded-lg border border-[#1F2937] bg-[#111827] text-slate-400 hover:text-white"
                    title="Copier le lien"
                  >
                    <Copy size={13} />
                  </button>
                  <a
                    href={file.url}
                    download={file.file_name}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg border border-[#1F2937] bg-[#111827] text-slate-400 hover:text-white"
                    title="Télécharger"
                  >
                    <Download size={13} />
                  </a>
                  {canManage && (
                    <>
                      <button
                        onClick={() => {
                          setEditingFile(file);
                          setIsEditOpen(true);
                        }}
                        className="p-1.5 rounded-lg border border-[#1F2937] bg-[#111827] text-slate-400 hover:text-white"
                        title="Modifier"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteFile(file.id, file.title)}
                        disabled={isPending}
                        className="p-1.5 rounded-lg border border-[#1F2937] bg-[#111827] text-slate-400 hover:text-rose-400"
                        title="Supprimer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#0e0e12] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl shadow-black/90 p-6 relative">
            <button
              onClick={() => setIsUploadOpen(false)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-uec-blue"
              aria-label="Fermer"
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
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isUploading || !uploadFile}
                  className="bg-uec-red hover:bg-uec-red/90 text-white"
                >
                  {isUploading ? "Téléversement..." : "Confirmer l'Import"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Media Modal */}
      <MediaEditModal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditingFile(null);
        }}
        file={editingFile}
        departments={departments}
        onSuccess={(updated) => {
          setFiles((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
          setActionMessage({ text: "Fichier mis à jour avec succès." });
          setTimeout(() => setActionMessage(null), 3000);
        }}
      />

      {/* Preview Modal */}
      {previewItem && (
        <div
          onClick={() => setPreviewItem(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0e0e12] border border-white/10 rounded-2xl max-w-3xl w-full p-4 overflow-hidden relative shadow-2xl"
          >
            <button
              onClick={() => setPreviewItem(null)}
              className="absolute top-3 right-3 rtl:right-auto rtl:left-3 p-1 rounded-lg text-slate-400 hover:text-white bg-slate-900/60 z-10"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>

            <h3 className="text-sm font-bold text-white mb-3 pr-8 rtl:pr-0 rtl:pl-8 truncate">{previewItem.title}</h3>

            <div className="w-full h-[60vh] bg-black/60 rounded-xl relative flex items-center justify-center overflow-hidden border border-white/5">
              {previewItem.mime_type.startsWith("image/") ? (
                <Image
                  src={previewItem.url}
                  alt={previewItem.title}
                  fill
                  className="object-contain"
                  unoptimized
                />
              ) : previewItem.mime_type.startsWith("video/") ? (
                <video src={previewItem.url} controls className="max-h-full max-w-full rounded" />
              ) : (
                <div className="text-center p-6 space-y-3">
                  <FileText size={48} className="mx-auto text-uec-red" />
                  <p className="text-xs text-slate-300">Aperçu non disponible pour ce format de document.</p>
                  <a
                    href={previewItem.url}
                    download={previewItem.file_name}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-uec-red text-white text-xs font-semibold"
                  >
                    <Download size={14} />
                    <span>Télécharger le document</span>
                  </a>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-3">
              <span>{previewItem.file_name} • {previewItem.file_size_formatted}</span>
              <a
                href={previewItem.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-uec-cyan hover:underline"
              >
                <span>Ouvrir URL source</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
