# UEC ESPACE DIGITAL — PROJECTS MODULE SPECIFICATION
## Comprehensive Documentation for Digital Initiatives Management

**Module:** Projets Numériques  
**URL Route:** `/dashboard/projects`  
**Target Tables:** `public.projects`, `public.project_members`, `public.departments`, `public.profiles`

---

## 1. Overview & Business Logic

The Projects Module governs all digital initiatives across the 6 specialized departments of Union des Étudiants Clubistes. Initiatives range from matchday visual campaigns and documentary video productions to web portals and mobile systems.

Each project is anchored to a responsible department and has an assigned Project Manager.

### Supported Fields
- `id` (UUID): Primary key.
- `code` (VARCHAR, Unique): Project identifier (e.g., `DERBY-26`, `PORTAIL-V2`).
- `title` (TEXT): Official title.
- `description` (TEXT): Strategic goals and scope.
- `department_id` (UUID, Foreign Key): Department responsible.
- `manager_id` (UUID, Foreign Key): Project leader.
- `priority`: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- `status`: `PLANNING`, `ACTIVE`, `ON_HOLD`, `IN_REVIEW`, `COMPLETED`, `CANCELLED`.
- `start_date` / `deadline`: Project milestone dates.
- `progress` (INTEGER, 0-100): Percentage of project completion.
- `created_by` (UUID): Creator profile ID.

---

## 2. Authorization Rules

| Role | Read Access | Create Project | Edit Status / Progress | Assign Members |
|---|---|---|---|---|
| **SUPER_ADMIN** | All projects | Any department | Any project | Any project |
| **COORDINATOR** | Department projects + assigned | Own department only | Own department only | Own department only |
| **MEMBER** | Assigned projects only | ❌ Denied | ❌ Denied | ❌ Denied |

---

## 3. Server-Side Implementation

- **Data Access:** `getProjects(filter)` in `lib/data/projects.ts` joins `departments`, `profiles` (manager), and computes task completion counts dynamically.
- **Server Action:** `createProjectAction` in `app/actions/projects.ts` validates inputs via Zod, verifies uniqueness of `code`, inserts the project, auto-assigns the creator to `project_members`, logs the creation into `activity_logs`, and triggers Next.js path cache revalidation.
- **UI View:** `components/projects/projects-view.tsx` renders responsive cards, live gradient progress bars, priority indicators, and responsive modals for project creation and status editing.
