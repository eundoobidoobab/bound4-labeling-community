ALTER TABLE public.posts
  ADD COLUMN data_no text,
  ADD COLUMN capture_image_path text,
  ADD COLUMN worker_ref text;