
-- 1. Drop existing INSERT policy on dm_threads (admin only)
DROP POLICY IF EXISTS "Admins can create threads" ON public.dm_threads;

-- 2. Create new policy allowing both admins and workers to create threads
CREATE POLICY "Project members can create threads"
ON public.dm_threads
FOR INSERT
TO authenticated
WITH CHECK (
  (
    -- Admin creating thread: admin_id must be self, must be project admin
    (admin_id = auth.uid() AND is_project_admin(auth.uid(), project_id))
    OR
    -- Worker creating thread: worker_id must be self, must be active member, admin_id must be a real project admin
    (worker_id = auth.uid() AND is_active_member(auth.uid(), project_id) AND is_project_admin(admin_id, project_id))
  )
);
