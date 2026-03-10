
-- Drop existing SELECT policy on projects
DROP POLICY IF EXISTS "Users can read accessible projects" ON public.projects;

-- Create new SELECT policy: admins (global role) can see ALL projects, others see only accessible ones
CREATE POLICY "Users can read accessible projects"
ON public.projects
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_project_access(auth.uid(), id)
);
