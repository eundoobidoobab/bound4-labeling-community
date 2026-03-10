CREATE OR REPLACE FUNCTION public.accept_invitation(_invitation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

  UPDATE public.project_invitations SET status = 'ACCEPTED' WHERE id = _invitation_id;

  INSERT INTO public.project_memberships (project_id, worker_id, status)
  VALUES (_inv.project_id, auth.uid(), 'ACTIVE')
  ON CONFLICT (project_id, worker_id) DO UPDATE SET status = 'ACTIVE';
END;
$$;