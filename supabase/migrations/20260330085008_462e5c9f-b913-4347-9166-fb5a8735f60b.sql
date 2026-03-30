-- Fix posts UPDATE policy: add WITH CHECK to prevent cross-project injection
DROP POLICY IF EXISTS "Authors and admins can update posts" ON public.posts;

CREATE POLICY "Authors and admins can update posts" ON public.posts
  FOR UPDATE TO authenticated
  USING (
    (author_id = auth.uid())
    OR (EXISTS (
      SELECT 1 FROM boards b
      WHERE b.id = posts.board_id AND is_project_admin(auth.uid(), b.project_id)
    ))
  )
  WITH CHECK (
    (
      author_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM boards b
        WHERE b.id = posts.board_id
          AND has_project_access(auth.uid(), b.project_id)
          AND b.type = ANY (ARRAY['QNA'::board_type, 'BUG'::board_type, 'CUSTOM'::board_type])
      )
    )
    OR (EXISTS (
      SELECT 1 FROM boards b
      WHERE b.id = posts.board_id AND is_project_admin(auth.uid(), b.project_id)
    ))
  );