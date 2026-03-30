CREATE OR REPLACE FUNCTION public.change_user_role(_target_user_id uuid, _new_role app_role, _project_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change user roles';
  END IF;

  IF _target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot change your own role';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = _target_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Update global role
  INSERT INTO user_roles (user_id, role)
  VALUES (_target_user_id, _new_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  DELETE FROM user_roles
  WHERE user_id = _target_user_id AND role != _new_role;

  -- Update project-level tables if project_id is provided
  IF _project_id IS NOT NULL THEN
    IF _new_role = 'admin' THEN
      -- Add to project_admins
      INSERT INTO project_admins (project_id, admin_id)
      VALUES (_project_id, _target_user_id)
      ON CONFLICT (project_id, admin_id) DO NOTHING;
      -- Remove from project_memberships
      DELETE FROM project_memberships
      WHERE project_id = _project_id AND worker_id = _target_user_id;
    ELSE
      -- Remove from project_admins
      DELETE FROM project_admins
      WHERE project_id = _project_id AND admin_id = _target_user_id;
      -- Add to project_memberships
      INSERT INTO project_memberships (project_id, worker_id, status)
      VALUES (_project_id, _target_user_id, 'ACTIVE')
      ON CONFLICT (project_id, worker_id) DO UPDATE SET status = 'ACTIVE';
    END IF;
  END IF;
END;
$$;