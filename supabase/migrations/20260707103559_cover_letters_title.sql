-- ============ COVER_LETTERS: title ============
ALTER TABLE public.cover_letters
  ADD COLUMN title TEXT NOT NULL DEFAULT 'Carta sem título';
