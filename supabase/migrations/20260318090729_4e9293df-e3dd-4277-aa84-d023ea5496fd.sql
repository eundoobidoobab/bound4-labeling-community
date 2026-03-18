-- Allow authenticated users to insert notifications for project members
-- This is needed so admins can create notifications when distributing allocations
CREATE POLICY "Admins can create notifications for project members"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (
  -- The notification target user_id must be different from inserter (admins notify workers)
  -- And the inserter must be a project admin for the notification's project
  (
    project_id IS NOT NULL 
    AND is_project_admin(auth.uid(), project_id)
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);