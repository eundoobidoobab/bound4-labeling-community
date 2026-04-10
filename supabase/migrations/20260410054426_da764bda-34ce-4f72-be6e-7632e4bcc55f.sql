-- Fix guide storage policies: change target role from public to authenticated
DROP POLICY IF EXISTS "Admins can delete guide files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update guide files" ON storage.objects;

CREATE POLICY "Admins can delete guide files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'guides'
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update guide files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'guides'
  AND has_role(auth.uid(), 'admin'::app_role)
);