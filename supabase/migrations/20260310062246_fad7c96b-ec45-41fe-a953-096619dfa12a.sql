
-- Policy already exists for upload, just add read policy
CREATE POLICY "Authenticated can read guides"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'guides');
