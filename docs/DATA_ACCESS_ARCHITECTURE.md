# UEC ESPACE DIGITAL — DATA ACCESS ARCHITECTURE
## PostgreSQL & Supabase SSR Integration Design

**Platform:** UEC — Espace Digital  
**Database:** PostgreSQL 17.12 via Supabase (`aigsdarfiplwmzqtqlxh`)  
**Architecture Pattern:** Server-Only Data Access Layer + Strongly-Typed Server Actions + RLS Enforcement

---

## 1. Architectural Principles

1. **Server-Side Data Execution:** All Supabase queries execute on the Next.js server runtime using `@supabase/ssr`. Database connection keys and tokens are never leaked to client components.
2. **PostgreSQL RLS as the Primary Defense:** PostgREST automatically enforces row-level security on every query based on the authenticated JWT:
   - `SUPER_ADMIN`: bypasses restriction via `is_super_admin(auth.uid())` helper in PostgreSQL.
   - `COORDINATOR`: scoped to department members and department projects/tasks.
   - `MEMBER`: scoped to assigned tasks, projects they belong to, and their own submissions.
3. **Application Defense-in-Depth:** In addition to RLS, Server Components and Server Actions run explicit assertions (`requireProfile()`, `requireSuperAdmin()`, `assertActionSuperAdmin()`) against the trusted `public.profiles` table.
4. **Zero-Trust Client Payload:** All IDs, roles, and status transitions are validated on the server. Client-provided metadata is never trusted for authorization.

---

## 2. Directory Layout

```
lib/
├── auth/
│   ├── rbac.ts            # Server-side RBAC guards & context retrieval
│   └── auth-context.tsx    # Client-side UI session listener
├── data/
│   ├── departments.ts     # Pôles query & statistics aggregation
│   ├── members.ts         # Profiles & department memberships
│   ├── projects.ts        # Projects, member counts & task progress
│   ├── tasks.ts           # Tasks, assignees, comments & submissions
│   └── dashboard.ts       # Role-specific dashboard KPI aggregators
└── supabase/
    ├── client.ts          # Browser client for auth state
    ├── server.ts          # Server client with cookie handling
    └── middleware.ts      # Edge middleware route interceptor
```

---

## 3. Data Flow Diagram

```
[ Browser Client ]
        │
        ├── 1. Navigation Request (e.g. GET /dashboard/projects)
        │       │
        │       ▼
  [ Edge Middleware ] ── No Session? ──► Redirect /login
        │
        ▼ Session Present
  [ Server Component (Page) ]
        │
        ├── 2. await requireProfile() ──► Validates profiles.role in PostgreSQL
        │
        ├── 3. await getProjects()
        │       │
        │       ▼
        │   [ Supabase Server Client ]
        │       │ (Sends auth cookie / JWT)
        │       ▼
        │   [ PostgreSQL + RLS ]
        │       │ Returns scoped rows
        │       ▼
        └── 4. Renders <ProjectsView projects={...} />
```

---

## 4. Mutation Flow (Server Actions)

```
[ Client Component ] (e.g. "Créer Projet" Button)
        │
        ├── Invokes createProjectAction(payload)
        │
        ▼
  [ Server Action (app/actions/projects.ts) ]
        │
        ├── 1. Zod Validation (ProjectCreateSchema.safeParse)
        ├── 2. await requireProfile() ── Verifies role === 'SUPER_ADMIN' || 'COORDINATOR'
        ├── 3. Uniqueness Check (projects.code)
        ├── 4. supabase.from("projects").insert(...)
        ├── 5. supabase.from("project_members").insert(...) (auto-assign creator)
        ├── 6. supabase.from("activity_logs").insert(...) (audit logging)
        ├── 7. revalidatePath("/dashboard/projects")
        │
        ▼
  [ Returns { success: true, message: "..." } to Client ]
```
