
-- Fix the security definer view issue by explicitly setting SECURITY INVOKER
ALTER VIEW public.project_invitations_safe SET (security_invoker = on);
