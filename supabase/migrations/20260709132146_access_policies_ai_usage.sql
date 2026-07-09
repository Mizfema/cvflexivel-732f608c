-- ============ FASE 0.1: POLÍTICA DE ACESSO + REGISTO DE USO DE IA ============

-- ============ ACCESS_POLICIES ============
CREATE TABLE public.access_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('anonymous', 'free', 'premium')),
  max_per_day INT,
  max_per_month INT,
  cooldown_hours INT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (feature, tier)
);
GRANT SELECT ON public.access_policies TO anon, authenticated;
GRANT ALL ON public.access_policies TO service_role;
ALTER TABLE public.access_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read access policies" ON public.access_policies FOR SELECT TO anon, authenticated USING (true);
-- No insert/update/delete policy: only service_role changes limits (UPDATE em vez de deploy).

-- ============ AI_USAGE ============
CREATE TABLE public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  anon_fingerprint TEXT,
  feature TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tokens_in INT,
  tokens_out INT
);
GRANT SELECT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own ai usage" ON public.ai_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- No insert policy: só service_role (server function checkAndRecordUsage) grava.
CREATE INDEX idx_ai_usage_user_feature_time ON public.ai_usage (user_id, feature, created_at);
CREATE INDEX idx_ai_usage_fingerprint_feature_time ON public.ai_usage (anon_fingerprint, feature, created_at);

-- ============ SEED: matriz de acesso v1.0 (docs/PLANO-EXECUCAO.md secção 1.3) ============
INSERT INTO public.access_policies (feature, tier, max_per_day, max_per_month, cooldown_hours, enabled) VALUES
  -- Analisar CV
  ('cv_analysis', 'anonymous', NULL, 1, NULL, true),
  ('cv_analysis', 'free', 1, 3, 24, true),
  ('cv_analysis', 'premium', NULL, NULL, NULL, true),

  -- IA (sugestões, alinhamento CV↔TdR, geração via entrevista, sugestões de campo)
  ('ai_suggestions', 'anonymous', NULL, 1, NULL, true),
  ('ai_suggestions', 'free', 2, 4, 24, true),
  ('ai_suggestions', 'premium', NULL, NULL, NULL, true),

  -- Download com template grátis
  ('download_free', 'anonymous', NULL, NULL, NULL, false),
  ('download_free', 'free', 1, 3, 24, true),
  ('download_free', 'premium', NULL, NULL, NULL, true),

  -- Download com template premium
  ('download_premium', 'anonymous', NULL, NULL, NULL, false),
  ('download_premium', 'free', NULL, NULL, NULL, false),
  ('download_premium', 'premium', NULL, NULL, NULL, true),

  -- Carta de apresentação
  ('cover_letter', 'anonymous', NULL, NULL, NULL, false),
  ('cover_letter', 'free', 1, 3, 24, true),
  ('cover_letter', 'premium', NULL, NULL, NULL, true),

  -- Preparação de entrevista
  ('interview_prep', 'anonymous', NULL, NULL, NULL, false),
  ('interview_prep', 'free', NULL, NULL, NULL, false),
  ('interview_prep', 'premium', NULL, NULL, NULL, true),

  -- Rate-limit global anti-abuso para anónimos (soma de todas as features de IA)
  ('_global', 'anonymous', 10, NULL, NULL, true);
