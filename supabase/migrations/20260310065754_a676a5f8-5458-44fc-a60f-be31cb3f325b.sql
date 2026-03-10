ALTER TABLE public.allocation_applications ADD COLUMN desired_quantity integer DEFAULT NULL;
ALTER TABLE public.allocation_assignments ADD COLUMN assigned_quantity integer DEFAULT NULL;