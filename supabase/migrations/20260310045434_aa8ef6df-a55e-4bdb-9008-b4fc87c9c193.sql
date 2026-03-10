
-- Allow workers to see invitations sent to their email
CREATE POLICY "Users can view invitations for their email"
ON public.project_invitations FOR SELECT
TO authenticated
USING (
  email = (SELECT email FROM public.profiles WHERE id = auth.uid())
);

-- Allow workers to update (accept/decline) invitations sent to their email
CREATE POLICY "Users can accept their invitations"
ON public.project_invitations FOR UPDATE
TO authenticated
USING (
  email = (SELECT email FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
  email = (SELECT email FROM public.profiles WHERE id = auth.uid())
);

-- Function to accept an invitation
CREATE OR REPLACE FUNCTION public.accept_invitation(_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv record;
BEGIN
  SELECT * INTO _inv FROM public.project_invitations
  WHERE id = _invitation_id
    AND email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    AND status = 'PENDING'
    AND expires_at > now();

  IF _inv IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;

  -- Update invitation status
  UPDATE public.project_invitations SET status = 'ACCEPTED' WHERE id = _invitation_id;

  -- Create membership if not exists
  INSERT INTO public.project_memberships (project_id, worker_id, status)
  VALUES (_inv.project_id, auth.uid(), 'ACTIVE')
  ON CONFLICT DO NOTHING;
END;
$$;
