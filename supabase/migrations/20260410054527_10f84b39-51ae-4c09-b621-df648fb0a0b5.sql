-- 1. Fix guides bucket: allow project admins to delete/update guide files
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
      WHERE gv.file_path = name
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
      WHERE gv.file_path = name
      AND is_project_admin(auth.uid(), b.project_id)
    )
  )
);

-- 2. Board attachments: add DELETE policy
CREATE POLICY "Authors and admins can delete board attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'board_attachments'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM post_attachments pa
      JOIN posts p ON p.id = pa.post_id
      JOIN boards b ON b.id = p.board_id
      WHERE pa.file_path = name
      AND (p.author_id = auth.uid() OR is_project_admin(auth.uid(), b.project_id))
    )
    OR EXISTS (
      SELECT 1 FROM notice_attachments na
      JOIN notices n ON n.id = na.notice_id
      JOIN boards b ON b.id = n.board_id
      WHERE na.file_path = name
      AND is_project_admin(auth.uid(), b.project_id)
    )
  )
);

-- 3. DM attachments: add DELETE policy
CREATE POLICY "Thread participants can delete dm attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'dm_attachments'
  AND EXISTS (
    SELECT 1 FROM dm_attachments da
    JOIN dm_messages m ON m.id = da.message_id
    JOIN dm_threads t ON t.id = m.thread_id
    WHERE da.file_path = name
    AND m.sender_id = auth.uid()
  )
);