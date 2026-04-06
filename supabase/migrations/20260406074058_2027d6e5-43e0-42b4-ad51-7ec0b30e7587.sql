
DROP POLICY "Users can read own notice_reads" ON public.notice_reads;

CREATE POLICY "Users and admins can read notice_reads"
ON public.notice_reads FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM notices n
    JOIN boards b ON b.id = n.board_id
    WHERE n.id = notice_reads.notice_id
    AND is_project_admin(auth.uid(), b.project_id)
  )
);
