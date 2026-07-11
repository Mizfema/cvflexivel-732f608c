-- ============ FASE 1 da Proposta V3 (docs/PROPOSTA-V3-FINAL-CONSOLIDADA.md §6/§8) ============
-- Infra de assinatura e preços em tabela:
-- 1. Preços em tabela (nunca hardcoded) — plan_prices.
-- 2. Tectos de fair-use invisível do premium (secção 5, [DADO] recalibrável).
-- 3. Grátis: field_suggestions livre; align_cv_tdr+generate_cv_interview com
--    quota combinada de 2/mês (quota_group), em vez de 2/mês cada uma.
-- 4. payments.period_days — o webhook deixa de assumir 30 dias fixos.

-- ============ 1. Preços em tabela ============
CREATE TABLE public.plan_prices (
  plan TEXT PRIMARY KEY,
  price_mzn NUMERIC NOT NULL,
  period_days INT,
  credits INT,
  label TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT ON public.plan_prices TO anon, authenticated;
GRANT ALL ON public.plan_prices TO service_role;
ALTER TABLE public.plan_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read plan prices" ON public.plan_prices FOR SELECT TO anon, authenticated USING (true);
-- No insert/update/delete policy: só service_role muda preços (UPDATE em vez de deploy).

INSERT INTO public.plan_prices (plan, price_mzn, period_days, credits, label, enabled) VALUES
  ('mensal', 349, 30, NULL, 'Mensal', true),
  ('trimestral', 749, 90, NULL, 'Trimestral', true),
  ('avulso', 149, 30, 8, 'Avulso — 1 candidatura', true),
  ('recarga', 79, NULL, 4, 'Recarga extra', true);

-- ============ 4. Período dinâmico no pagamento (webhook deixa de assumir 30 dias) ============
ALTER TABLE public.payments ADD COLUMN period_days INT;

-- ============ 2. Tectos de fair-use invisível do premium (secção 5, [DADO]) ============
UPDATE public.access_policies SET max_per_day = 2 WHERE tier = 'premium' AND feature = 'generate_cv_interview';
UPDATE public.access_policies SET max_per_day = 4 WHERE tier = 'premium' AND feature = 'align_cv_tdr';
UPDATE public.access_policies SET max_per_day = 10 WHERE tier = 'premium' AND feature = 'cv_analysis';
UPDATE public.access_policies SET max_per_day = 5 WHERE tier = 'premium' AND feature = 'cover_letter';
UPDATE public.access_policies SET max_per_day = 5 WHERE tier = 'premium' AND feature = 'interview_prep';
-- field_suggestions fica de fora: o rate-limit por sessão (Fase 0) já é o
-- mecanismo de fair-use desta operação, por decisão da própria proposta.

-- ============ 3a. field_suggestions passa a livre no grátis/anónimo ============
UPDATE public.access_policies SET max_per_day = NULL, max_per_month = NULL
  WHERE feature = 'field_suggestions' AND tier IN ('anonymous', 'free');

-- ============ 3b. Quota combinada da IA pesada (align_cv_tdr + generate_cv_interview) ============
ALTER TABLE public.access_policies ADD COLUMN quota_group TEXT;

UPDATE public.access_policies SET quota_group = 'ai_heavy', max_per_day = NULL, max_per_month = 2
  WHERE tier = 'free' AND feature IN ('align_cv_tdr', 'generate_cv_interview');
UPDATE public.access_policies SET quota_group = 'ai_heavy', max_per_day = NULL, max_per_month = 1
  WHERE tier = 'anonymous' AND feature IN ('align_cv_tdr', 'generate_cv_interview');
