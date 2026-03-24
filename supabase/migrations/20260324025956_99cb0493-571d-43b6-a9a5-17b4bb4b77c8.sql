
-- Drop the old permissive INSERT policy
DROP POLICY IF EXISTS "Project members can create notifications" ON public.notifications;

-- Create a tighter INSERT policy that verifies the target user_id belongs to the same project
CREATE POLICY "Project members can create notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  (
    project_id IS NOT NULL
    AND has_project_access(auth.uid(), project_id)
    AND (
      EXISTS (
        SELECT 1 FROM project_memberships
        WHERE worker_id = notifications.user_id
          AND project_id = notifications.project_id
          AND status = 'ACTIVE'
      )
      OR EXISTS (
        SELECT 1 FROM project_admins
        WHERE admin_id = notifications.user_id
          AND project_id = notifications.project_id
      )
    )
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);
