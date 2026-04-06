
-- Add DELETE policy for guides bucket: only admins can delete guide files
CREATE POLICY "Admins can delete guide files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'guides'
  AND public.has_role(auth.uid(), 'admin')
);

-- Add UPDATE policy for guides bucket: only admins can update guide files
CREATE POLICY "Admins can update guide files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'guides'
  AND public.has_role(auth.uid(), 'admin')
);
