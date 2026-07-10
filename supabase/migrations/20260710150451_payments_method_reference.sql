-- ============ FASE 1.4c (refinamento): payments ganha method/reference/paid_at ============
-- payment_method → method (nome mais curto, mesmo significado: metadado do
-- método escolhido no checkout da PaySuite). reference é a nossa referência
-- única (user+plano+período) enviada à PaySuite. paid_at vem de
-- transaction.paid_at no callback. Índice único parcial em provider_ref
-- (transaction.id da PaySuite) é a base da idempotência do webhook.

ALTER TABLE public.payments RENAME COLUMN payment_method TO method;
ALTER TABLE public.payments RENAME CONSTRAINT payments_payment_method_check TO payments_method_check;

ALTER TABLE public.payments ADD COLUMN reference TEXT;
ALTER TABLE public.payments ADD COLUMN paid_at TIMESTAMPTZ;

CREATE UNIQUE INDEX payments_provider_ref_key ON public.payments (provider_ref) WHERE provider_ref IS NOT NULL;
