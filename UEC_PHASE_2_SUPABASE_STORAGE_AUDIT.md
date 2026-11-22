# UEC ESPACE DIGITAL — PHASE 2: SUPABASE STORAGE AUDIT

**Project:** UEC Espace Digital  
**Supabase Reference:** `aigsdarfiplwmzqtqlxh` (eu-west-1)  
**Audit Date:** November 22, 2026  
**Auditor:** Supabase Security Architect & Cloud Storage Specialist

---

## 1. Storage Inventory & Bucket Specifications

Inspection of the live Supabase storage schema (`storage.buckets`) confirmed the presence of the primary digital assets bucket:

```text
Bucket ID:          espace-digital-media
Bucket Name:        espace-digital-media
Public Access:      FALSE (Private Storage)
File Size Limit:    52,428,800 bytes (50 MB)
Owner:              PostgreSQL Service / postgres
Created At:         2026-11-20
```

### Allowed MIME Types
The bucket is configured to accept media and document assets appropriate for club operations:
- **Raster Images:** `image/png`, `image/jpeg`, `image/webp`, `image/gif`
- **Vector Graphics:** `image/svg+xml`
- **Video:** `video/mp4`, `video/quicktime`, `video/webm`
- **Documents & Archives:** `application/pdf`, `application/zip`, `application/x-zip-compressed`

---

## 2. Storage Row-Level Security (RLS) Policy Audit

The storage objects table (`storage.objects`) has Row-Level Security enabled with three dedicated policies:

### 2.1 Read Access (`media_bucket_select`)
- **Action:** `SELECT`
- **Roles:** `authenticated`
- **Condition:**
  ```sql
  (bucket_id = 'espace-digital-media'::text)
  ```
- **Security Assessment:**  
  Allows all authenticated UEC members to view uploaded assets. Anonymous internet users are strictly blocked, preventing scraping of internal club media.

### 2.2 Upload Access (`media_bucket_insert`)
- **Action:** `INSERT`
- **Roles:** `authenticated`
- **Condition (`WITH CHECK`):**
  ```sql
  (bucket_id = 'espace-digital-media'::text)
  ```
- **Security Assessment:**  
  Only logged-in members can upload assets. Uploaded files must conform to the 50 MB limit and allowed MIME types defined at the bucket level.

### 2.3 Deletion Access (`media_bucket_delete`)
- **Action:** `DELETE`
- **Roles:** `authenticated`
- **Condition:**
  ```sql
  ((bucket_id = 'espace-digital-media'::text) AND ((owner = auth.uid()) OR private.is_super_admin(auth.uid())))
  ```
- **Security Assessment:**  
  Deletion is strictly restricted to either the original file uploader (`owner = auth.uid()`) or an authenticated executive (`private.is_super_admin(auth.uid())`). General members cannot delete files belonging to other members or departments.

---

## 3. Application Storage Integration Points

| Application Module | File Path | Interaction Type | Storage Mechanism |
| :--- | :--- | :--- | :--- |
| **Media Server Action** | `app/actions/media.ts` | Delete / Cleanup | `supabase.storage.from(media.bucket_name).remove([media.file_path])` |
| **Media Upload View** | `components/media/media-view.tsx` | Browser Upload | `supabase.storage.from('espace-digital-media').upload(path, file)` |
| **Media Data Access** | `lib/data/media.ts` | Signed URLs / Downloads | `supabase.storage.from(bucket).createSignedUrl(path, 3600)` |

### File Access Model (Signed URLs vs Public URLs)
Because `espace-digital-media` has `public: false`, file downloads and previews use short-lived time-limited Signed URLs (`createSignedUrl(..., 3600)`). This prevents persistent external hotlinking and ensures files remain private to UEC members.

---

## 4. Storage Architecture Recommendations for Staging & Production

1. **Bucket Provisioning Status:**
   - The primary bucket `espace-digital-media` is fully functional and requires zero schema changes.
2. **Meeting Minutes (PVs) Storage:**
   - Meeting minutes are currently stored via document links or using `espace-digital-media` with the document MIME type (`application/pdf`). This avoids the administrative overhead of maintaining multiple separate buckets.
3. **CORS Configuration:**
   - In Supabase Dashboard > Storage > Configuration, verify that the Allowed Origins include:
     - `https://*.vercel.app` (Staging preview environments)
     - `https://digital.ueclubistes.tn` (Production)
     - `http://localhost:3000` (Local testing)
