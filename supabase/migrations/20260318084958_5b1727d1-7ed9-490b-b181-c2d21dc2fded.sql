-- Make board_attachments bucket private
UPDATE storage.buckets SET public = false WHERE id = 'board_attachments';

-- Storage RLS: authenticated users can read board attachments
CREATE POLICY "Authenticated users can read board attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'board_attachments');

-- Storage RLS: authenticated users can upload board attachments
CREATE POLICY "Authenticated users can upload board attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'board_attachments');