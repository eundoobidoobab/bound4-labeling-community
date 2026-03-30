
-- Create a security definer function for sending notifications
-- This validates that the caller has project access and targets are project members
CREATE OR REPLACE FUNCTION public.send_project_notifications(
  _user_ids uuid[],
  _type notification_type,
  _title text,
  _body text DEFAULT NULL,
  _project_id uuid DEFAULT NULL,
  _deep_link text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Caller must have project access
  IF _project_id IS NOT NULL AND NOT has_project_access(auth.uid(), _project_id) THEN
    RAISE EXCEPTION 'No access to this project';
  END IF;

  -- Only insert notifications for users who are actually members of the project
  INSERT INTO public.notifications (user_id, type, title, body, project_id, deep_link)
  SELECT unnest, _type, _title, _body, _project_id, _deep_link
  FROM unnest(_user_ids)
  WHERE _project_id IS NULL
     OR EXISTS (
       SELECT 1 FROM project_memberships pm
       WHERE pm.worker_id = unnest AND pm.project_id = _project_id AND pm.status = 'ACTIVE'
     )
     OR EXISTS (
       SELECT 1 FROM project_admins pa
       WHERE pa.admin_id = unnest AND pa.project_id = _project_id
     );
END;
$$;

-- Drop the permissive INSERT policy that allows any member to insert notifications
DROP POLICY IF EXISTS "Project members can create notifications" ON public.notifications;
