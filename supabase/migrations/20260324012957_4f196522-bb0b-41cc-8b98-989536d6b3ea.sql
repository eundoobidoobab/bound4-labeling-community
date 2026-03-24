CREATE OR REPLACE FUNCTION public.delete_project_permanently(_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can delete projects';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM projects WHERE id = _project_id) THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  DELETE FROM guide_acknowledgements WHERE project_id = _project_id;
  DELETE FROM project_latest_guide WHERE project_id = _project_id;

  DELETE FROM guide_versions WHERE document_id IN (
    SELECT gd.id FROM guide_documents gd JOIN boards b ON b.id = gd.board_id WHERE b.project_id = _project_id
  );
  DELETE FROM guide_documents WHERE board_id IN (SELECT id FROM boards WHERE project_id = _project_id);

  DELETE FROM notice_attachments WHERE notice_id IN (
    SELECT n.id FROM notices n JOIN boards b ON b.id = n.board_id WHERE b.project_id = _project_id
  );
  DELETE FROM notice_comments WHERE notice_id IN (
    SELECT n.id FROM notices n JOIN boards b ON b.id = n.board_id WHERE b.project_id = _project_id
  );
  DELETE FROM notice_reads WHERE notice_id IN (
    SELECT n.id FROM notices n JOIN boards b ON b.id = n.board_id WHERE b.project_id = _project_id
  );
  DELETE FROM notices WHERE board_id IN (SELECT id FROM boards WHERE project_id = _project_id);

  DELETE FROM post_attachments WHERE post_id IN (
    SELECT p.id FROM posts p JOIN boards b ON b.id = p.board_id WHERE b.project_id = _project_id
  );
  DELETE FROM comments WHERE post_id IN (
    SELECT p.id FROM posts p JOIN boards b ON b.id = p.board_id WHERE b.project_id = _project_id
  );
  DELETE FROM posts WHERE board_id IN (SELECT id FROM boards WHERE project_id = _project_id);

  DELETE FROM allocation_assignments WHERE call_id IN (
    SELECT ac.id FROM allocation_calls ac JOIN boards b ON b.id = ac.board_id WHERE b.project_id = _project_id
  );
  DELETE FROM allocation_applications WHERE call_id IN (
    SELECT ac.id FROM allocation_calls ac JOIN boards b ON b.id = ac.board_id WHERE b.project_id = _project_id
  );
  DELETE FROM allocation_calls WHERE board_id IN (SELECT id FROM boards WHERE project_id = _project_id);

  DELETE FROM boards WHERE project_id = _project_id;

  DELETE FROM dm_attachments WHERE message_id IN (
    SELECT m.id FROM dm_messages m JOIN dm_threads t ON t.id = m.thread_id WHERE t.project_id = _project_id
  );
  DELETE FROM dm_read_cursors WHERE thread_id IN (SELECT id FROM dm_threads WHERE project_id = _project_id);
  DELETE FROM dm_messages WHERE thread_id IN (SELECT id FROM dm_threads WHERE project_id = _project_id);
  DELETE FROM dm_threads WHERE project_id = _project_id;

  DELETE FROM notifications WHERE project_id = _project_id;
  DELETE FROM project_invitations WHERE project_id = _project_id;
  DELETE FROM project_memberships WHERE project_id = _project_id;
  DELETE FROM project_admins WHERE project_id = _project_id;
  DELETE FROM projects WHERE id = _project_id;
END;
$$;