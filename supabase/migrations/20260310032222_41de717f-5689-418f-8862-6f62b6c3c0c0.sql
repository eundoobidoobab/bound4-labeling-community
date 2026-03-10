
-- Notice comments table (posts already have comments table)
CREATE TABLE public.notice_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notice_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read notice comments" ON public.notice_comments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM notices n JOIN boards b ON b.id = n.board_id
    WHERE n.id = notice_comments.notice_id AND has_project_access(auth.uid(), b.project_id)
  ));

CREATE POLICY "Members can create notice comments" ON public.notice_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM notices n JOIN boards b ON b.id = n.board_id
      WHERE n.id = notice_comments.notice_id AND has_project_access(auth.uid(), b.project_id)
    )
  );
