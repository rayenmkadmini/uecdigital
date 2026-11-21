# UEC ESPACE DIGITAL — PHASE 2.4.4.1
## Role × Column × Operation Comprehensive Security Matrix

**Project:** UEC — Espace Digital (*Union des Étudiants Clubistes — Depuis 2021*)  
**Repository:** `rayenmkadmini/uec`  
**Branch:** `feature/uec-espace-digital`  
**Target Table:** `public.tasks` (14 Columns)  
**Evaluated Object:** `private.enforce_task_member_immutability()` in `docs/sql/PHASE_2_4_4_PRODUCTION_PATCH.sql`

---

### 1. Matrix Overview

This matrix maps every database role against all 14 columns of `public.tasks` under `UPDATE` operations. For every permitted or denied operation, the exact SQL condition responsible is documented.

**Evaluated Roles:**
1. **DBA / Maintenance:** `session_user IN ('postgres', 'supabase_admin')` with no JWT.
2. **Service Role:** `auth.role() = 'service_role'`.
3. **Super Admin:** User with `profiles.role = 'SUPER_ADMIN' AND is_active = true`.
4. **Coordinator (Own Dept):** User who is coordinator of `OLD.department_id`.
5. **Coordinator (Other Dept):** User who is coordinator of another department.
6. **Assigned Member:** User listed in `public.task_assignees` for `OLD.id`.
7. **Unassigned Member:** User NOT listed in `public.task_assignees` for `OLD.id`.
8. **Anonymous User:** Request without valid JWT (`auth.uid() IS NULL`).

---

### 2. Comprehensive Security Matrix

```
+---------------------------------------------------------------------------------------------------------------------------------------------------------------+
| Column Name         | DBA / Maint | Service Role | Super Admin | Coord (Own Dept)      | Coord (Other Dept) | Assigned Member     | Unassigned Member | Anonymous |
|---------------------|:-----------:|:------------:|:-----------:|:---------------------:|:------------------:|:-------------------:|:-----------------:|:---------:|
| id                  | ALLOW       | ALLOW        | DENY [1]    | DENY [1]              | DENY [1]           | DENY [1]            | DENY [1]          | DENY [0]  |
| created_at          | ALLOW       | ALLOW        | DENY [1]    | DENY [1]              | DENY [1]           | DENY [1]            | DENY [1]          | DENY [0]  |
| department_id       | ALLOW       | ALLOW        | ALLOW [2]   | DENY [3]              | DENY [4]           | DENY [5]            | DENY [4]          | DENY [0]  |
| project_id          | ALLOW       | ALLOW        | ALLOW [2]   | ALLOW [6] / DENY [7]  | DENY [4]           | DENY [5]            | DENY [4]          | DENY [0]  |
| title               | ALLOW       | ALLOW        | ALLOW [2]   | ALLOW [6] / DENY [7]  | DENY [4]           | DENY [5]            | DENY [4]          | DENY [0]  |
| description         | ALLOW       | ALLOW        | ALLOW [2]   | ALLOW [6] / DENY [7]  | DENY [4]           | DENY [5]            | DENY [4]          | DENY [0]  |
| acceptance_criteria | ALLOW       | ALLOW        | ALLOW [2]   | ALLOW [6] / DENY [7]  | DENY [4]           | DENY [5]            | DENY [4]          | DENY [0]  |
| priority            | ALLOW       | ALLOW        | ALLOW [2]   | ALLOW [6] / DENY [7]  | DENY [4]           | DENY [5]            | DENY [4]          | DENY [0]  |
| deadline            | ALLOW       | ALLOW        | ALLOW [2]   | ALLOW [6] / DENY [7]  | DENY [4]           | DENY [5]            | DENY [4]          | DENY [0]  |
| start_date          | ALLOW       | ALLOW        | ALLOW [2]   | ALLOW [6] / DENY [7]  | DENY [4]           | DENY [5]            | DENY [4]          | DENY [0]  |
| created_by          | ALLOW       | ALLOW        | ALLOW [2]   | DENY [8]              | DENY [4]           | DENY [5]            | DENY [4]          | DENY [0]  |
| coordinator_id      | ALLOW       | ALLOW        | ALLOW [2]   | ALLOW [6] / DENY [7]  | DENY [4]           | DENY [5]            | DENY [4]          | DENY [0]  |
| status              | ALLOW       | ALLOW        | ALLOW [2]   | CONDITIONAL [9]       | DENY [4]           | CONDITIONAL [10]    | DENY [4]          | DENY [0]  |
| updated_at          | TRIGGER     | TRIGGER      | TRIGGER     | TRIGGER               | TRIGGER            | TRIGGER             | TRIGGER           | DENY [0]  |
+---------------------------------------------------------------------------------------------------------------------------------------------------------------+
```

---

### 3. Exact SQL Conditions Responsible for Rules

- **[0] Anonymous Rejection (Rule 3):**
  ```sql
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Session utilisateur valide requise pour modifier une tâche.';
  END IF;
  ```
- **[1] Universal Immutability (Rule 4):**
  ```sql
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'FORBIDDEN: Les champs identifiant (id) et date de création (created_at) sont strictement immuables.';
  END IF;
  ```
- **[2] Super Admin Authority (Rule 6):**
  ```sql
  IF v_is_super_admin THEN
    RETURN NEW;
  END IF;
  ```
- **[3] Coordinator Cross-Department Transfer Block (Rule 7.A):**
  ```sql
  IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
    RAISE EXCEPTION 'FORBIDDEN: Un coordinateur ne peut pas transférer une tâche vers un autre département.';
  END IF;
  ```
- **[4] Assignment & Isolation Block (Rule 8.A):**
  ```sql
  IF NOT EXISTS (
    SELECT 1 FROM public.task_assignees 
    WHERE task_id = OLD.id AND user_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: Vous n''êtes pas assigné à cette tâche.';
  END IF;
  ```
- **[5] Member Structural Field Immutability (Rule 8.B):**
  ```sql
  IF NEW.department_id IS DISTINCT FROM OLD.department_id OR
     NEW.project_id IS DISTINCT FROM OLD.project_id OR
     NEW.title IS DISTINCT FROM OLD.title OR
     NEW.description IS DISTINCT FROM OLD.description OR
     NEW.acceptance_criteria IS DISTINCT FROM OLD.acceptance_criteria OR
     NEW.priority IS DISTINCT FROM OLD.priority OR
     NEW.deadline IS DISTINCT FROM OLD.deadline OR
     NEW.start_date IS DISTINCT FROM OLD.start_date OR
     NEW.created_by IS DISTINCT FROM OLD.created_by OR
     NEW.coordinator_id IS DISTINCT FROM OLD.coordinator_id THEN
    RAISE EXCEPTION 'FORBIDDEN: Seuls le coordinateur de pôle ou le Super Admin peuvent modifier la définition ou les métadonnées de la tâche.';
  END IF;
  ```
- **[6] Coordinator Permitted Edits (Rule 7 Fallthrough):**  
  Permitted while `OLD.status NOT IN ('SUPER_ADMIN_APPROVAL', 'APPROVED', 'DONE')`.
- **[7] Coordinator Freeze in Review/Terminal States (Rule 7.C):**
  ```sql
  IF OLD.status IN ('SUPER_ADMIN_APPROVAL', 'APPROVED', 'DONE') AND (...) THEN
    RAISE EXCEPTION 'FORBIDDEN: Impossible de modifier une tâche validée ou sous revue du Super Admin (statut actuel: %).', OLD.status;
  END IF;
  ```
- **[8] Coordinator Author Immutability (Rule 7.B):**
  ```sql
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'FORBIDDEN: L''auteur initial de la tâche (created_by) est immuable.';
  END IF;
  ```
- **[9] Coordinator Status Rules (Rule 7.D):**  
  Coordinator CANNOT set `status IN ('APPROVED', 'DONE')`:
  ```sql
  IF NEW.status IN ('APPROVED', 'DONE') AND (OLD.status IS NULL OR OLD.status NOT IN ('APPROVED', 'DONE')) THEN
    RAISE EXCEPTION 'APPROVAL_VIOLATION: Seul le Super Admin est habilité à approuver ou clôturer définitivement une tâche (statut demandé: %).', NEW.status;
  END IF;
  ```
- **[10] Member Status Transitions (Rule 8.C & 8.D):**  
  - Locked if `OLD.status IN ('COORDINATOR_REVIEW', 'SUPER_ADMIN_APPROVAL', 'APPROVED', 'DONE', 'CANCELLED')`.
  - Allowed working states: `TODO` <-> `IN_PROGRESS`.
  - Move to `COORDINATOR_REVIEW` strictly requires active deliverable:
    ```sql
    IF NEW.status = 'COORDINATOR_REVIEW' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.task_submissions 
        WHERE task_id = OLD.id AND status = 'PENDING_COORDINATOR'
      ) THEN
        RAISE EXCEPTION 'FORBIDDEN: Le passage en revue requiert le dépôt préalable d''un livrable.';
      END IF;
      RETURN NEW;
    END IF;
    ```
  - All other status changes raise `FORBIDDEN`.
