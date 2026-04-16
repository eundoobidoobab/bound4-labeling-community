-- Fix guide storage DELETE and UPDATE policies: correct the join condition
-- The previous policies incorrectly compared gv.file_path to b.name instead of objects.name

DROP POLICY IF EXISTS "Admins can delete guide files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update guide files" ON storage.objects;

CREATE POLICY "Admins can delete guide files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'guides'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM guide_versions gv
      JOIN guide_documents gd ON gd.id = gv.document_id
      JOIN boards b ON b.id = gd.board_id
      WHERE gv.file_path = storage.objects.name
      AND is_project_admin(auth.uid(), b.project_id)
    )
  )
);

CREATE POLICY "Admins can update guide files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'guides'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM guide_versions gv
      JOIN guide_documents gd ON gd.id = gv.document_id
      JOIN boards b ON b.id = gd.board_id
      WHERE gv.file_path = storage.objects.name
      AND is_project_admin(auth.uid(), b.project_id)
    )
  )
);