
-- Guide documents: allow admins to update title
CREATE POLICY "Admins can update guides"
ON public.guide_documents
FOR UPDATE TO authenticated
USING (
  (EXISTS (SELECT 1 FROM boards b WHERE b.id = guide_documents.board_id AND is_project_admin(auth.uid(), b.project_id)))
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Guide documents: allow admins to delete
CREATE POLICY "Admins can delete guides"
ON public.guide_documents
FOR DELETE TO authenticated
USING (
  (EXISTS (SELECT 1 FROM boards b WHERE b.id = guide_documents.board_id AND is_project_admin(auth.uid(), b.project_id)))
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Guide versions: allow admins to delete (cascade cleanup)
CREATE POLICY "Admins can delete guide versions"
ON public.guide_versions
FOR DELETE TO authenticated
USING (
  (EXISTS (SELECT 1 FROM guide_documents d JOIN boards b ON b.id = d.board_id WHERE d.id = guide_versions.document_id AND is_project_admin(auth.uid(), b.project_id)))
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Allocation calls: allow admins to delete
CREATE POLICY "Admins can delete allocation calls"
ON public.allocation_calls
FOR DELETE TO authenticated
USING (
  (EXISTS (SELECT 1 FROM boards b WHERE b.id = allocation_calls.board_id AND is_project_admin(auth.uid(), b.project_id)))
  OR has_role(auth.uid(), 'admin'::app_role)
);
