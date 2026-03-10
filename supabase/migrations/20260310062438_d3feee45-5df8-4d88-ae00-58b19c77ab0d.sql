
-- guide_documents: allow global admins to insert
DROP POLICY IF EXISTS "Admins can manage guides" ON public.guide_documents;
CREATE POLICY "Admins can manage guides" ON public.guide_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM boards b WHERE b.id = guide_documents.board_id AND is_project_admin(auth.uid(), b.project_id))
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- guide_documents: allow global admins to read
DROP POLICY IF EXISTS "Members can read guides" ON public.guide_documents;
CREATE POLICY "Members can read guides" ON public.guide_documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM boards b WHERE b.id = guide_documents.board_id AND has_project_access(auth.uid(), b.project_id))
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- guide_versions: allow global admins to insert
DROP POLICY IF EXISTS "Admins can create guide versions" ON public.guide_versions;
CREATE POLICY "Admins can create guide versions" ON public.guide_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM guide_documents d JOIN boards b ON b.id = d.board_id WHERE d.id = guide_versions.document_id AND is_project_admin(auth.uid(), b.project_id))
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- guide_versions: allow global admins to read
DROP POLICY IF EXISTS "Members can read guide versions" ON public.guide_versions;
CREATE POLICY "Members can read guide versions" ON public.guide_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM guide_documents d JOIN boards b ON b.id = d.board_id WHERE d.id = guide_versions.document_id AND has_project_access(auth.uid(), b.project_id))
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- project_latest_guide: allow global admins
DROP POLICY IF EXISTS "Admins can update latest guide" ON public.project_latest_guide;
CREATE POLICY "Admins can update latest guide" ON public.project_latest_guide
  FOR INSERT TO authenticated
  WITH CHECK (is_project_admin(auth.uid(), project_id) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update latest guide row" ON public.project_latest_guide;
CREATE POLICY "Admins can update latest guide row" ON public.project_latest_guide
  FOR UPDATE TO authenticated
  USING (is_project_admin(auth.uid(), project_id) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Members can read latest guide" ON public.project_latest_guide;
CREATE POLICY "Members can read latest guide" ON public.project_latest_guide
  FOR SELECT TO authenticated
  USING (has_project_access(auth.uid(), project_id) OR has_role(auth.uid(), 'admin'::app_role));
