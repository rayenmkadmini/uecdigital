# UEC ESPACE DIGITAL — PHASE 2: ENVIRONMENT VARIABLES MATRIX

**Document Version:** 1.0.0  
**Compliance Standard:** Zero Secret Exposure / Strict Name-Only Verification  
**Target Environments:** Local (`.env.local`), Vercel Preview (Staging), Vercel Production

---

## 1. Environment Variable Registry (Names Only)

| Variable Name | Exposure Scope | Required / Optional | Target Runtime | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **`NEXT_PUBLIC_SUPABASE_URL`** | Public (Client + Server) | **Required** | Browser + Next.js Server | The HTTPS endpoint for the Supabase project API. |
| **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** | Public (Client + Server) | **Required*** | Browser + Next.js Server | Public Supabase API key with `anon` role, guarded by PostgreSQL RLS. |
| **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`** | Public (Client + Server) | Optional* | Browser + Next.js Server | Modern alias for the Supabase publishable anonymous key. |
| **`NEXT_PUBLIC_SITE_URL`** | Public (Client + Server) | Optional | Browser + Next.js Server | Canonical base URL used for email redirect anchors and Open Graph links. |
| **`SUPABASE_SERVICE_ROLE_KEY`** | Private (Server-Only) | Optional (Admin / CI) | Node.js Server / Scripts | Elevated service key for backend administrative tasks. Strictly omitted from client bundles. |

*\*Note: `lib/env.ts` enforces that at least one public key (`NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) is present.*

---

## 2. Environment Mapping Matrix

| Variable Name | Local Development | Vercel Preview (Staging) | Vercel Production |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://aigsdarfiplwmzqtqlxh.supabase.co` | `https://aigsdarfiplwmzqtqlxh.supabase.co` | `https://aigsdarfiplwmzqtqlxh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `[Project Anon Key]` | `[Project Anon Key]` | `[Project Anon Key]` |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Dynamic (or `https://*.vercel.app`) | `https://digital.ueclubistes.tn` |
| `SUPABASE_SERVICE_ROLE_KEY` | Local testing only (`.env.local`) | Omitted (Not needed by App Router) | Omitted (Not needed by App Router) |

---

## 3. Client Bundle Safety & Leaked Secret Defenses

1. **Next.js Invariant:** Only environment variables prefixed with `NEXT_PUBLIC_` are inlined into the client-side JavaScript bundle during `npm run build`.
2. **Audit Verification:**
   - `lib/env.ts` validates public environment variables at runtime and provides clear diagnostic messages if required keys are missing.
   - Client bundle source map inspection confirmed that **zero service-role credentials or database passwords** are compiled into the client output.
3. **Repository Exclusion:**
   - `.env`, `.env.local`, and `.env*.local` are explicitly excluded from Git tracking via `.gitignore`.
   - Verified that `.env.local` remains untracked in the local repository.

---

## 4. Staging Provisioning Checklist for Vercel

When configuring the project in Vercel:
1. Navigate to **Project Settings** > **Environment Variables**.
2. Add `NEXT_PUBLIC_SUPABASE_URL` with the target Supabase project URL (Preview + Production).
3. Add `NEXT_PUBLIC_SUPABASE_ANON_KEY` with the target Supabase anon key (Preview + Production).
4. For Production only, add `NEXT_PUBLIC_SITE_URL` = `https://digital.ueclubistes.tn`.
5. For Preview/Staging, leave `NEXT_PUBLIC_SITE_URL` unset (the application automatically defaults to `window.location.origin` in client components).
