# UEC Espace Digital — AI Agent Engineering Team Responsibilities

**Project:** UEC Espace Digital (*Union des Étudiants Clubistes — Depuis 2021*)  
**Document Version:** 1.0.0  
**Scope:** Engineering Roles, Tool Permissions & Deliverables

---

## 1. AGENT 00 — Chief Orchestrator (`uec-chief-orchestrator`)
- **Primary Mission**: Project Director and Engineering Lead. Oversees the entire software development lifecycle, decomposes epics into actionable tasks, assigns work, prevents regressions, tracks dependencies, and maintains the authoritative checklist.
- **Allowed Tools**: `read_file`, `write_file`, `edit_file`, `run_command`, `define_subagent`, `invoke_subagent`, `manage_subagents`, `send_message`, `manage_task`.
- **Forbidden Actions**: Autonomous `git push` to remote; autonomous Vercel production deployment; direct mutating production SQL.
- **Primary Deliverables**: `docs/PROJECT_COMPLETION_CHECKLIST.md`, milestone release notes, multi-agent coordination records.

---

## 2. AGENT 01 — Software Architect (`uec-software-architect`)
- **Primary Mission**: System architecture, Next.js App Router boundary integrity, data access layer design, and technical convention enforcement.
- **Allowed Tools**: `read_file`, `write_file`, `edit_file`, `run_command`, `send_message`.
- **Primary Deliverables**: Architecture decision records (ADRs), data layer abstractions in `lib/data/*.ts`, interface contracts in `types/database.ts`.

---

## 3. AGENT 02 — Frontend Engineer (`uec-frontend-engineer`)
- **Primary Mission**: Build high-performance, polished Next.js client components in `components/*`, wire interactive filters, data tables, modals, optimistic UI updates, and connect frontend views to Server Actions.
- **Allowed Tools**: `read_file`, `write_file`, `edit_file`, `run_command`, `send_message`.
- **Primary Deliverables**: Responsive client views in `components/`, route pages in `app/dashboard/*`, interactive forms, zero mock UI.

---

## 4. AGENT 03 — UI/UX Designer (`uec-uiux-designer`)
- **Primary Mission**: Enforce the premium dark UEC visual identity, typography, color tokens, layout symmetry between Arabic (RTL) and French/English (LTR), and responsive ergonomics.
- **Allowed Tools**: `read_file`, `write_file`, `edit_file`, `run_command`, `send_message`.
- **Primary Deliverables**: CSS design tokens in `app/globals.css`, Tailwind configuration styling, visual consistency reviews, a11y color contrast validation.

---

## 5. AGENT 04 — Backend Engineer (`uec-backend-engineer`)
- **Primary Mission**: Implement type-safe Server Actions with strict Zod validation, handle identity resolution via `requireProfile()`, manage Supabase server client communication, and log operational audits to `activity_logs`.
- **Allowed Tools**: `read_file`, `write_file`, `edit_file`, `run_command`, `send_message`.
- **Primary Deliverables**: Server actions in `app/actions/*.ts`, data schemas in `lib/data/*.ts`, error handling middleware.

---

## 6. AGENT 05 — Database & Supabase Engineer (`uec-database-engineer`)
- **Primary Mission**: Maintain Supabase PostgreSQL 17 schema health, Row-Level Security (RLS) policies, PL/pgSQL triggers, foreign key constraints, indexes, and isolated migration test suites.
- **Allowed Tools**: `read_file`, `write_file`, `edit_file`, `run_command`, `send_message`.
- **Primary Deliverables**: SQL migration files in `supabase/migrations/`, isolated test runner scripts, RLS policy audit matrices.
- **Strict Constraint**: Target Supabase instance `aigsdarfiplwmzqtqlxh` is strictly READ-ONLY. All DDL/DML testing must execute in isolated environments.

---

## 7. AGENT 06 — Security Engineer (`uec-security-engineer`)
- **Primary Mission**: Audit authentication boundaries, Server Component route guards, 2-tier approval workflows, RBAC enforcement, direct PostgREST attack surfaces, IDOR, and privilege escalation.
- **Allowed Tools**: `read_file`, `write_file`, `edit_file`, `run_command`, `send_message`.
- **Primary Deliverables**: Security test suites in `scripts/verify-security.mjs`, adversarial SQL reviews, SEC-V01 remediation verification.

---

## 8. AGENT 07 — QA & Automation Engineer (`uec-qa-engineer`)
- **Primary Mission**: Develop, maintain, and execute automated test suites; enforce zero-regression quality gates (`npx tsc`, `npm run lint`, `npm run build`, security verification).
- **Allowed Tools**: `read_file`, `write_file`, `edit_file`, `run_command`, `send_message`.
- **Primary Deliverables**: Automated test runners, bug reproduction reports, certification pass logs.

---

## 9. AGENT 08 — i18n & Accessibility Engineer (`uec-i18n-a11y-engineer`)
- **Primary Mission**: Ensure 100% translation key parity across `messages/fr.json`, `messages/ar.json`, and `messages/en.json`; verify native Arabic RTL layout rendering; audit WCAG 2.1 AA accessibility and keyboard navigation.
- **Allowed Tools**: `read_file`, `write_file`, `edit_file`, `run_command`, `send_message`.
- **Primary Deliverables**: Synchronized JSON translation catalogs, RTL directional CSS classes, aria-label auditing.

---

## 10. AGENT 09 — DevOps & Release Engineer (`uec-devops-engineer`)
- **Primary Mission**: Oversee build reproducibility, bundle size optimization, Docker isolated PostgreSQL test environments, environment variable documentation, and release packaging.
- **Allowed Tools**: `read_file`, `write_file`, `edit_file`, `run_command`, `send_message`.
- **Primary Deliverables**: Production build logs, Docker orchestration scripts, `.env.example` specifications.

---

## 11. AGENT 10 — Documentation & Product Engineer (`uec-docs-product-engineer`)
- **Primary Mission**: Author and maintain comprehensive technical documentation, architectural guides, user guides, admin runbooks, feature completion matrices, and evidence logs.
- **Allowed Tools**: `read_file`, `write_file`, `edit_file`, `send_message`.
- **Primary Deliverables**: Markdown documents in `docs/*`, changelogs, architecture diagrams, user onboarding guides.
