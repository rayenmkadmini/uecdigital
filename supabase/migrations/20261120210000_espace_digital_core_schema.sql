-- ============================================================
-- UEC ESPACE DIGITAL — PRODUCTION CORE SCHEMA MIGRATION
-- Project: aigsdarfiplwmzqtqlxh (uec digital)
-- Target Engine: PostgreSQL 17+ (Supabase)
-- Author: Senior Backend & Supabase Database Architect
-- ============================================================

-- 0. SCHEMA & EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE SCHEMA IF NOT EXISTS private;

-- ------------------------------------------------------------
-- 1. HELPER TRIGGER FUNCTIONS
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 2. AUTHENTICATION & PROFILES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  avatar_url text,
  role text NOT NULL CHECK (role IN ('SUPER_ADMIN', 'COORDINATOR', 'MEMBER')) DEFAULT 'MEMBER',
  is_active boolean NOT NULL DEFAULT true,
  phone text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);
CREATE INDEX IF NOT EXISTS profiles_is_active_idx ON public.profiles(is_active);

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  language text NOT NULL CHECK (language IN ('fr', 'ar', 'en')) DEFAULT 'fr',
  theme text NOT NULL CHECK (theme IN ('dark', 'light', 'system')) DEFAULT 'dark',
  email_notifications boolean NOT NULL DEFAULT true,
  push_notifications boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 3. DEPARTMENTS & DEPARTMENT MEMBERS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  description text,
  icon text NOT NULL DEFAULT 'folder',
  color text NOT NULL DEFAULT '#2563EB',
  coordinator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS departments_coordinator_idx ON public.departments(coordinator_id);

CREATE TABLE IF NOT EXISTS public.department_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_dept_member UNIQUE (department_id, user_id)
);

CREATE INDEX IF NOT EXISTS dept_members_user_idx ON public.department_members(user_id);
CREATE INDEX IF NOT EXISTS dept_members_dept_idx ON public.department_members(department_id);

-- ------------------------------------------------------------
-- 4. SECURITY CHECK HELPER FUNCTIONS (Schema private)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.is_super_admin(p_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_uid AND role = 'SUPER_ADMIN' AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION private.is_coordinator_of(p_dept_id uuid, p_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.departments
    WHERE id = p_dept_id AND coordinator_id = p_uid AND is_active = true
  ) OR private.is_super_admin(p_uid);
$$;

CREATE OR REPLACE FUNCTION private.is_member_of_department(p_dept_id uuid, p_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.department_members
    WHERE department_id = p_dept_id AND user_id = p_uid
  ) OR private.is_super_admin(p_uid);
$$;

-- ------------------------------------------------------------
-- 5. PROJECTS & PROJECT MEMBERS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('PLANNING', 'ACTIVE', 'ON_HOLD', 'IN_REVIEW', 'COMPLETED', 'CANCELLED')) DEFAULT 'PLANNING',
  priority text NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) DEFAULT 'MEDIUM',
  start_date date,
  deadline date,
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_dept_idx ON public.projects(department_id);
CREATE INDEX IF NOT EXISTS projects_status_idx ON public.projects(status);
CREATE INDEX IF NOT EXISTS projects_manager_idx ON public.projects(manager_id);

CREATE TABLE IF NOT EXISTS public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_in_project text DEFAULT 'CONTRIBUTOR',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_project_member UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS project_members_proj_idx ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS project_members_user_idx ON public.project_members(user_id);

-- ------------------------------------------------------------
-- 6. TASKS, ASSIGNEES, COMMENTS & ATTACHMENTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  title text NOT NULL,
  description text,
  acceptance_criteria text,
  priority text NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) DEFAULT 'MEDIUM',
  status text NOT NULL CHECK (status IN (
    'BACKLOG',
    'TODO',
    'IN_PROGRESS',
    'SUBMITTED',
    'COORDINATOR_REVIEW',
    'SUPER_ADMIN_APPROVAL',
    'APPROVED',
    'REVISION_REQUIRED',
    'REJECTED',
    'DONE',
    'CANCELLED'
  )) DEFAULT 'TODO',
  start_date date,
  deadline timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  coordinator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_dept_idx ON public.tasks(department_id);
CREATE INDEX IF NOT EXISTS tasks_project_idx ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON public.tasks(status);
CREATE INDEX IF NOT EXISTS tasks_deadline_idx ON public.tasks(deadline);

CREATE TABLE IF NOT EXISTS public.task_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_task_assignee UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS task_assignees_task_idx ON public.task_assignees(task_id);
CREATE INDEX IF NOT EXISTS task_assignees_user_idx ON public.task_assignees(user_id);

CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(btrim(content)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_comments_task_idx ON public.task_comments(task_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_attachments_task_idx ON public.task_attachments(task_id);

-- ------------------------------------------------------------
-- 7. SUBMISSION & STRICT APPROVAL WORKFLOW
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  description text NOT NULL,
  file_urls jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL CHECK (status IN (
    'PENDING_COORDINATOR',
    'PENDING_SUPER_ADMIN',
    'APPROVED',
    'REVISION_REQUIRED',
    'REJECTED'
  )) DEFAULT 'PENDING_COORDINATOR',
  coordinateur_notes text,
  reviewed_by_coordinator_at timestamptz,
  coordinator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  super_admin_notes text,
  approved_by_super_admin_at timestamptz,
  super_admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_task_submission_version UNIQUE (task_id, version)
);

CREATE INDEX IF NOT EXISTS task_submissions_task_idx ON public.task_submissions(task_id);
CREATE INDEX IF NOT EXISTS task_submissions_status_idx ON public.task_submissions(status);

CREATE TABLE IF NOT EXISTS public.approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.task_submissions(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN (
    'SUBMITTED',
    'COORDINATOR_FORWARDED',
    'COORDINATOR_REQUESTED_REVISION',
    'SUPER_ADMIN_APPROVED',
    'SUPER_ADMIN_REJECTED',
    'SUPER_ADMIN_REQUESTED_REVISION'
  )),
  decision_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS approval_history_sub_idx ON public.approval_history(submission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS approval_history_task_idx ON public.approval_history(task_id);

-- ------------------------------------------------------------
-- 8. INTERNAL REQUEST CENTER
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'DESIGN_REQUEST',
    'VIDEO_REQUEST',
    'PHOTOGRAPHY_REQUEST',
    'DEVELOPMENT_REQUEST',
    'TECHNICAL_SUPPORT',
    'DIGITAL_STRATEGY',
    'OTHER'
  )),
  requesting_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  target_department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  priority text NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) DEFAULT 'MEDIUM',
  desired_deadline date,
  attachments jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL CHECK (status IN (
    'NEW',
    'UNDER_REVIEW',
    'ACCEPTED',
    'REJECTED',
    'ASSIGNED',
    'IN_PROGRESS',
    'COMPLETED',
    'CLOSED'
  )) DEFAULT 'NEW',
  assigned_coordinator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  converted_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_requests_target_dept_idx ON public.service_requests(target_department_id);
CREATE INDEX IF NOT EXISTS service_requests_requester_idx ON public.service_requests(requester_id);
CREATE INDEX IF NOT EXISTS service_requests_status_idx ON public.service_requests(status);

-- ------------------------------------------------------------
-- 9. CONTENT CALENDAR
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  platform text NOT NULL CHECK (platform IN ('FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'LINKEDIN', 'YOUTUBE', 'WEBSITE', 'OTHER')),
  content_type text DEFAULT 'POST',
  scheduled_date timestamptz NOT NULL,
  published_date timestamptz,
  published_url text,
  designer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  writer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN (
    'IDEA',
    'DRAFT',
    'DESIGN',
    'REVIEW',
    'SUPER_ADMIN_APPROVAL',
    'SCHEDULED',
    'PUBLISHED',
    'CANCELLED'
  )) DEFAULT 'IDEA',
  attachments jsonb DEFAULT '[]'::jsonb,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_calendar_sched_idx ON public.content_calendar(scheduled_date ASC);
CREATE INDEX IF NOT EXISTS content_calendar_status_idx ON public.content_calendar(status);

-- ------------------------------------------------------------
-- 10. MEDIA LIBRARY
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.media_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  bucket_name text NOT NULL DEFAULT 'espace-digital-media',
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'LOGOS',
    'BRAND_ASSETS',
    'GRAPHIC_DESIGNS',
    'PHOTOGRAPHY',
    'VIDEOS',
    'SOURCE_FILES',
    'TEMPLATES',
    'DOCUMENTS',
    'PROJECT_ARCHIVES'
  )),
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_public_within_team boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_files_category_idx ON public.media_files(category);
CREATE INDEX IF NOT EXISTS media_files_dept_idx ON public.media_files(department_id);

-- ------------------------------------------------------------
-- 11. COMMUNICATION: ANNOUNCEMENTS & NOTIFICATIONS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_audience text NOT NULL CHECK (target_audience IN ('ALL', 'DEPARTMENT', 'COORDINATORS_ONLY', 'SPECIFIC_ROLES')) DEFAULT 'ALL',
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  priority text NOT NULL CHECK (priority IN ('NORMAL', 'IMPORTANT', 'URGENT')) DEFAULT 'NORMAL',
  is_pinned boolean NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS announcements_pub_idx ON public.announcements(published_at DESC);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON public.notifications(user_id, is_read, created_at DESC);

-- ------------------------------------------------------------
-- 12. MEETINGS MANAGEMENT
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  duration_min integer NOT NULL DEFAULT 60 CHECK (duration_min BETWEEN 5 AND 600),
  location text,
  meeting_link text,
  agenda jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')) DEFAULT 'SCHEDULED',
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meetings_sched_idx ON public.meetings(scheduled_at DESC);

CREATE TABLE IF NOT EXISTS public.meeting_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('INVITED', 'ACCEPTED', 'DECLINED', 'ATTENDED', 'ABSENT', 'EXCUSED')) DEFAULT 'INVITED',
  CONSTRAINT uq_meeting_attendee UNIQUE (meeting_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.meeting_minutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL UNIQUE REFERENCES public.meetings(id) ON DELETE CASCADE,
  recorded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  decisions jsonb DEFAULT '[]'::jsonb,
  action_items jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 13. EQUIPMENT & LOANS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'CAMERAS',
    'LENSES',
    'MICROPHONES',
    'COMPUTERS',
    'LIGHTING',
    'STABILIZERS',
    'STORAGE_DEVICES',
    'OTHER'
  )),
  description text,
  serial_number text,
  condition text NOT NULL CHECK (condition IN ('NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR')) DEFAULT 'GOOD',
  status text NOT NULL CHECK (status IN ('AVAILABLE', 'BORROWED', 'MAINTENANCE', 'DAMAGED', 'RETIRED')) DEFAULT 'AVAILABLE',
  storage_location text,
  purchase_date date,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS equipment_cat_idx ON public.equipment(category);
CREATE INDEX IF NOT EXISTS equipment_status_idx ON public.equipment(status);

CREATE TABLE IF NOT EXISTS public.equipment_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE RESTRICT,
  borrower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  borrow_date timestamptz NOT NULL DEFAULT now(),
  expected_return_date timestamptz NOT NULL,
  actual_return_date timestamptz,
  condition_at_checkout text NOT NULL DEFAULT 'GOOD',
  condition_at_return text,
  notes text,
  status text NOT NULL CHECK (status IN ('REQUESTED', 'APPROVED', 'ACTIVE', 'RETURNED', 'OVERDUE', 'REJECTED')) DEFAULT 'REQUESTED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS equipment_loans_status_idx ON public.equipment_loans(status);
CREATE INDEX IF NOT EXISTS equipment_loans_borrower_idx ON public.equipment_loans(borrower_id);

-- ------------------------------------------------------------
-- 14. TAMPER-PROOF ACTIVITY LOGS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_logs_actor_idx ON public.activity_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_entity_idx ON public.activity_logs(entity_type, entity_id);

-- ------------------------------------------------------------
-- 15. AUTOMATIC TRIGGERS (UPDATED_AT)
-- ------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN 
    SELECT table_name 
    FROM information_schema.columns 
    WHERE column_name = 'updated_at' 
      AND table_schema = 'public'
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I;
      CREATE TRIGGER trg_set_updated_at
      BEFORE UPDATE ON public.%I
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
    ', t, t);
  END LOOP;
END;
$$;

-- ------------------------------------------------------------
-- 16. SECURITY ENFORCEMENT TRIGGERS
-- ------------------------------------------------------------

-- Prevent users from escalating their own role or active status
CREATE OR REPLACE FUNCTION private.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (OLD.role IS DISTINCT FROM NEW.role OR OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
    IF NOT private.is_super_admin(auth.uid()) THEN
      RAISE EXCEPTION 'SECURITY_VIOLATION: Seul le Super Admin peut modifier le rôle ou le statut d''un utilisateur.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_roles ON public.profiles;
CREATE TRIGGER trg_protect_profile_roles
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION private.prevent_role_escalation();

-- Enforce strict Super Admin approval authority
CREATE OR REPLACE FUNCTION private.enforce_super_admin_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Check approval on task_submissions
  IF TG_TABLE_NAME = 'task_submissions' THEN
    IF NEW.status = 'APPROVED' AND (OLD.status IS NULL OR OLD.status <> 'APPROVED') THEN
      IF NOT private.is_super_admin(auth.uid()) THEN
        RAISE EXCEPTION 'APPROVAL_VIOLATION: Seul le Super Admin est habilité à approuver définitivement une soumission.';
      END IF;
      NEW.is_locked := true;
      NEW.approved_by_super_admin_at := now();
      NEW.super_admin_id := auth.uid();
    END IF;

    -- Protect locked submissions from mutation
    IF OLD.is_locked = true AND (
      OLD.title IS DISTINCT FROM NEW.title OR
      OLD.description IS DISTINCT FROM NEW.description OR
      OLD.file_urls IS DISTINCT FROM NEW.file_urls
    ) THEN
      RAISE EXCEPTION 'IMMUTABILITY_VIOLATION: Une soumission approuvée est immuable. Créez une nouvelle version.';
    END IF;
  END IF;

  -- Check approval on tasks
  IF TG_TABLE_NAME = 'tasks' THEN
    IF NEW.status = 'APPROVED' AND (OLD.status IS NULL OR OLD.status <> 'APPROVED') THEN
      IF NOT private.is_super_admin(auth.uid()) THEN
        RAISE EXCEPTION 'APPROVAL_VIOLATION: Seul le Super Admin peut valider une tâche au statut APPROVED.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_submission_approval ON public.task_submissions;
CREATE TRIGGER trg_enforce_submission_approval
BEFORE UPDATE ON public.task_submissions
FOR EACH ROW
EXECUTE FUNCTION private.enforce_super_admin_approval();

DROP TRIGGER IF EXISTS trg_enforce_task_approval ON public.tasks;
CREATE TRIGGER trg_enforce_task_approval
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION private.enforce_super_admin_approval();

-- Automatic Profile & Preference generation upon Auth sign-up
CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', split_part(COALESCE(NEW.email, 'Membre'), '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'MEMBER'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_preferences (user_id, language, theme)
  VALUES (NEW.id, 'fr', 'dark')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION private.handle_new_user();

-- ------------------------------------------------------------
-- 17. ROW LEVEL SECURITY (RLS) ACTIVATION
-- ------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_minutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 18. RLS POLICIES SPECIFICATION
-- ------------------------------------------------------------

-- PROFILES
DROP POLICY IF EXISTS "profiles_select_all_active" ON public.profiles;
CREATE POLICY "profiles_select_all_active" ON public.profiles
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid() OR private.is_super_admin(auth.uid()))
WITH CHECK (id = auth.uid() OR private.is_super_admin(auth.uid()));

-- USER PREFERENCES
DROP POLICY IF EXISTS "preferences_select_own" ON public.user_preferences;
CREATE POLICY "preferences_select_own" ON public.user_preferences
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "preferences_update_own" ON public.user_preferences;
CREATE POLICY "preferences_update_own" ON public.user_preferences
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DEPARTMENTS
DROP POLICY IF EXISTS "departments_select_active" ON public.departments;
CREATE POLICY "departments_select_active" ON public.departments
FOR SELECT TO authenticated
USING (is_active = true OR private.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "departments_manage_super_admin" ON public.departments;
CREATE POLICY "departments_manage_super_admin" ON public.departments
FOR ALL TO authenticated
USING (private.is_super_admin(auth.uid()))
WITH CHECK (private.is_super_admin(auth.uid()));

-- DEPARTMENT MEMBERS
DROP POLICY IF EXISTS "dept_members_select" ON public.department_members;
CREATE POLICY "dept_members_select" ON public.department_members
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "dept_members_manage" ON public.department_members;
CREATE POLICY "dept_members_manage" ON public.department_members
FOR ALL TO authenticated
USING (private.is_coordinator_of(department_id, auth.uid()))
WITH CHECK (private.is_coordinator_of(department_id, auth.uid()));

-- PROJECTS
DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select" ON public.projects
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid()) OR
  private.is_coordinator_of(department_id, auth.uid()) OR
  EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = id AND pm.user_id = auth.uid())
);

DROP POLICY IF EXISTS "projects_insert" ON public.projects;
CREATE POLICY "projects_insert" ON public.projects
FOR INSERT TO authenticated
WITH CHECK (private.is_coordinator_of(department_id, auth.uid()));

DROP POLICY IF EXISTS "projects_update" ON public.projects;
CREATE POLICY "projects_update" ON public.projects
FOR UPDATE TO authenticated
USING (private.is_coordinator_of(department_id, auth.uid()))
WITH CHECK (private.is_coordinator_of(department_id, auth.uid()));

DROP POLICY IF EXISTS "projects_delete" ON public.projects;
CREATE POLICY "projects_delete" ON public.projects
FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()));

-- PROJECT MEMBERS
DROP POLICY IF EXISTS "project_members_select" ON public.project_members;
CREATE POLICY "project_members_select" ON public.project_members
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "project_members_manage" ON public.project_members;
CREATE POLICY "project_members_manage" ON public.project_members
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND private.is_coordinator_of(p.department_id, auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND private.is_coordinator_of(p.department_id, auth.uid())
  )
);

-- TASKS
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid()) OR
  private.is_coordinator_of(department_id, auth.uid()) OR
  EXISTS (SELECT 1 FROM public.task_assignees ta WHERE ta.task_id = id AND ta.user_id = auth.uid())
);

DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
CREATE POLICY "tasks_insert" ON public.tasks
FOR INSERT TO authenticated
WITH CHECK (private.is_coordinator_of(department_id, auth.uid()));

DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
CREATE POLICY "tasks_update" ON public.tasks
FOR UPDATE TO authenticated
USING (
  private.is_super_admin(auth.uid()) OR
  private.is_coordinator_of(department_id, auth.uid()) OR
  EXISTS (SELECT 1 FROM public.task_assignees ta WHERE ta.task_id = id AND ta.user_id = auth.uid())
)
WITH CHECK (
  private.is_super_admin(auth.uid()) OR
  private.is_coordinator_of(department_id, auth.uid()) OR
  EXISTS (SELECT 1 FROM public.task_assignees ta WHERE ta.task_id = id AND ta.user_id = auth.uid())
);

DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;
CREATE POLICY "tasks_delete" ON public.tasks
FOR DELETE TO authenticated
USING (private.is_coordinator_of(department_id, auth.uid()));

-- TASK ASSIGNEES
DROP POLICY IF EXISTS "task_assignees_select" ON public.task_assignees;
CREATE POLICY "task_assignees_select" ON public.task_assignees
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "task_assignees_manage" ON public.task_assignees;
CREATE POLICY "task_assignees_manage" ON public.task_assignees
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id AND private.is_coordinator_of(t.department_id, auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id AND private.is_coordinator_of(t.department_id, auth.uid())
  )
);

-- TASK COMMENTS
DROP POLICY IF EXISTS "task_comments_select" ON public.task_comments;
CREATE POLICY "task_comments_select" ON public.task_comments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id AND (
      private.is_super_admin(auth.uid()) OR
      private.is_coordinator_of(t.department_id, auth.uid()) OR
      EXISTS (SELECT 1 FROM public.task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "task_comments_insert" ON public.task_comments;
CREATE POLICY "task_comments_insert" ON public.task_comments
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- TASK SUBMISSIONS
DROP POLICY IF EXISTS "submissions_select" ON public.task_submissions;
CREATE POLICY "submissions_select" ON public.task_submissions
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid()) OR
  submitted_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id AND private.is_coordinator_of(t.department_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "submissions_insert" ON public.task_submissions;
CREATE POLICY "submissions_insert" ON public.task_submissions
FOR INSERT TO authenticated
WITH CHECK (
  submitted_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.task_assignees ta
    WHERE ta.task_id = task_id AND ta.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "submissions_update" ON public.task_submissions;
CREATE POLICY "submissions_update" ON public.task_submissions
FOR UPDATE TO authenticated
USING (
  private.is_super_admin(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id AND private.is_coordinator_of(t.department_id, auth.uid())
  ) OR
  (submitted_by = auth.uid() AND is_locked = false)
)
WITH CHECK (
  private.is_super_admin(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id AND private.is_coordinator_of(t.department_id, auth.uid())
  ) OR
  (submitted_by = auth.uid() AND is_locked = false)
);

-- APPROVAL HISTORY
DROP POLICY IF EXISTS "approval_history_select" ON public.approval_history;
CREATE POLICY "approval_history_select" ON public.approval_history
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid()) OR
  actor_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id AND private.is_coordinator_of(t.department_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "approval_history_insert" ON public.approval_history;
CREATE POLICY "approval_history_insert" ON public.approval_history
FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid());

-- SERVICE REQUESTS
DROP POLICY IF EXISTS "requests_select" ON public.service_requests;
CREATE POLICY "requests_select" ON public.service_requests
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid()) OR
  requester_id = auth.uid() OR
  private.is_coordinator_of(target_department_id, auth.uid())
);

DROP POLICY IF EXISTS "requests_insert" ON public.service_requests;
CREATE POLICY "requests_insert" ON public.service_requests
FOR INSERT TO authenticated
WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "requests_update" ON public.service_requests;
CREATE POLICY "requests_update" ON public.service_requests
FOR UPDATE TO authenticated
USING (
  private.is_super_admin(auth.uid()) OR
  private.is_coordinator_of(target_department_id, auth.uid()) OR
  (requester_id = auth.uid() AND status = 'NEW')
)
WITH CHECK (
  private.is_super_admin(auth.uid()) OR
  private.is_coordinator_of(target_department_id, auth.uid()) OR
  (requester_id = auth.uid() AND status = 'NEW')
);

-- CONTENT CALENDAR
DROP POLICY IF EXISTS "calendar_select" ON public.content_calendar;
CREATE POLICY "calendar_select" ON public.content_calendar
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "calendar_insert" ON public.content_calendar;
CREATE POLICY "calendar_insert" ON public.content_calendar
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "calendar_update" ON public.content_calendar;
CREATE POLICY "calendar_update" ON public.content_calendar
FOR UPDATE TO authenticated
USING (
  private.is_super_admin(auth.uid()) OR
  created_by = auth.uid() OR
  writer_id = auth.uid() OR
  designer_id = auth.uid()
)
WITH CHECK (
  private.is_super_admin(auth.uid()) OR
  created_by = auth.uid() OR
  writer_id = auth.uid() OR
  designer_id = auth.uid()
);

-- MEDIA FILES
DROP POLICY IF EXISTS "media_select" ON public.media_files;
CREATE POLICY "media_select" ON public.media_files
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid()) OR
  is_public_within_team = true OR
  uploaded_by = auth.uid() OR
  (department_id IS NOT NULL AND private.is_member_of_department(department_id, auth.uid()))
);

DROP POLICY IF EXISTS "media_insert" ON public.media_files;
CREATE POLICY "media_insert" ON public.media_files
FOR INSERT TO authenticated
WITH CHECK (uploaded_by = auth.uid());

-- ANNOUNCEMENTS
DROP POLICY IF EXISTS "announcements_select" ON public.announcements;
CREATE POLICY "announcements_select" ON public.announcements
FOR SELECT TO authenticated
USING (
  target_audience = 'ALL' OR
  private.is_super_admin(auth.uid()) OR
  (department_id IS NOT NULL AND private.is_member_of_department(department_id, auth.uid()))
);

DROP POLICY IF EXISTS "announcements_manage" ON public.announcements;
CREATE POLICY "announcements_manage" ON public.announcements
FOR ALL TO authenticated
USING (
  private.is_super_admin(auth.uid()) OR
  (department_id IS NOT NULL AND private.is_coordinator_of(department_id, auth.uid()))
)
WITH CHECK (
  private.is_super_admin(auth.uid()) OR
  (department_id IS NOT NULL AND private.is_coordinator_of(department_id, auth.uid()))
);

-- NOTIFICATIONS
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- MEETINGS
DROP POLICY IF EXISTS "meetings_select" ON public.meetings;
CREATE POLICY "meetings_select" ON public.meetings
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid()) OR
  created_by = auth.uid() OR
  (department_id IS NOT NULL AND private.is_member_of_department(department_id, auth.uid())) OR
  EXISTS (SELECT 1 FROM public.meeting_attendees ma WHERE ma.meeting_id = id AND ma.user_id = auth.uid())
);

DROP POLICY IF EXISTS "meetings_manage" ON public.meetings;
CREATE POLICY "meetings_manage" ON public.meetings
FOR ALL TO authenticated
USING (
  private.is_super_admin(auth.uid()) OR
  (department_id IS NOT NULL AND private.is_coordinator_of(department_id, auth.uid()))
)
WITH CHECK (
  private.is_super_admin(auth.uid()) OR
  (department_id IS NOT NULL AND private.is_coordinator_of(department_id, auth.uid()))
);

-- EQUIPMENT & LOANS
DROP POLICY IF EXISTS "equipment_select" ON public.equipment;
CREATE POLICY "equipment_select" ON public.equipment
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "equipment_manage" ON public.equipment;
CREATE POLICY "equipment_manage" ON public.equipment
FOR ALL TO authenticated
USING (private.is_super_admin(auth.uid()))
WITH CHECK (private.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "equipment_loans_select" ON public.equipment_loans;
CREATE POLICY "equipment_loans_select" ON public.equipment_loans
FOR SELECT TO authenticated
USING (borrower_id = auth.uid() OR private.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "equipment_loans_insert" ON public.equipment_loans;
CREATE POLICY "equipment_loans_insert" ON public.equipment_loans
FOR INSERT TO authenticated
WITH CHECK (borrower_id = auth.uid());

DROP POLICY IF EXISTS "equipment_loans_update" ON public.equipment_loans;
CREATE POLICY "equipment_loans_update" ON public.equipment_loans
FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (borrower_id = auth.uid() AND status = 'REQUESTED'))
WITH CHECK (private.is_super_admin(auth.uid()) OR (borrower_id = auth.uid() AND status = 'REQUESTED'));

-- ACTIVITY LOGS (Immutable: SELECT for Super Admin, INSERT allowed only, UPDATE/DELETE strictly DENIED)
DROP POLICY IF EXISTS "activity_logs_select" ON public.activity_logs;
CREATE POLICY "activity_logs_select" ON public.activity_logs
FOR SELECT TO authenticated
USING (private.is_super_admin(auth.uid()) OR actor_id = auth.uid());

DROP POLICY IF EXISTS "activity_logs_insert" ON public.activity_logs;
CREATE POLICY "activity_logs_insert" ON public.activity_logs
FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid() OR private.is_super_admin(auth.uid()));

-- ------------------------------------------------------------
-- 19. INITIAL SEED: 6 SPECIALIZED DEPARTMENTS
-- ------------------------------------------------------------
INSERT INTO public.departments (name, code, description, icon, color)
VALUES
  ('Design & Branding', 'DESIGN', 'Identité visuelle, branding, UI/UX design, créations graphiques pour les réseaux sociaux.', 'palette', '#EC4899'),
  ('Photo & Video Production', 'VIDEO', 'Couverture photographique, réalisation vidéo, montage, motion design et production audiovisuelle.', 'video', '#8B5CF6'),
  ('Web & Development', 'WEB', 'Développement de plateformes web, applications, programmation, intégration et maintenance technique.', 'code', '#2563EB'),
  ('Digital Strategy', 'STRATEGY', 'Stratégie digitale, campagnes de communication, planification des projets et innovation numérique.', 'compass', '#F59E0B'),
  ('Social Media', 'SOCIAL_MEDIA', 'Planification de contenu, community management, coordination et animation des réseaux sociaux.', 'share-2', '#10B981'),
  ('Innovation & IT', 'INNOVATION', 'Recherche technologique, support informatique, outils digitaux internes et expérimentations.', 'cpu', '#06B6D4')
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------
-- 20. PRIVATE STORAGE BUCKET CONFIGURATION
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'espace-digital-media',
  'espace-digital-media',
  false,
  52428800, -- 50 MB
  ARRAY[
    'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm',
    'application/pdf', 'application/zip', 'application/x-zip-compressed'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800;

-- Storage RLS Policies
DROP POLICY IF EXISTS "media_bucket_select" ON storage.objects;
CREATE POLICY "media_bucket_select" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'espace-digital-media');

DROP POLICY IF EXISTS "media_bucket_insert" ON storage.objects;
CREATE POLICY "media_bucket_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'espace-digital-media');

DROP POLICY IF EXISTS "media_bucket_delete" ON storage.objects;
CREATE POLICY "media_bucket_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'espace-digital-media' AND (owner = auth.uid() OR private.is_super_admin(auth.uid())));
