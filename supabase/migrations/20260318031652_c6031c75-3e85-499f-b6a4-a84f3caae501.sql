BEGIN;

-- Normalize duplicated project creation triggers (exactly one per action)
DROP TRIGGER IF EXISTS on_project_created ON public.projects;
DROP TRIGGER IF EXISTS on_project_created_boards ON public.projects;
CREATE TRIGGER on_project_created
AFTER INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_boards();

DROP TRIGGER IF EXISTS on_project_created_add_admin ON public.projects;
DROP TRIGGER IF EXISTS on_project_created_admin ON public.projects;
CREATE TRIGGER on_project_created_add_admin
AFTER INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.auto_add_project_admin();

-- Make admin trigger idempotent to prevent future duplicate-key failures
CREATE OR REPLACE FUNCTION public.auto_add_project_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_admins (project_id, admin_id)
  VALUES (NEW.id, NEW.created_by)
  ON CONFLICT (project_id, admin_id) DO NOTHING;
  RETURN NEW;
END;
$$;

COMMIT;