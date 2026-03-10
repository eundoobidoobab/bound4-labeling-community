
-- Re-create triggers that may be missing

-- Trigger: auto-create profile on new auth user
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger: auto-assign role based on email domain
CREATE OR REPLACE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_worker_role();

-- Trigger: auto-create boards when project is created
CREATE OR REPLACE TRIGGER on_project_created_boards
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_boards();

-- Trigger: auto-add project creator as admin
CREATE OR REPLACE TRIGGER on_project_created_admin
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_project_admin();

-- Fix orphaned auth users: restore missing profiles
INSERT INTO public.profiles (id, email, display_name)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1))
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Fix orphaned auth users: restore missing roles
INSERT INTO public.user_roles (user_id, role)
SELECT u.id,
  CASE WHEN u.email LIKE '%@bound4.co.kr' THEN 'admin'::app_role ELSE 'worker'::app_role END
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id
WHERE r.user_id IS NULL;
