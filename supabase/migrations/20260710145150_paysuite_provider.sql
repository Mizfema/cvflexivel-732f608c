-- ============ FASE 1.4c: PAYSUITE COMO AGREGADOR ÚNICO ============
-- Decisão de 10/07/2026 (docs/PLANO-EXECUCAO.md secção 1.2 item 3): Stripe fica
-- parqueado (não opera para comerciantes em Moçambique). PaySuite cobre M-Pesa,
-- e-Mola, mKesh e cartão numa única API/checkout — passam a ser "método de
-- pagamento" (metadado para analytics), não "provider" separado.

ALTER TABLE public.subscriptions DROP CONSTRAINT subscriptions_provider_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_provider_check
  CHECK (provider IN ('paysuite', 'stripe'));
ALTER TABLE public.subscriptions ADD COLUMN payment_method TEXT
  CHECK (payment_method IN ('mpesa', 'emola', 'mkesh', 'card'));

ALTER TABLE public.payments DROP CONSTRAINT payments_provider_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_provider_check
  CHECK (provider IN ('paysuite', 'stripe'));
ALTER TABLE public.payments ADD COLUMN payment_method TEXT
  CHECK (payment_method IN ('mpesa', 'emola', 'mkesh', 'card'));
