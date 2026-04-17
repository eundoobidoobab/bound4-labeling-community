
-- Fix broken DELETE policy on board_attachments storage bucket
-- The previous policy compared pa.file_path = b.name (file path vs board name) which never matches.
-- Replace with correct comparison: pa.file_path = objects.name (matches DM attachments pattern).

DROP POLICY IF EXISTS "Authors and admins can delete board attachments" ON storage.objects;

CREATE POLICY "Authors and admins can delete board attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'board_attachments'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM post_attachments pa
      JOIN posts p ON p.id = pa.post_id
      JOIN boards b ON b.id = p.board_id
      WHERE pa.file_path = objects.name
        AND (p.author_id = auth.uid() OR is_project_admin(auth.uid(), b.project_id))
    )
    OR EXISTS (
      SELECT 1
      FROM notice_attachments na
      JOIN notices n ON n.id = na.notice_id
      JOIN boards b ON b.id = n.board_id
      WHERE na.file_path = objects.name
        AND is_project_admin(auth.uid(), b.project_id)
    )
  )
);

-- Add restrictive UPDATE policy: only project admins can update board attachment files in their project's folder
CREATE POLICY "Project admins can update board attachments"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'board_attachments'
  AND POSITION('/' IN name) > 0
  AND is_project_admin(auth.uid(), (split_part(name, '/', 1))::uuid)
)
WITH CHECK (
  bucket_id = 'board_attachments'
  AND POSITION('/' IN name) > 0
  AND is_project_admin(auth.uid(), (split_part(name, '/', 1))::uuid)
);
