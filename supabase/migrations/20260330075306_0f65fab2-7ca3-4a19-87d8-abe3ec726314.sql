
-- Validation trigger: block applications after the call's apply_deadline
CREATE OR REPLACE FUNCTION public.validate_application_deadline()
  RETURNS trigger
  LANGUAGE plpgsql
  STABLE SECURITY DEFINER
  SET search_path = 'public'
AS $$
DECLARE
  _deadline timestamptz;
BEGIN
  SELECT apply_deadline INTO _deadline
  FROM public.allocation_calls
  WHERE id = NEW.call_id;

  IF _deadline IS NULL THEN
    RAISE EXCEPTION 'Allocation call not found';
  END IF;

  IF now() > _deadline THEN
    RAISE EXCEPTION 'Application deadline has passed';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER check_application_deadline
  BEFORE INSERT ON public.allocation_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_application_deadline();
