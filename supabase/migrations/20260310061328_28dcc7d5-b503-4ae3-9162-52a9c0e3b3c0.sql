
-- Drop existing UPDATE policy on projects
DROP POLICY IF EXISTS "Project admins can update" ON public.projects;

-- Allow global admins OR project admins to update projects
CREATE POLICY "Project admins can update"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_project_admin(auth.uid(), id)
);
