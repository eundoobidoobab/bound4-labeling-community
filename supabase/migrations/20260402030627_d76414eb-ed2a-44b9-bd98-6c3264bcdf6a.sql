
-- Drop the existing overly permissive UPDATE policy
DROP POLICY IF EXISTS "Admins can update invitations" ON public.project_invitations;

-- Recreate with admin-only access (accept_invitation RPC uses SECURITY DEFINER, so invited users don't need UPDATE)
CREATE POLICY "Admins can update invitations"
  ON public.project_invitations
  FOR UPDATE
  TO authenticated
  USING (
    is_project_admin(auth.uid(), project_id)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    is_project_admin(auth.uid(), project_id)
    OR has_role(auth.uid(), 'admin'::app_role)
  );
