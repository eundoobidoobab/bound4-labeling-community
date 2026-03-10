
DROP POLICY IF EXISTS "Users can insert own acks" ON public.guide_acknowledgements;
CREATE POLICY "Users can insert own acks" ON public.guide_acknowledgements
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid()) AND (has_project_access(auth.uid(), project_id) OR has_role(auth.uid(), 'admin'::app_role))
  );

DROP POLICY IF EXISTS "Users can read own acks" ON public.guide_acknowledgements;
CREATE POLICY "Users can read own acks" ON public.guide_acknowledgements
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
