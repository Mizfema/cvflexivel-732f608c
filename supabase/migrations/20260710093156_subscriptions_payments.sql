-- ============ FASE 1.4a: INFRA DE PLANOS (subscriptions + payments) ============
-- Stripe (cartão, renovação automática) e M-Pesa/e-Mola (pré-pago, 30 dias) convergem
-- nesta mesma tabela. hasActivePlan() em src/lib/subscription.server.ts é a única
-- porta de verificação de plano ativo (docs/PLANO-EXECUCAO.md secção 1.2 item 3).

-- ============ SUBSCRIPTIONS ============
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'canceled', 'pending')),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'mpesa', 'emola')),
  provider_ref TEXT,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- No insert/update/delete policy: só service_role grava (webhooks Stripe / callbacks M-Pesa e e-Mola).
CREATE INDEX idx_subscriptions_user_status ON public.subscriptions (user_id, status, current_period_end);

-- ============ PAYMENTS ============
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'mpesa', 'emola')),
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'failed')),
  provider_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own payments" ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- No insert/update/delete policy: só service_role grava (webhooks Stripe / callbacks M-Pesa e e-Mola).
CREATE INDEX idx_payments_user ON public.payments (user_id, created_at);
CREATE INDEX idx_payments_subscription ON public.payments (subscription_id);
