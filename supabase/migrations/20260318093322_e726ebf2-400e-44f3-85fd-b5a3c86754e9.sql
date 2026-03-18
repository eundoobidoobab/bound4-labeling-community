
-- Allow authors to delete their own posts
CREATE POLICY "Authors can delete posts"
ON public.posts FOR DELETE TO authenticated
USING (author_id = auth.uid() OR EXISTS (
  SELECT 1 FROM boards b WHERE b.id = posts.board_id AND is_project_admin(auth.uid(), b.project_id)
));

-- Allow authors to delete their own comments
CREATE POLICY "Authors can delete comments"
ON public.comments FOR DELETE TO authenticated
USING (author_id = auth.uid() OR EXISTS (
  SELECT 1 FROM posts p JOIN boards b ON b.id = p.board_id WHERE p.id = comments.post_id AND is_project_admin(auth.uid(), b.project_id)
));

-- Allow admins to delete notices
CREATE POLICY "Admins can delete notices"
ON public.notices FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM boards b WHERE b.id = notices.board_id AND is_project_admin(auth.uid(), b.project_id)
) OR has_role(auth.uid(), 'admin'::app_role));

-- Allow authors to delete notice comments
CREATE POLICY "Authors can delete notice comments"
ON public.notice_comments FOR DELETE TO authenticated
USING (author_id = auth.uid() OR EXISTS (
  SELECT 1 FROM notices n JOIN boards b ON b.id = n.board_id WHERE n.id = notice_comments.notice_id AND is_project_admin(auth.uid(), b.project_id)
));
