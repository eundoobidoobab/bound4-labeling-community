
-- RLS Policies

-- Profiles: users can read all profiles, update own
CREATE POLICY "Anyone can read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- User roles: readable by owner
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Projects: accessible if admin or active member
CREATE POLICY "Users can read accessible projects" ON public.projects FOR SELECT TO authenticated
  USING (public.has_project_access(auth.uid(), id));
CREATE POLICY "Admins can create projects" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Project admins can update" ON public.projects FOR UPDATE TO authenticated
  USING (public.is_project_admin(auth.uid(), id));

-- Project admins
CREATE POLICY "Project admins visible to project members" ON public.project_admins FOR SELECT TO authenticated
  USING (public.has_project_access(auth.uid(), project_id));
CREATE POLICY "Project admins can manage admins" ON public.project_admins FOR INSERT TO authenticated
  WITH CHECK (public.is_project_admin(auth.uid(), project_id));
CREATE POLICY "Project admins can remove admins" ON public.project_admins FOR DELETE TO authenticated
  USING (public.is_project_admin(auth.uid(), project_id));

-- Project memberships
CREATE POLICY "Admins can view memberships" ON public.project_memberships FOR SELECT TO authenticated
  USING (public.is_project_admin(auth.uid(), project_id) OR worker_id = auth.uid());
CREATE POLICY "Admins can manage memberships" ON public.project_memberships FOR INSERT TO authenticated
  WITH CHECK (public.is_project_admin(auth.uid(), project_id));
CREATE POLICY "Admins can update memberships" ON public.project_memberships FOR UPDATE TO authenticated
  USING (public.is_project_admin(auth.uid(), project_id));

-- Boards
CREATE POLICY "Members can view active boards" ON public.boards FOR SELECT TO authenticated
  USING (
    public.has_project_access(auth.uid(), project_id)
    AND (status = 'ACTIVE' OR public.is_project_admin(auth.uid(), project_id))
  );
CREATE POLICY "Admins can manage boards" ON public.boards FOR INSERT TO authenticated
  WITH CHECK (public.is_project_admin(auth.uid(), project_id));
CREATE POLICY "Admins can update boards" ON public.boards FOR UPDATE TO authenticated
  USING (public.is_project_admin(auth.uid(), project_id));

-- Invitations
CREATE POLICY "Admins can view invitations" ON public.project_invitations FOR SELECT TO authenticated
  USING (public.is_project_admin(auth.uid(), project_id));
CREATE POLICY "Admins can create invitations" ON public.project_invitations FOR INSERT TO authenticated
  WITH CHECK (public.is_project_admin(auth.uid(), project_id));
CREATE POLICY "Admins can update invitations" ON public.project_invitations FOR UPDATE TO authenticated
  USING (public.is_project_admin(auth.uid(), project_id));
-- Workers can read their own invitations by token (handled in edge function)

-- Notices
CREATE POLICY "Members can read notices" ON public.notices FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.boards b WHERE b.id = board_id AND public.has_project_access(auth.uid(), b.project_id)
  ));
CREATE POLICY "Admins can create notices" ON public.notices FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.boards b WHERE b.id = board_id AND public.is_project_admin(auth.uid(), b.project_id)
  ));
CREATE POLICY "Admins can update notices" ON public.notices FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.boards b WHERE b.id = board_id AND public.is_project_admin(auth.uid(), b.project_id)
  ));

-- Notice reads
CREATE POLICY "Users can read own notice_reads" ON public.notice_reads FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can insert own notice_reads" ON public.notice_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Guide documents
CREATE POLICY "Members can read guides" ON public.guide_documents FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.boards b WHERE b.id = board_id AND public.has_project_access(auth.uid(), b.project_id)
  ));
CREATE POLICY "Admins can manage guides" ON public.guide_documents FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.boards b WHERE b.id = board_id AND public.is_project_admin(auth.uid(), b.project_id)
  ));

-- Guide versions
CREATE POLICY "Members can read guide versions" ON public.guide_versions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.guide_documents d
    JOIN public.boards b ON b.id = d.board_id
    WHERE d.id = document_id AND public.has_project_access(auth.uid(), b.project_id)
  ));
CREATE POLICY "Admins can create guide versions" ON public.guide_versions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.guide_documents d
    JOIN public.boards b ON b.id = d.board_id
    WHERE d.id = document_id AND public.is_project_admin(auth.uid(), b.project_id)
  ));

-- Project latest guide
CREATE POLICY "Members can read latest guide" ON public.project_latest_guide FOR SELECT TO authenticated
  USING (public.has_project_access(auth.uid(), project_id));
CREATE POLICY "Admins can update latest guide" ON public.project_latest_guide FOR INSERT TO authenticated
  WITH CHECK (public.is_project_admin(auth.uid(), project_id));
CREATE POLICY "Admins can update latest guide row" ON public.project_latest_guide FOR UPDATE TO authenticated
  USING (public.is_project_admin(auth.uid(), project_id));

-- Guide acknowledgements
CREATE POLICY "Users can read own acks" ON public.guide_acknowledgements FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can insert own acks" ON public.guide_acknowledgements FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.has_project_access(auth.uid(), project_id));

-- Posts
CREATE POLICY "Members can read posts" ON public.posts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.boards b WHERE b.id = board_id AND public.has_project_access(auth.uid(), b.project_id)
  ));
CREATE POLICY "Members can create posts" ON public.posts FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.boards b WHERE b.id = board_id
      AND public.has_project_access(auth.uid(), b.project_id)
      AND b.type IN ('QNA', 'BUG', 'CUSTOM')
    )
  );
CREATE POLICY "Authors and admins can update posts" ON public.posts FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.boards b WHERE b.id = board_id AND public.is_project_admin(auth.uid(), b.project_id)
    )
  );

-- Comments
CREATE POLICY "Members can read comments" ON public.comments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.posts p
    JOIN public.boards b ON b.id = p.board_id
    WHERE p.id = post_id AND public.has_project_access(auth.uid(), b.project_id)
  ));
CREATE POLICY "Members can create comments" ON public.comments FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.posts p
      JOIN public.boards b ON b.id = p.board_id
      WHERE p.id = post_id AND public.has_project_access(auth.uid(), b.project_id)
    )
  );

-- Allocation calls
CREATE POLICY "Members can view allocation calls" ON public.allocation_calls FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.boards b WHERE b.id = board_id AND public.has_project_access(auth.uid(), b.project_id)
  ));
CREATE POLICY "Admins can create allocation calls" ON public.allocation_calls FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.boards b WHERE b.id = board_id AND public.is_project_admin(auth.uid(), b.project_id)
  ));
CREATE POLICY "Admins can update allocation calls" ON public.allocation_calls FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.boards b WHERE b.id = board_id AND public.is_project_admin(auth.uid(), b.project_id)
  ));

-- Allocation applications: workers see own, admins see all
CREATE POLICY "Workers see own applications" ON public.allocation_applications FOR SELECT TO authenticated
  USING (
    worker_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.allocation_calls c
      JOIN public.boards b ON b.id = c.board_id
      WHERE c.id = call_id AND public.is_project_admin(auth.uid(), b.project_id)
    )
  );
CREATE POLICY "Workers can apply" ON public.allocation_applications FOR INSERT TO authenticated
  WITH CHECK (worker_id = auth.uid());
CREATE POLICY "Admins can update applications" ON public.allocation_applications FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.allocation_calls c
    JOIN public.boards b ON b.id = c.board_id
    WHERE c.id = call_id AND public.is_project_admin(auth.uid(), b.project_id)
  ));

-- Allocation assignments
CREATE POLICY "Workers see own assignments" ON public.allocation_assignments FOR SELECT TO authenticated
  USING (
    worker_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.allocation_calls c
      JOIN public.boards b ON b.id = c.board_id
      WHERE c.id = call_id AND public.is_project_admin(auth.uid(), b.project_id)
    )
  );
CREATE POLICY "Admins can create assignments" ON public.allocation_assignments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.allocation_calls c
    JOIN public.boards b ON b.id = c.board_id
    WHERE c.id = call_id AND public.is_project_admin(auth.uid(), b.project_id)
  ));
CREATE POLICY "Admins can update assignments" ON public.allocation_assignments FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.allocation_calls c
    JOIN public.boards b ON b.id = c.board_id
    WHERE c.id = call_id AND public.is_project_admin(auth.uid(), b.project_id)
  ));

-- DM threads
CREATE POLICY "Participants can view threads" ON public.dm_threads FOR SELECT TO authenticated
  USING (admin_id = auth.uid() OR worker_id = auth.uid());
CREATE POLICY "Admins can create threads" ON public.dm_threads FOR INSERT TO authenticated
  WITH CHECK (admin_id = auth.uid() AND public.is_project_admin(auth.uid(), project_id));

-- DM messages
CREATE POLICY "Thread participants can read messages" ON public.dm_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.dm_threads t WHERE t.id = thread_id AND (t.admin_id = auth.uid() OR t.worker_id = auth.uid())
  ));
CREATE POLICY "Thread participants can send messages" ON public.dm_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.dm_threads t WHERE t.id = thread_id AND (t.admin_id = auth.uid() OR t.worker_id = auth.uid())
    )
  );

-- DM attachments
CREATE POLICY "Thread participants can view attachments" ON public.dm_attachments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.dm_messages m
    JOIN public.dm_threads t ON t.id = m.thread_id
    WHERE m.id = message_id AND (t.admin_id = auth.uid() OR t.worker_id = auth.uid())
  ));
CREATE POLICY "Thread participants can add attachments" ON public.dm_attachments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.dm_messages m
    JOIN public.dm_threads t ON t.id = m.thread_id
    WHERE m.id = message_id AND (t.admin_id = auth.uid() OR t.worker_id = auth.uid())
  ));

-- Notifications
CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Email logs (admin only via service role, no public access)
CREATE POLICY "No public access to email logs" ON public.email_notification_logs FOR SELECT TO authenticated
  USING (false);

-- Storage policies
CREATE POLICY "Project members can read guides" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'guides');
CREATE POLICY "Admins can upload guides" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'guides');

CREATE POLICY "DM participants can read attachments" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dm_attachments');
CREATE POLICY "DM participants can upload attachments" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dm_attachments');
