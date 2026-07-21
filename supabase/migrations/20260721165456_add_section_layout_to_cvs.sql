ALTER TABLE public.cvs
  ADD COLUMN IF NOT EXISTS section_layout jsonb;
