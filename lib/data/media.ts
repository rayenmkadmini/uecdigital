import { createClient } from "@/lib/supabase/server";

export type MediaCategory =
  | "BRANDING"
  | "PHOTO"
  | "VIDEO"
  | "DOCUMENT"
  | "DESIGN_ASSET"
  | "AUDIO"
  | "AUTRE";

export interface MediaFileItem {
  id: string;
  title: string;
  file_name: string;
  file_path: string;
  bucket_name: string;
  file_size: number;
  file_size_formatted: string;
  mime_type: string;
  category: MediaCategory;
  department_id: string | null;
  department_name: string | null;
  project_id: string | null;
  uploaded_by: string;
  uploader_name: string;
  is_public_within_team: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  url: string;
}

export interface MediaFilter {
  category?: string;
  departmentId?: string;
  mimeType?: string;
  search?: string;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 Octet";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Octets", "Ko", "Mo", "Go", "To"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// Default core UEC brand kit assets shipped with the digital space
const OFFICIAL_BRAND_ASSETS: MediaFileItem[] = [
  {
    id: "brand-logo-png",
    title: "Logo Officiel UEC HD",
    file_name: "logo.png",
    file_path: "/assets/logo.png",
    bucket_name: "local-assets",
    file_size: 2315344,
    file_size_formatted: "2.2 Mo",
    mime_type: "image/png",
    category: "BRANDING",
    department_id: null,
    department_name: "Pôle Créatif & Design",
    project_id: null,
    uploaded_by: "system",
    uploader_name: "Direction Artistique UEC",
    is_public_within_team: true,
    metadata: { dimensions: "2048x2048", format: "PNG" },
    created_at: "2026-11-20T21:00:00Z",
    updated_at: "2026-11-20T21:00:00Z",
    url: "/assets/logo.png",
  },
  {
    id: "brand-emblem-webp",
    title: "Blason / Emblème UEC Circulaire",
    file_name: "uec-emblem.webp",
    file_path: "/assets/uec-emblem.webp",
    bucket_name: "local-assets",
    file_size: 133482,
    file_size_formatted: "130 Ko",
    mime_type: "image/webp",
    category: "BRANDING",
    department_id: null,
    department_name: "Pôle Créatif & Design",
    project_id: null,
    uploaded_by: "system",
    uploader_name: "Direction Artistique UEC",
    is_public_within_team: true,
    metadata: { dimensions: "800x800", format: "WebP" },
    created_at: "2026-11-20T21:00:00Z",
    updated_at: "2026-11-20T21:00:00Z",
    url: "/assets/uec-emblem.webp",
  },
  {
    id: "brand-shield-webp",
    title: "Bouclier Monogramme UEC",
    file_name: "uec-shield.webp",
    file_path: "/assets/uec-shield.webp",
    bucket_name: "local-assets",
    file_size: 23994,
    file_size_formatted: "24 Ko",
    mime_type: "image/webp",
    category: "BRANDING",
    department_id: null,
    department_name: "Pôle Créatif & Design",
    project_id: null,
    uploaded_by: "system",
    uploader_name: "Direction Artistique UEC",
    is_public_within_team: true,
    metadata: { dimensions: "512x512", format: "WebP" },
    created_at: "2026-11-20T21:00:00Z",
    updated_at: "2026-11-20T21:00:00Z",
    url: "/assets/uec-shield.webp",
  },
  {
    id: "brand-mascot-webp",
    title: "Mascotte UEC Officielle",
    file_name: "uec-mascot.webp",
    file_path: "/assets/uec-mascot.webp",
    bucket_name: "local-assets",
    file_size: 172806,
    file_size_formatted: "169 Ko",
    mime_type: "image/webp",
    category: "BRANDING",
    department_id: null,
    department_name: "Pôle Créatif & Design",
    project_id: null,
    uploaded_by: "system",
    uploader_name: "Direction Artistique UEC",
    is_public_within_team: true,
    metadata: { dimensions: "1024x1024", format: "WebP" },
    created_at: "2026-11-20T21:00:00Z",
    updated_at: "2026-11-20T21:00:00Z",
    url: "/assets/uec-mascot.webp",
  },
  {
    id: "brand-tifo-webp",
    title: "Visuel Tifo & Ambiance Tribune UEC",
    file_name: "uec-tifo.webp",
    file_path: "/assets/uec-tifo.webp",
    bucket_name: "local-assets",
    file_size: 73396,
    file_size_formatted: "72 Ko",
    mime_type: "image/webp",
    category: "PHOTO",
    department_id: null,
    department_name: "Pôle Audiovisuel & Montage",
    project_id: null,
    uploaded_by: "system",
    uploader_name: "Commission Photo",
    is_public_within_team: true,
    metadata: { dimensions: "1920x1080", format: "WebP" },
    created_at: "2026-11-20T21:00:00Z",
    updated_at: "2026-11-20T21:00:00Z",
    url: "/assets/uec-tifo.webp",
  },
  {
    id: "brand-banner-webp",
    title: "Bannière Officielle Réseaux UEC",
    file_name: "banner-uec.webp",
    file_path: "/assets/banner-uec.webp",
    bucket_name: "local-assets",
    file_size: 76114,
    file_size_formatted: "74 Ko",
    mime_type: "image/webp",
    category: "BRANDING",
    department_id: null,
    department_name: "Réseaux Sociaux & Comm",
    project_id: null,
    uploaded_by: "system",
    uploader_name: "Direction Artistique UEC",
    is_public_within_team: true,
    metadata: { dimensions: "1200x630", format: "WebP" },
    created_at: "2026-11-20T21:00:00Z",
    updated_at: "2026-11-20T21:00:00Z",
    url: "/assets/banner-uec.webp",
  },
];

export async function getMediaFiles(filter?: MediaFilter): Promise<MediaFileItem[]> {
  const supabase = await createClient();

  let query = (supabase.from("media_files") as any)
    .select(`
      id,
      title,
      file_name,
      file_path,
      bucket_name,
      file_size,
      mime_type,
      category,
      department_id,
      project_id,
      uploaded_by,
      is_public_within_team,
      metadata,
      created_at,
      updated_at
    `)
    .order("created_at", { ascending: false });

  if (filter?.category && filter.category !== "ALL") {
    query = query.eq("category", filter.category);
  }

  if (filter?.departmentId && filter.departmentId !== "ALL") {
    query = query.eq("department_id", filter.departmentId);
  }

  if (filter?.search?.trim()) {
    query = query.or(`title.ilike.%${filter.search.trim()}%,file_name.ilike.%${filter.search.trim()}%`);
  }

  const { data: dbFiles, error } = await query;
  if (error) {
    console.error("Error fetching media_files:", error);
  }

  const result: MediaFileItem[] = [];

  // Add DB files
  if (dbFiles && dbFiles.length > 0) {
    const userIds = Array.from(new Set(dbFiles.map((f: any) => f.uploaded_by)));
    const deptIds = Array.from(new Set(dbFiles.map((f: any) => f.department_id).filter(Boolean)));

    const profileMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await (supabase.from("profiles") as any)
        .select("id, full_name")
        .in("id", userIds);
      for (const p of profiles || []) {
        profileMap.set(p.id, p.full_name);
      }
    }

    const deptMap = new Map<string, string>();
    if (deptIds.length > 0) {
      const { data: depts } = await (supabase.from("departments") as any)
        .select("id, name")
        .in("id", deptIds);
      for (const d of depts || []) {
        deptMap.set(d.id, d.name);
      }
    }

    for (const f of dbFiles) {
      // Build public or signed URL if in Supabase storage
      let fileUrl = f.file_path;
      if (!fileUrl.startsWith("http") && !fileUrl.startsWith("/")) {
        const { data: urlData } = supabase.storage
          .from(f.bucket_name || "espace-digital-media")
          .getPublicUrl(f.file_path);
        fileUrl = urlData.publicUrl;
      }

      result.push({
        id: f.id,
        title: f.title,
        file_name: f.file_name,
        file_path: f.file_path,
        bucket_name: f.bucket_name,
        file_size: Number(f.file_size || 0),
        file_size_formatted: formatBytes(Number(f.file_size || 0)),
        mime_type: f.mime_type,
        category: f.category as MediaCategory,
        department_id: f.department_id,
        department_name: f.department_id ? deptMap.get(f.department_id) || null : null,
        project_id: f.project_id,
        uploaded_by: f.uploaded_by,
        uploader_name: profileMap.get(f.uploaded_by) || "Membre",
        is_public_within_team: f.is_public_within_team,
        metadata: f.metadata || {},
        created_at: f.created_at,
        updated_at: f.updated_at,
        url: fileUrl,
      });
    }
  }

  // Include official brand kit assets
  const brandAssetsFiltered = OFFICIAL_BRAND_ASSETS.filter((b) => {
    if (filter?.category && filter.category !== "ALL" && b.category !== filter.category) return false;
    if (filter?.search?.trim() && !b.title.toLowerCase().includes(filter.search.trim().toLowerCase())) return false;
    return true;
  });

  return [...result, ...brandAssetsFiltered];
}
