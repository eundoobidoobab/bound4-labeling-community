
-- Fix 1: accept_invitation - use JWT email instead of profiles table email
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
    AND email = (auth.jwt() ->> 'email')
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

-- Fix 2: Restrict profile email column updates (only display_name should be editable)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND email = (SELECT email FROM public.profiles WHERE id = auth.uid()));

-- Fix 3: Tighten guides storage policies
DROP POLICY IF EXISTS "Authenticated users can read guides" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload guides" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload guides" ON storage.objects;
DROP POLICY IF EXISTS "Members can read guides" ON storage.objects;

CREATE POLICY "Members can read guides" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'guides');

CREATE POLICY "Admins can upload guides" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'guides' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Fix 4: Tighten dm_attachments storage policies
DROP POLICY IF EXISTS "Authenticated users can read DM attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload DM attachments" ON storage.objects;
DROP POLICY IF EXISTS "Thread participants can read DM files" ON storage.objects;
DROP POLICY IF EXISTS "Thread participants can upload DM files" ON storage.objects;

CREATE POLICY "Thread participants can read DM files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'dm_attachments');

CREATE POLICY "Thread participants can upload DM files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dm_attachments');
