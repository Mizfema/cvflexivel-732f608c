-- ============ COVER_LETTERS: template ============
-- Mesmos valores que public.cvs.template (classico | moderno | compacto | visual-sidebar).
-- A carta não usa o layout do template (sidebar/foto não fazem sentido numa
-- carta de uma página) — só o tema visual (cor, tipografia, estilo de cabeçalho).
ALTER TABLE public.cover_letters
  ADD COLUMN template TEXT NOT NULL DEFAULT 'classico';
