-- ============ FASE 3 da Proposta V3 (docs/PROPOSTA-V3-FINAL-CONSOLIDADA.md §3/§8) ============
-- Infra de créditos do pacote avulso: saldo, livro-razão de transações, pesos
-- por operação (tabela, nunca hardcoded) e o campo que liga um pagamento ao
-- que foi comprado (subscrição vs crédito), para o webhook decidir o que fazer.

-- ============ 1. Saldo de créditos (um por utilizador) ============
CREATE TABLE public.credit_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  expires_at TIMESTAMPTZ NOT NULL,
  package_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_balances TO authenticated;
GRANT ALL ON public.credit_balances TO service_role;
ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own credit balance" ON public.credit_balances FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- No insert/update/delete policy: só service_role grava (compra confirmada pelo webhook, débito pelo serviço de IA).

-- ============ 2. Livro-razão de transações (auditoria, não-negociável dado o
-- histórico de perda de dados da v1 — ver incidente de segurança) ============
CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature TEXT,
  delta INT NOT NULL,
  balance_after INT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('purchase', 'recharge', 'debit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own credit transactions" ON public.credit_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_credit_transactions_user ON public.credit_transactions (user_id, created_at);

-- ============ 3. Pesos por operação (secção 3 do doc V3) — só se aplicam
-- quando o utilizador tem saldo de créditos ativo; mudar peso é UPDATE. ============
CREATE TABLE public.credit_weights (
  feature TEXT PRIMARY KEY,
  weight INT NOT NULL CHECK (weight >= 0)
);
GRANT SELECT ON public.credit_weights TO anon, authenticated;
GRANT ALL ON public.credit_weights TO service_role;
ALTER TABLE public.credit_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read credit weights" ON public.credit_weights FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.credit_weights (feature, weight) VALUES
  ('field_suggestions', 0),
  ('cv_analysis', 1),
  ('cover_letter', 1),
  ('interview_prep', 2),
  ('align_cv_tdr', 2),
  ('generate_cv_interview', 3),
  ('download_free', 0),
  ('download_premium', 0);

-- ============ 4. Liga o pagamento ao que foi comprado ============
-- subscription_id continua a identificar compras de assinatura (mensal/trimestral).
-- Para avulso/recarga, subscription_id fica NULL e `plan` diz o que foi comprado,
-- para o webhook (src/routes/api/paysuite-webhook.ts) decidir entre estender
-- current_period_end ou creditar credit_balances.
ALTER TABLE public.payments ADD COLUMN plan TEXT;
