# UEC Espace Digital — Autonomous Multi-Agent Engineering Rules

These rules govern all AI agents working on the `rayenmkadmini/uec` codebase.

## 1. Project Context
- **Organization**: Union des Étudiants Clubistes (Depuis 2021).
- **Core Values**: Rigueur, Passion, Excellence, Créativité Digitale.
- **Roles**: `SUPER_ADMIN` (Executive leadership), `COORDINATOR` (Pôle head), `MEMBER` (Contributor).
- **Pôles**: Design, Audiovisuel/Vidéo, Web, Stratégie, Réseaux Sociaux, Innovation.
- **Tech Stack**: Next.js 15 (App Router), React 19, TypeScript 5.6, Tailwind CSS, Supabase (`@supabase/ssr`).

## 2. Inviolable Safety Invariants
1. **Production Supabase (`aigsdarfiplwmzqtqlxh`) is strictly READ-ONLY**:
   - Zero mutating DDL (`CREATE`, `ALTER`, `DROP`) or DML (`INSERT`, `UPDATE`, `DELETE`) on production.
   - Any database patch validation must run in isolated test containers or mock environments.
2. **No Autonomous Remote Push**:
   - Never run `git push` autonomously. Only commit locally with descriptive messages.
3. **No Production Deployment**:
   - Never deploy to Vercel production without explicit human authorization.
4. **Secret Protection**:
   - Never commit `.env.local`, API keys, or service-role keys.

## 3. Collaboration & Code Quality Rules
1. **Single Module Ownership**: No two agents may edit the same file simultaneously.
2. **Strict Verification**: Every change must pass:
   - `npx tsc --noEmit` (0 errors)
   - `npm run lint` (0 warnings/errors)
   - `npm run build` (All routes compile)
   - `node scripts/verify-security.mjs` (100% pass)
3. **No Mock Implementations**: All pages, forms, and actions must connect to real data layers and database tables.
4. **Trilingual Integrity**: Every user-facing string must exist in `messages/fr.json`, `messages/ar.json`, and `messages/en.json`.
