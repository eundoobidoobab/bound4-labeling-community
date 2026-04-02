
-- Fix 1: Block DELETE and UPDATE on email_notification_logs
CREATE POLICY "No public delete on email logs"
  ON public.email_notification_logs
  FOR DELETE
  TO authenticated
  USING (false);

CREATE POLICY "No public update on email logs"
  ON public.email_notification_logs
  FOR UPDATE
  TO authenticated
  USING (false);

-- Fix 2: Replace guide_acknowledgements SELECT policy to include project admins
DROP POLICY IF EXISTS "Users can read own acks" ON public.guide_acknowledgements;

CREATE POLICY "Users and project admins can read acks"
  ON public.guide_acknowledgements
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_project_admin(auth.uid(), project_id)
    OR has_role(auth.uid(), 'admin'::app_role)
  );
