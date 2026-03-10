
-- allocation_calls: add global admin access
DROP POLICY IF EXISTS "Admins can create allocation calls" ON public.allocation_calls;
CREATE POLICY "Admins can create allocation calls" ON public.allocation_calls
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM boards b WHERE b.id = allocation_calls.board_id AND is_project_admin(auth.uid(), b.project_id))
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Admins can update allocation calls" ON public.allocation_calls;
CREATE POLICY "Admins can update allocation calls" ON public.allocation_calls
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM boards b WHERE b.id = allocation_calls.board_id AND is_project_admin(auth.uid(), b.project_id))
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Members can view allocation calls" ON public.allocation_calls;
CREATE POLICY "Members can view allocation calls" ON public.allocation_calls
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM boards b WHERE b.id = allocation_calls.board_id AND has_project_access(auth.uid(), b.project_id))
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- allocation_applications: add global admin access
DROP POLICY IF EXISTS "Admins can update applications" ON public.allocation_applications;
CREATE POLICY "Admins can update applications" ON public.allocation_applications
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM allocation_calls c JOIN boards b ON b.id = c.board_id WHERE c.id = allocation_applications.call_id AND is_project_admin(auth.uid(), b.project_id))
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Workers see own applications" ON public.allocation_applications;
CREATE POLICY "Workers see own applications" ON public.allocation_applications
  FOR SELECT TO authenticated
  USING (
    worker_id = auth.uid()
    OR EXISTS (SELECT 1 FROM allocation_calls c JOIN boards b ON b.id = c.board_id WHERE c.id = allocation_applications.call_id AND is_project_admin(auth.uid(), b.project_id))
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- allocation_assignments: add global admin access
DROP POLICY IF EXISTS "Admins can create assignments" ON public.allocation_assignments;
CREATE POLICY "Admins can create assignments" ON public.allocation_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM allocation_calls c JOIN boards b ON b.id = c.board_id WHERE c.id = allocation_assignments.call_id AND is_project_admin(auth.uid(), b.project_id))
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Admins can update assignments" ON public.allocation_assignments;
CREATE POLICY "Admins can update assignments" ON public.allocation_assignments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM allocation_calls c JOIN boards b ON b.id = c.board_id WHERE c.id = allocation_assignments.call_id AND is_project_admin(auth.uid(), b.project_id))
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Workers see own assignments" ON public.allocation_assignments;
CREATE POLICY "Workers see own assignments" ON public.allocation_assignments
  FOR SELECT TO authenticated
  USING (
    worker_id = auth.uid()
    OR EXISTS (SELECT 1 FROM allocation_calls c JOIN boards b ON b.id = c.board_id WHERE c.id = allocation_assignments.call_id AND is_project_admin(auth.uid(), b.project_id))
    OR has_role(auth.uid(), 'admin'::app_role)
  );
