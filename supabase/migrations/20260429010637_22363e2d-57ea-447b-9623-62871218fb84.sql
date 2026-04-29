REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_create_boards() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_add_project_admin() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_application_deadline() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_assign_worker_role() FROM anon, public, authenticated;