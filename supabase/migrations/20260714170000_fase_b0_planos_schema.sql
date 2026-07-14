-- ============ FASE B0 do Guia de Gestão de Planos (docs/GUIA-B0-B5-planos.md) ============
-- Schema de planos: duração flexível, tipo, promoção com preço, teto por plano.
-- Migração aditiva — period_days/credits/label/enabled continuam ativos e lidos
-- pelo código atual sem nenhuma mudança de comportamento até a B1/B3 migrarem os
-- leitores. Mapa de leitores auditado no Passo 0 (apresentado ao dono antes desta
-- migration): mensal/trimestral/avulso têm período próprio (period_days alimenta
-- duração de assinatura OU validade de créditos, via paysuite-webhook.ts);
-- recarga não tem (period_days já é NULL na tabela).

ALTER TABLE public.plan_prices
  ADD COLUMN id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD CONSTRAINT plan_prices_id_key UNIQUE (id);

-- period_minutes é o novo campo canónico de duração (Q2) — period_days fica
-- legado, nunca lido por código novo a partir da B1. Backfill segue o critério
-- real do código (Passo 0), não o nome do plano: qualquer plano com period_days
-- preenchido tem período próprio.
ALTER TABLE public.plan_prices ADD COLUMN period_minutes INT;
UPDATE public.plan_prices SET period_minutes = period_days * 1440 WHERE period_days IS NOT NULL;

-- kind substitui as duas inferências frágeis atuais: `credits IS NULL` (para
-- distinguir assinatura de pacote) e o `payment.plan === 'avulso' || 'recarga'`
-- hardcoded do webhook.
ALTER TABLE public.plan_prices ADD COLUMN kind TEXT;
UPDATE public.plan_prices SET kind = 'subscription_unlimited' WHERE plan IN ('mensal', 'trimestral');
UPDATE public.plan_prices SET kind = 'credit_pack' WHERE plan IN ('avulso', 'recarga');
ALTER TABLE public.plan_prices ALTER COLUMN kind SET NOT NULL;
ALTER TABLE public.plan_prices ADD CONSTRAINT plan_prices_kind_check
  CHECK (kind IN ('subscription_unlimited', 'credit_pack'));

-- Bypass de fair-use (Q1/N1, só usado na B5) — nasce aqui para não haver
-- segunda migration de schema. fair_use_hourly_cap é o teto por hora,
-- obrigatório por validação de aplicação (B1) sempre que bypasses_fair_use=true
-- — nunca "ilimitado" sem teto técnico.
ALTER TABLE public.plan_prices ADD COLUMN bypasses_fair_use BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.plan_prices ADD COLUMN fair_use_hourly_cap INT;

-- Promoção com consequência real (N2): promo_price_mzn é o preço efetivo
-- enquanto promo_ends_at estiver no futuro — getEffectivePlanPrice (B1) é a
-- única fonte de preço, nunca um selo decorativo sem efeito no valor cobrado.
ALTER TABLE public.plan_prices ADD COLUMN is_promotional BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.plan_prices ADD COLUMN promo_badge_text TEXT;
ALTER TABLE public.plan_prices ADD COLUMN promo_ends_at TIMESTAMPTZ;
ALTER TABLE public.plan_prices ADD COLUMN promo_price_mzn NUMERIC;

-- Bullets de marketing editáveis pelo admin sem deploy (hoje escritos à mão em
-- JSX por plano em planos.tsx).
ALTER TABLE public.plan_prices ADD COLUMN features JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Ordem/visibilidade em /planos — "recarga" nunca aparece lá (regra hardcoded
-- hoje em planos.tsx); passa a ser dado, não código.
ALTER TABLE public.plan_prices ADD COLUMN display_order INT NOT NULL DEFAULT 0;
ALTER TABLE public.plan_prices ADD COLUMN visible_on_pricing_page BOOLEAN NOT NULL DEFAULT true;

UPDATE public.plan_prices SET visible_on_pricing_page = false, display_order = 99 WHERE plan = 'recarga';
UPDATE public.plan_prices SET display_order = 1 WHERE plan = 'avulso';
UPDATE public.plan_prices SET display_order = 2 WHERE plan = 'mensal';
UPDATE public.plan_prices SET display_order = 3 WHERE plan = 'trimestral';

-- Novas ações de auditoria para o CRUD de planos (B1). Nome real da constraint
-- confirmado no dump ao vivo do Passo 0: admin_actions_action_type_check.
ALTER TABLE public.admin_actions DROP CONSTRAINT admin_actions_action_type_check;
ALTER TABLE public.admin_actions ADD CONSTRAINT admin_actions_action_type_check
  CHECK (action_type IN (
    'grant_plan', 'revoke_plan', 'adjust_credits', 'suspend_user', 'reactivate_user',
    'create_plan', 'update_plan', 'archive_plan'
  ));
