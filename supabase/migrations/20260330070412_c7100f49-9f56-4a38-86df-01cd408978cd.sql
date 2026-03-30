CREATE OR REPLACE FUNCTION public.get_invitation_project_names(_project_ids uuid[])
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id, p.name
  FROM projects p
  WHERE p.id = ANY(_project_ids)
    AND EXISTS (
      SELECT 1 FROM project_invitations pi
      WHERE pi.project_id = p.id
        AND pi.email = (auth.jwt() ->> 'email')
        AND pi.status = 'PENDING'
        AND pi.expires_at > now()
    )
$$;