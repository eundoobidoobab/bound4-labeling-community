
-- Fix boards SELECT policy to allow global admins
DROP POLICY IF EXISTS "Members can view active boards" ON public.boards;

CREATE POLICY "Members can view active boards"
ON public.boards
FOR SELECT
TO authenticated
USING (
  (has_project_access(auth.uid(), project_id) AND ((status = 'ACTIVE'::board_status) OR is_project_admin(auth.uid(), project_id)))
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix boards INSERT policy for global admins
DROP POLICY IF EXISTS "Admins can manage boards" ON public.boards;

CREATE POLICY "Admins can manage boards"
ON public.boards
FOR INSERT
TO authenticated
WITH CHECK (
  is_project_admin(auth.uid(), project_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix boards UPDATE policy for global admins
DROP POLICY IF EXISTS "Admins can update boards" ON public.boards;

CREATE POLICY "Admins can update boards"
ON public.boards
FOR UPDATE
TO authenticated
USING (
  is_project_admin(auth.uid(), project_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix project_admins SELECT policy for global admins
DROP POLICY IF EXISTS "Project admins visible to project members" ON public.project_admins;

CREATE POLICY "Project admins visible to project members"
ON public.project_admins
FOR SELECT
TO authenticated
USING (
  has_project_access(auth.uid(), project_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix project_admins INSERT policy for global admins
DROP POLICY IF EXISTS "Project admins can manage admins" ON public.project_admins;

CREATE POLICY "Project admins can manage admins"
ON public.project_admins
FOR INSERT
TO authenticated
WITH CHECK (
  is_project_admin(auth.uid(), project_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix project_admins DELETE policy for global admins
DROP POLICY IF EXISTS "Project admins can remove admins" ON public.project_admins;

CREATE POLICY "Project admins can remove admins"
ON public.project_admins
FOR DELETE
TO authenticated
USING (
  is_project_admin(auth.uid(), project_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix project_memberships SELECT policy for global admins
DROP POLICY IF EXISTS "Admins can view memberships" ON public.project_memberships;

CREATE POLICY "Admins can view memberships"
ON public.project_memberships
FOR SELECT
TO authenticated
USING (
  is_project_admin(auth.uid(), project_id)
  OR (worker_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix project_memberships INSERT policy for global admins
DROP POLICY IF EXISTS "Admins can manage memberships" ON public.project_memberships;

CREATE POLICY "Admins can manage memberships"
ON public.project_memberships
FOR INSERT
TO authenticated
WITH CHECK (
  is_project_admin(auth.uid(), project_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix project_memberships UPDATE policy for global admins
DROP POLICY IF EXISTS "Admins can update memberships" ON public.project_memberships;

CREATE POLICY "Admins can update memberships"
ON public.project_memberships
FOR UPDATE
TO authenticated
USING (
  is_project_admin(auth.uid(), project_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix notices SELECT for global admins
DROP POLICY IF EXISTS "Members can read notices" ON public.notices;

CREATE POLICY "Members can read notices"
ON public.notices
FOR SELECT
TO authenticated
USING (
  (EXISTS ( SELECT 1 FROM boards b WHERE b.id = notices.board_id AND has_project_access(auth.uid(), b.project_id)))
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix notices INSERT for global admins
DROP POLICY IF EXISTS "Admins can create notices" ON public.notices;

CREATE POLICY "Admins can create notices"
ON public.notices
FOR INSERT
TO authenticated
WITH CHECK (
  (EXISTS ( SELECT 1 FROM boards b WHERE b.id = notices.board_id AND is_project_admin(auth.uid(), b.project_id)))
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix notices UPDATE for global admins
DROP POLICY IF EXISTS "Admins can update notices" ON public.notices;

CREATE POLICY "Admins can update notices"
ON public.notices
FOR UPDATE
TO authenticated
USING (
  (EXISTS ( SELECT 1 FROM boards b WHERE b.id = notices.board_id AND is_project_admin(auth.uid(), b.project_id)))
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix posts SELECT for global admins
DROP POLICY IF EXISTS "Members can read posts" ON public.posts;

CREATE POLICY "Members can read posts"
ON public.posts
FOR SELECT
TO authenticated
USING (
  (EXISTS ( SELECT 1 FROM boards b WHERE b.id = posts.board_id AND has_project_access(auth.uid(), b.project_id)))
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix project_invitations SELECT for global admins
DROP POLICY IF EXISTS "Admins can view invitations" ON public.project_invitations;

CREATE POLICY "Admins can view invitations"
ON public.project_invitations
FOR SELECT
TO authenticated
USING (
  is_project_admin(auth.uid(), project_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (email = ( SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid()))
);

-- Fix project_invitations INSERT for global admins  
DROP POLICY IF EXISTS "Admins can create invitations" ON public.project_invitations;

CREATE POLICY "Admins can create invitations"
ON public.project_invitations
FOR INSERT
TO authenticated
WITH CHECK (
  is_project_admin(auth.uid(), project_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix project_invitations UPDATE for global admins
DROP POLICY IF EXISTS "Admins can update invitations" ON public.project_invitations;

CREATE POLICY "Admins can update invitations"
ON public.project_invitations
FOR UPDATE
TO authenticated
USING (
  is_project_admin(auth.uid(), project_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (email = ( SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid()))
);

-- Drop the duplicate user-level invitation view policy (now merged above)
DROP POLICY IF EXISTS "Users can view invitations for their email" ON public.project_invitations;
DROP POLICY IF EXISTS "Users can accept their invitations" ON public.project_invitations;
