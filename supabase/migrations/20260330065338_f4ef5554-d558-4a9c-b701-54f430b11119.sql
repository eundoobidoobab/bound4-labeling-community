CREATE OR REPLACE FUNCTION public.change_user_role(_target_user_id uuid, _new_role app_role)
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

  INSERT INTO user_roles (user_id, role)
  VALUES (_target_user_id, _new_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  DELETE FROM user_roles
  WHERE user_id = _target_user_id AND role != _new_role;
END;
$$;