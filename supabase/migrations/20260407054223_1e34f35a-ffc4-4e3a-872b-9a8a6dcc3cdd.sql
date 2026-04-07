-- Add DELETE policy for project_invitations so admins can revoke/delete invitations
CREATE POLICY "Admins can delete invitations"
ON public.project_invitations
FOR DELETE
TO authenticated
USING (is_project_admin(auth.uid(), project_id) OR has_role(auth.uid(), 'admin'::app_role));