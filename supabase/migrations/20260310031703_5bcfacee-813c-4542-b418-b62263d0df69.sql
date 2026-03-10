
-- Storage bucket for board attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('board_attachments', 'board_attachments', true);

-- Post attachments table
CREATE TABLE public.post_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Notice attachments table
CREATE TABLE public.notice_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for post_attachments
ALTER TABLE public.post_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read post attachments" ON public.post_attachments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM posts p JOIN boards b ON b.id = p.board_id
    WHERE p.id = post_attachments.post_id AND has_project_access(auth.uid(), b.project_id)
  ));

CREATE POLICY "Members can create post attachments" ON public.post_attachments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM posts p JOIN boards b ON b.id = p.board_id
    WHERE p.id = post_attachments.post_id AND has_project_access(auth.uid(), b.project_id)
  ));

-- RLS for notice_attachments
ALTER TABLE public.notice_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read notice attachments" ON public.notice_attachments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM notices n JOIN boards b ON b.id = n.board_id
    WHERE n.id = notice_attachments.notice_id AND has_project_access(auth.uid(), b.project_id)
  ));

CREATE POLICY "Admins can create notice attachments" ON public.notice_attachments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM notices n JOIN boards b ON b.id = n.board_id
    WHERE n.id = notice_attachments.notice_id AND is_project_admin(auth.uid(), b.project_id)
  ));

-- Storage RLS policies for board_attachments bucket
CREATE POLICY "Authenticated users can upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'board_attachments');

CREATE POLICY "Authenticated users can read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'board_attachments');
