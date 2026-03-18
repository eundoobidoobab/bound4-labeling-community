-- Drop the existing insert policy and create a broader one
DROP POLICY "Admins can create notifications for project members" ON public.notifications;

-- Allow any project member (admin or worker) to create notifications for that project
CREATE POLICY "Project members can create notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (
  (
    project_id IS NOT NULL 
    AND has_project_access(auth.uid(), project_id)
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);