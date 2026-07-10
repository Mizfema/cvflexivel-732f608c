-- ============ FASE 1.4d (item 1): motor de lembretes de expiração ============
-- Regista os e-mails já enviados por (subscription, tipo, período) para o cron
-- diário (src/lib/plan-reminders.server.ts) ser idempotente: cada período de
-- assinatura (current_period_end) só dispara um "expiring_soon" e um "expired",
-- mesmo correndo o job todos os dias dentro da janela.

CREATE TABLE public.plan_reminder_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('expiring_soon', 'expired')),
  period_end TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.plan_reminder_emails TO service_role;
ALTER TABLE public.plan_reminder_emails ENABLE ROW LEVEL SECURITY;
-- Sem policy para authenticated: só o cron (service_role) lê/escreve esta tabela.
CREATE UNIQUE INDEX plan_reminder_emails_sub_kind_period_key
  ON public.plan_reminder_emails (subscription_id, kind, period_end);
