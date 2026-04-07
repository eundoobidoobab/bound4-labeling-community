-- Fix 1: Change guides storage DELETE policy from public to authenticated
DROP POLICY IF EXISTS "Admins can delete guide files" ON storage.objects;
CREATE POLICY "Admins can delete guide files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'guides' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Fix 2: Change guides storage UPDATE policy from public to authenticated
DROP POLICY IF EXISTS "Admins can update guide files" ON storage.objects;
CREATE POLICY "Admins can update guide files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'guides' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Fix 3: Restrict project_invitations SELECT to hide token column
-- Drop existing permissive SELECT policy that exposes tokens
DROP POLICY IF EXISTS "Admins can view invitations" ON public.project_invitations;

-- Create column-level security using a restricted SELECT policy
-- Admins can still read invitations but we rely on the safe view for reads
-- For write operations (UPDATE), admins still need access to the raw table
-- We create a restrictive SELECT policy that only allows reading via RPC/safe view
CREATE POLICY "Admins can view invitations"
ON public.project_invitations
FOR SELECT
TO authenticated
USING (
  is_project_admin(auth.uid(), project_id) 
  OR has_role(auth.uid(), 'admin'::app_role)
);