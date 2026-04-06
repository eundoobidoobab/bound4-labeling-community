CREATE OR REPLACE FUNCTION public.validate_application_deadline()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _deadline timestamptz;
  _is_closed boolean;
  _found boolean;
BEGIN
  SELECT apply_deadline, is_closed, true
  INTO _deadline, _is_closed, _found
  FROM public.allocation_calls
  WHERE id = NEW.call_id;

  IF _found IS NULL THEN
    RAISE EXCEPTION 'Allocation call not found';
  END IF;

  IF _is_closed THEN
    RAISE EXCEPTION 'This allocation call is closed';
  END IF;

  IF _deadline IS NOT NULL AND now() > _deadline THEN
    RAISE EXCEPTION 'Application deadline has passed';
  END IF;

  RETURN NEW;
END;
$$;