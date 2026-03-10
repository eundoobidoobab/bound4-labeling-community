CREATE POLICY "Admins can update own project_admins"
ON public.project_admins
FOR UPDATE
TO authenticated
USING (admin_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (admin_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));