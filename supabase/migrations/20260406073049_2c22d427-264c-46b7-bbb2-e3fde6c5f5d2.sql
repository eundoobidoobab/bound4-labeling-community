
CREATE TABLE public.guide_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_version_id uuid NOT NULL REFERENCES public.guide_versions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  downloaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guide_version_id, user_id)
);

ALTER TABLE public.guide_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own downloads"
ON public.guide_downloads FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (has_project_access(auth.uid(), project_id) OR has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Users and admins can read downloads"
ON public.guide_downloads FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR is_project_admin(auth.uid(), project_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);
