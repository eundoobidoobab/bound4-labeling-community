
-- Fix 1: Block authenticated users from inserting into email_notification_logs
CREATE POLICY "No public insert on email logs"
ON public.email_notification_logs
FOR INSERT TO authenticated
WITH CHECK (false);

-- Fix 2: Create a secure RPC for workers to fetch their pending invitations without exposing the token
CREATE OR REPLACE FUNCTION public.get_my_pending_invitations()
RETURNS TABLE(id uuid, project_id uuid, email text, status text, created_at timestamptz, expires_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT pi.id, pi.project_id, pi.email, pi.status::text, pi.created_at, pi.expires_at
  FROM project_invitations pi
  WHERE pi.email = (auth.jwt() ->> 'email')
    AND pi.status = 'PENDING'
    AND pi.expires_at > now()
$$;

-- Fix 3: Remove the email-match path from the SELECT policy so invitees can't directly read invitation rows (including token)
DROP POLICY IF EXISTS "Admins can view invitations" ON public.project_invitations;
CREATE POLICY "Admins can view invitations"
ON public.project_invitations
FOR SELECT TO authenticated
USING (
  is_project_admin(auth.uid(), project_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);
