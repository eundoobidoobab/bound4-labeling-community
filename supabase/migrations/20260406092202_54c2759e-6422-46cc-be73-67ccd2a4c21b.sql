
-- Fix 1: Recreate guides storage policies with 'authenticated' role instead of 'public'
DROP POLICY IF EXISTS "Admins can delete guide files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update guide files" ON storage.objects;

CREATE POLICY "Admins can delete guide files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'guides'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update guide files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'guides'
  AND public.has_role(auth.uid(), 'admin')
);

-- Fix 2: Create a secure view for project invitations that excludes the token column
CREATE OR REPLACE VIEW public.project_invitations_safe AS
SELECT id, project_id, email, status, created_at, expires_at
FROM public.project_invitations;

-- Grant access to the view
GRANT SELECT ON public.project_invitations_safe TO authenticated;
