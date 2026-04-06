CREATE POLICY "Workers can delete own applied applications"
ON public.allocation_applications FOR DELETE
TO authenticated
USING (worker_id = auth.uid() AND status = 'APPLIED'::application_status);