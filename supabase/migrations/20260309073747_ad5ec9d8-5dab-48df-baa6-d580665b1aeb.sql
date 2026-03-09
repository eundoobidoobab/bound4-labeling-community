
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'worker');
CREATE TYPE public.project_status AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE public.membership_status AS ENUM ('ACTIVE', 'REMOVED');
CREATE TYPE public.board_type AS ENUM ('NOTICE', 'GUIDE', 'QNA', 'ALLOCATION', 'BUG', 'CUSTOM');
CREATE TYPE public.board_status AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE public.invitation_status AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED');
CREATE TYPE public.post_status AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE public.application_status AS ENUM ('APPLIED', 'SELECTED', 'REJECTED', 'WITHDRAWN');
CREATE TYPE public.assignment_status AS ENUM ('ASSIGNED', 'DISTRIBUTED_DONE');
CREATE TYPE public.notification_type AS ENUM ('ALLOCATION_DISTRIBUTED', 'DM_NEW_MESSAGE', 'NOTICE_PUBLISHED', 'GUIDE_UPDATED');
CREATE TYPE public.email_event_type AS ENUM ('INVITE', 'ALLOCATION_DISTRIBUTED');
CREATE TYPE public.email_status AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles (separate table per security best practice)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status project_status NOT NULL DEFAULT 'ACTIVE',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Project admins
CREATE TABLE public.project_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE (project_id, admin_id)
);

-- Project memberships
CREATE TABLE public.project_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status membership_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, worker_id)
);

-- Boards
CREATE TABLE public.boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type board_type NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  status board_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invitations
CREATE TABLE public.project_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status invitation_status NOT NULL DEFAULT 'PENDING',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notices
CREATE TABLE public.notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  status post_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.notice_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id UUID NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (notice_id, user_id)
);

-- Guide system
CREATE TABLE public.guide_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.guide_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.guide_documents(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  file_path TEXT NOT NULL,
  diff_summary TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.project_latest_guide (
  project_id UUID PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  guide_version_id UUID NOT NULL REFERENCES public.guide_versions(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.guide_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guide_version_id UUID NOT NULL REFERENCES public.guide_versions(id),
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id, guide_version_id)
);

-- Forum posts & comments
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status post_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allocation system
CREATE TABLE public.allocation_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  apply_deadline TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.allocation_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.allocation_calls(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES auth.users(id),
  status application_status NOT NULL DEFAULT 'APPLIED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (call_id, worker_id)
);

CREATE TABLE public.allocation_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.allocation_calls(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES auth.users(id),
  data_ref TEXT,
  status assignment_status NOT NULL DEFAULT 'ASSIGNED',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  distributed_done_at TIMESTAMPTZ
);

-- DM system
CREATE TABLE public.dm_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  worker_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, admin_id, worker_id)
);

CREATE TABLE public.dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.dm_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.dm_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.dm_messages(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id),
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  deep_link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email logs
CREATE TABLE public.email_notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  event_type email_event_type NOT NULL,
  related_id UUID,
  status email_status NOT NULL DEFAULT 'QUEUED',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Auto-create boards when project created
CREATE OR REPLACE FUNCTION public.auto_create_boards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.boards (project_id, name, type, order_index) VALUES
    (NEW.id, '공지사항', 'NOTICE', 1),
    (NEW.id, '가이드', 'GUIDE', 2),
    (NEW.id, '질문답변', 'QNA', 3),
    (NEW.id, '배분', 'ALLOCATION', 4),
    (NEW.id, '버그리포트', 'BUG', 5);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_project_created
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_boards();

-- Auto-add creator as project admin
CREATE OR REPLACE FUNCTION public.auto_add_project_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_admins (project_id, admin_id) VALUES (NEW.id, NEW.created_by);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_project_created_add_admin
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_project_admin();

-- Helper: check if user is project admin
CREATE OR REPLACE FUNCTION public.is_project_admin(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_admins
    WHERE admin_id = _user_id AND project_id = _project_id
  )
$$;

-- Helper: check if user is active project member
CREATE OR REPLACE FUNCTION public.is_active_member(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_memberships
    WHERE worker_id = _user_id AND project_id = _project_id AND status = 'ACTIVE'
  )
$$;

-- Helper: check if user has project access (admin or active member)
CREATE OR REPLACE FUNCTION public.has_project_access(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_project_admin(_user_id, _project_id) OR public.is_active_member(_user_id, _project_id)
$$;

-- Indexes
CREATE INDEX idx_project_admins_admin ON public.project_admins(admin_id);
CREATE INDEX idx_project_memberships_worker ON public.project_memberships(worker_id);
CREATE INDEX idx_project_memberships_status ON public.project_memberships(project_id, status);
CREATE INDEX idx_boards_project ON public.boards(project_id);
CREATE INDEX idx_notices_board ON public.notices(board_id);
CREATE INDEX idx_posts_board ON public.posts(board_id);
CREATE INDEX idx_comments_post ON public.comments(post_id);
CREATE INDEX idx_allocation_calls_board ON public.allocation_calls(board_id);
CREATE INDEX idx_allocation_applications_call ON public.allocation_applications(call_id);
CREATE INDEX idx_allocation_assignments_call ON public.allocation_assignments(call_id);
CREATE INDEX idx_dm_threads_project ON public.dm_threads(project_id);
CREATE INDEX idx_dm_messages_thread ON public.dm_messages(thread_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read);
CREATE INDEX idx_invitations_token ON public.project_invitations(token);
CREATE INDEX idx_invitations_email ON public.project_invitations(email);
CREATE INDEX idx_guide_ack_project_user ON public.guide_acknowledgements(project_id, user_id);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('guides', 'guides', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('dm_attachments', 'dm_attachments', false);
