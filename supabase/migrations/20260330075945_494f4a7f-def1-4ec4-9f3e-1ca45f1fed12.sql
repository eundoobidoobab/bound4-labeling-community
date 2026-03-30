
-- 1. Fix allocation_applications INSERT policy: add project membership check
DROP POLICY IF EXISTS "Workers can apply" ON public.allocation_applications;

CREATE POLICY "Workers can apply" ON public.allocation_applications
  FOR INSERT TO authenticated
  WITH CHECK (
    worker_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM allocation_calls c
      JOIN boards b ON b.id = c.board_id
      WHERE c.id = allocation_applications.call_id
        AND has_project_access(auth.uid(), b.project_id)
    )
  );

-- 2. Fix storage: remove root-level bypass from board_attachments SELECT
DROP POLICY IF EXISTS "Project members can read board attachments" ON storage.objects;

CREATE POLICY "Project members can read board attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'board_attachments'
    AND POSITION('/' IN name) > 0
    AND has_project_access(auth.uid(), split_part(name, '/', 1)::uuid)
  );

-- 3. Fix storage: remove root-level bypass from guides SELECT
DROP POLICY IF EXISTS "Project members can read guides" ON storage.objects;

CREATE POLICY "Project members can read guides" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'guides'
    AND POSITION('/' IN name) > 0
    AND has_project_access(auth.uid(), split_part(name, '/', 1)::uuid)
  );
