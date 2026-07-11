-- ============ FASE 0 da Proposta V3 (docs/PROPOSTA-V3-FINAL-CONSOLIDADA.md §6/§8) ============
-- Pré-requisitos técnicos, bloqueadores do resto da monetização faseada:
-- 1. Separar as 6 operações do balde único `ai_suggestions` em chaves próprias.
-- 2. (tectos de tokens de saída vivem no código, não no schema — ver llm.functions.ts)
-- 3. Rate-limit por sessão em generateFieldSuggestions.
-- 4. Logging por operação com custo USD (coluna cost_usd em ai_usage).
-- 5. Fail-safe de custo diário com alerta (tabela ai_cost_alerts).

-- ============ 1. Separar as chaves de ai_suggestions ============
-- generateFieldSuggestions -> field_suggestions
-- alignCvToTdr             -> align_cv_tdr
-- generateCvFromInterview  -> generate_cv_interview
-- Copia os valores atuais de `ai_suggestions` como baseline (comportamento
-- efetivo inalterado nesta fase — só a chave muda). Calibração de números
-- (ex.: tornar field_suggestions "livre") é Fase 1/Fase 6 do doc V3.
INSERT INTO public.access_policies (feature, tier, max_per_day, max_per_month, cooldown_hours, enabled)
SELECT 'field_suggestions', tier, max_per_day, max_per_month, cooldown_hours, enabled
FROM public.access_policies WHERE feature = 'ai_suggestions'
UNION ALL
SELECT 'align_cv_tdr', tier, max_per_day, max_per_month, cooldown_hours, enabled
FROM public.access_policies WHERE feature = 'ai_suggestions'
UNION ALL
SELECT 'generate_cv_interview', tier, max_per_day, max_per_month, cooldown_hours, enabled
FROM public.access_policies WHERE feature = 'ai_suggestions';

DELETE FROM public.access_policies WHERE feature = 'ai_suggestions';

-- ============ 3. Rate-limit por sessão (guard-rail transversal, [DADO] recalibrável) ============
ALTER TABLE public.access_policies ADD COLUMN max_per_session INT;
UPDATE public.access_policies SET max_per_session = 20 WHERE feature = 'field_suggestions';

ALTER TABLE public.ai_usage ADD COLUMN session_id TEXT;
CREATE INDEX idx_ai_usage_session_feature ON public.ai_usage (session_id, feature);

-- ============ 4. Custo USD por chamada, gravado desde o primeiro request ============
ALTER TABLE public.ai_usage ADD COLUMN cost_usd NUMERIC;

-- ============ 5. Fail-safe de custo diário — idempotência por dia ============
CREATE TABLE public.ai_cost_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_date DATE NOT NULL UNIQUE,
  cost_usd_at_alert NUMERIC NOT NULL,
  threshold_usd NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_cost_alerts TO service_role;
ALTER TABLE public.ai_cost_alerts ENABLE ROW LEVEL SECURITY;
-- Sem policy para authenticated: só o cron (service_role) lê/escreve esta tabela.
