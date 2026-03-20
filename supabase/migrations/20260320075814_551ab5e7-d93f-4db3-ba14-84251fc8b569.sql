
-- 1. Create SECURITY DEFINER function to check profile read access
CREATE OR REPLACE FUNCTION public.can_read_profile(_reader_id uuid, _profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _reader_id = _profile_id
    OR has_role(_reader_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM project_memberships pm1
      JOIN project_memberships pm2 ON pm1.project_id = pm2.project_id
      WHERE pm1.worker_id = _reader_id AND pm2.worker_id = _profile_id
      AND pm1.status = 'ACTIVE' AND pm2.status = 'ACTIVE'
    )
    OR EXISTS (
      SELECT 1 FROM project_admins pa
      JOIN project_memberships pm ON pa.project_id = pm.project_id
      WHERE pa.admin_id = _reader_id AND pm.worker_id = _profile_id AND pm.status = 'ACTIVE'
    )
    OR EXISTS (
      SELECT 1 FROM project_memberships pm
      JOIN project_admins pa ON pm.project_id = pa.project_id
      WHERE pm.worker_id = _reader_id AND pa.admin_id = _profile_id AND pm.status = 'ACTIVE'
    )
    OR EXISTS (
      SELECT 1 FROM project_admins pa1
      JOIN project_admins pa2 ON pa1.project_id = pa2.project_id
      WHERE pa1.admin_id = _reader_id AND pa2.admin_id = _profile_id
    )
$$;

-- 2. Drop old open policy and create restricted one
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;

CREATE POLICY "Users can read shared profiles" ON public.profiles
FOR SELECT TO authenticated
USING (public.can_read_profile(auth.uid(), id));

-- 3. Create admin-only search RPC for member invitation
CREATE OR REPLACE FUNCTION public.search_profiles_for_invite(_query text, _limit int DEFAULT 20)
RETURNS TABLE(id uuid, display_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.email
  FROM profiles p
  WHERE has_role(auth.uid(), 'admin')
    AND (p.email ILIKE '%' || _query || '%' OR p.display_name ILIKE '%' || _query || '%')
  LIMIT _limit
$$;

-- 4. Tighten DM attachments storage policies (thread participation check)
DROP POLICY IF EXISTS "DM participants can read attachments" ON storage.objects;
DROP POLICY IF EXISTS "DM participants can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Thread participants can read DM files" ON storage.objects;
DROP POLICY IF EXISTS "Thread participants can upload DM files" ON storage.objects;

CREATE POLICY "DM thread participants can read files" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'dm_attachments'
  AND EXISTS (
    SELECT 1 FROM public.dm_threads t
    WHERE t.id = (split_part(name, '/', 1))::uuid
    AND (t.admin_id = auth.uid() OR t.worker_id = auth.uid())
  )
);

CREATE POLICY "DM thread participants can upload files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'dm_attachments'
  AND EXISTS (
    SELECT 1 FROM public.dm_threads t
    WHERE t.id = (split_part(name, '/', 1))::uuid
    AND (t.admin_id = auth.uid() OR t.worker_id = auth.uid())
  )
);

-- 5. Tighten board_attachments storage policies
DROP POLICY IF EXISTS "Authenticated users can read" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read board attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload board attachments" ON storage.objects;

CREATE POLICY "Project members can read board attachments" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'board_attachments'
  AND (
    -- New format: {project_id}/{uuid}.{ext}
    (position('/' in name) > 0 AND public.has_project_access(auth.uid(), (split_part(name, '/', 1))::uuid))
    -- Legacy format: {uuid}.{ext} (no slash) - allow read for backward compat
    OR position('/' in name) = 0
  )
);

CREATE POLICY "Project members can upload board attachments" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'board_attachments'
  AND position('/' in name) > 0
  AND public.has_project_access(auth.uid(), (split_part(name, '/', 1))::uuid)
);

-- 6. Tighten guides storage policies
DROP POLICY IF EXISTS "Authenticated can read guides" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload guides" ON storage.objects;
DROP POLICY IF EXISTS "Members can read guides" ON storage.objects;
DROP POLICY IF EXISTS "Project members can read guides" ON storage.objects;

CREATE POLICY "Project members can read guides" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'guides'
  AND (
    -- New format: {project_id}/{uuid}.{ext}
    (position('/' in name) > 0 AND public.has_project_access(auth.uid(), (split_part(name, '/', 1))::uuid))
    -- Legacy format: {uuid}.{ext} - allow read for backward compat
    OR position('/' in name) = 0
  )
);

CREATE POLICY "Admins can upload guides" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'guides'
  AND position('/' in name) > 0
  AND public.has_role(auth.uid(), 'admin')
  AND public.has_project_access(auth.uid(), (split_part(name, '/', 1))::uuid)
);
