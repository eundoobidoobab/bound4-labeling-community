
-- Table to track when a user last visited each board
CREATE TABLE public.board_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  last_visited_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, board_id)
);

ALTER TABLE public.board_visits ENABLE ROW LEVEL SECURITY;

-- Users can read their own visits
CREATE POLICY "Users can read own board visits"
  ON public.board_visits FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can upsert their own visits
CREATE POLICY "Users can upsert own board visits"
  ON public.board_visits FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own board visits"
  ON public.board_visits FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
