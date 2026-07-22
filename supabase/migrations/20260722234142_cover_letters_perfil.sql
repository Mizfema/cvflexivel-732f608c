-- Campos de perfil (nome + contactos, sem foto/resumo) independentes por
-- carta — mesmo padrão já usado por `photo`/`design`: pré-preenchidos uma vez
-- a partir do CV ligado ou do perfil da conta, depois editáveis e guardados
-- só nesta carta (nunca sobrescritos ao reabrir).
ALTER TABLE public.cover_letters ADD COLUMN perfil JSONB;
