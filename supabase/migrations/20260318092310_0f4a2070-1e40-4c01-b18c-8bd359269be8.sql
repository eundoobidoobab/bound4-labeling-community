
-- Read cursors for DM threads
CREATE TABLE public.dm_read_cursors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.dm_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(thread_id, user_id)
);

ALTER TABLE public.dm_read_cursors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Thread participants can read cursors"
ON public.dm_read_cursors FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM dm_threads t
  WHERE t.id = dm_read_cursors.thread_id
  AND (t.admin_id = auth.uid() OR t.worker_id = auth.uid())
));

CREATE POLICY "Users can upsert own cursor"
ON public.dm_read_cursors FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND EXISTS (
  SELECT 1 FROM dm_threads t
  WHERE t.id = dm_read_cursors.thread_id
  AND (t.admin_id = auth.uid() OR t.worker_id = auth.uid())
));

CREATE POLICY "Users can update own cursor"
ON public.dm_read_cursors FOR UPDATE TO authenticated
USING (user_id = auth.uid());
