-- ============ FASE B3 do Guia de Gestão de Planos (docs/GUIA-B0-B5-planos.md) ============
-- Checkout/webhook passam a ler plan_prices dinamicamente. payments.plan_kind é o
-- snapshot que substitui o branch hardcoded `plan === 'avulso' || plan === 'recarga'`
-- no webhook; payments.period_minutes substitui period_days como fonte canónica da
-- duração da assinatura comprada (period_days não tem granularidade para planos
-- sub-diários, ex. "ilimitado 12h" — o próprio B3 exige que qualquer plano novo
-- criado no admin funcione em checkout sem alteração de código). Ambas nullable:
-- linhas de payments anteriores a esta fase não as têm, e o webhook trata isso com
-- fallback ao comportamento antigo (comentado no código).
ALTER TABLE public.payments ADD COLUMN plan_kind TEXT;
ALTER TABLE public.payments ADD COLUMN period_minutes INT;
