-- ============ COVER_LETTERS: DESIGN INDEPENDENTE (fonte/espaçamento/cor) ============
-- Aditiva, nullable. Cartas sem design guardado continuam a usar o tema fixo
-- do template escolhido (ver src/lib/templates/themes.ts) até serem personalizadas.
ALTER TABLE public.cover_letters ADD COLUMN design JSONB;
