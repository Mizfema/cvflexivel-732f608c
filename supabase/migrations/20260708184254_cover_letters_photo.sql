-- ============ COVER_LETTERS: FOTO DO CANDIDATO (independente por carta) ============
-- Aditiva, nullable. Guarda { url, zoom, offsetX, offsetY } — mesma forma do
-- ajuste usado no CV (ver src/lib/photo-style.ts). Cartas sem foto continuam
-- a renderizar normalmente, sem círculo de foto.
ALTER TABLE public.cover_letters ADD COLUMN photo JSONB;
