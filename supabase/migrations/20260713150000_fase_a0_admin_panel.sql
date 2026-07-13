-- ============ FASE A0 do Guia do Painel Admin (docs/PROPOSTA-PAINEL-ADMIN-V1.md) ============
-- Fundamentos: auditoria append-only, suspensão de conta, CHECKs para concessão
-- manual de plano/créditos, RPC atómico de crédito. Nenhuma mutação admin usa
-- este schema antes desta migration existir (regra de ordem A0 → A1..A5).

-- ============ ADMIN_ACTIONS (auditoria append-only) ============
-- Snapshot forense: este painel nasceu do incidente de segurança da v1 (ver
-- memória incidente-seguranca-v1) — motivo, IP (cf-connecting-ip, Worker
-- Cloudflare via nitro cloudflare-module) e user-agent do actor vão em metadata.
CREATE TABLE public.admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('grant_plan', 'revoke_plan', 'adjust_credits', 'suspend_user', 'reactivate_user')),
  reason TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access" ON public.admin_actions FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
-- Append-only a sério: os default privileges deste projeto já dão ALL a
-- service_role em qualquer CREATE TABLE (ALTER DEFAULT PRIVILEGES FOR ROLE
-- "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role",
-- confirmado no dump ao vivo) — um GRANT sozinho não restringe nada, é preciso
-- REVOKE explícito. Limite honesto: o owner do banco sempre consegue.
GRANT SELECT, INSERT ON public.admin_actions TO service_role;
REVOKE UPDATE, DELETE ON public.admin_actions FROM service_role;
CREATE INDEX idx_admin_actions_target ON public.admin_actions (target_user_id, created_at DESC);
CREATE INDEX idx_admin_actions_actor ON public.admin_actions (actor_user_id, created_at DESC);

-- ============ USER_SUSPENSIONS ============
-- Tabela dedicada, nunca um booleano em profiles: a policy de update de
-- profiles é row-level (não column-level), o próprio suspenso conseguiria
-- reverter um campo lá. Presença da linha = suspenso; reativar = DELETE.
CREATE TABLE public.user_suspensions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  suspended_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  suspended_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL
);
ALTER TABLE public.user_suspensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access" ON public.user_suspensions FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
-- Nenhum GRANT a authenticated (contradiria a policy acima). GRANT a
-- service_role é implícito pelos default privileges do projeto; declarado por
-- clareza, não por necessidade.
GRANT ALL ON public.user_suspensions TO service_role;

-- ============ CHECK constraints: abrir espaço para concessão manual admin ============
-- Nomes confirmados no schema ao vivo antes desta migration (convenção padrão
-- <tabela>_<coluna>_check, sem nome customizado neste projeto).
ALTER TABLE public.subscriptions DROP CONSTRAINT subscriptions_provider_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_provider_check CHECK (provider IN ('paysuite', 'stripe', 'admin'));

ALTER TABLE public.credit_transactions DROP CONSTRAINT credit_transactions_reason_check;
ALTER TABLE public.credit_transactions ADD CONSTRAINT credit_transactions_reason_check CHECK (reason IN ('purchase', 'recharge', 'debit', 'admin_grant', 'admin_adjustment'));
-- payments.provider NÃO é tocado: concessão manual nunca gera linha em
-- payments (não houve pagamento real) — mantém as queries de receita limpas
-- por construção.

-- ============ RPC grant_credit_balance ============
-- Espelha debit_credit_balance (migration 20260711161500): supabase-js não faz
-- `balance = balance + delta` atômico num único UPDATE sem SQL bruto. Usada
-- tanto por grantCredits() (compra/recarga real) quanto por adminAdjustCredits
-- (Fase A3) — corrige uma race condition de raiz para qualquer chamador.
-- credit_balances.user_id tem UNIQUE constraint (credit_balances_user_id_key,
-- confirmado no schema ao vivo) — ON CONFLICT (user_id) é válido aqui.
CREATE OR REPLACE FUNCTION public.grant_credit_balance(
  p_user_id UUID,
  p_amount INT,
  p_package_id TEXT,
  p_new_expiry TIMESTAMPTZ,
  p_require_existing BOOLEAN
)
RETURNS TABLE (balance INT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_require_existing THEN
    RETURN QUERY
    UPDATE public.credit_balances
    SET balance = balance + p_amount, updated_at = now()
    WHERE user_id = p_user_id
    RETURNING credit_balances.balance, credit_balances.expires_at;
  ELSE
    RETURN QUERY
    INSERT INTO public.credit_balances (user_id, balance, expires_at, package_id, updated_at)
    VALUES (p_user_id, p_amount, p_new_expiry, p_package_id, now())
    ON CONFLICT (user_id) DO UPDATE
    SET balance = credit_balances.balance + p_amount,
        expires_at = GREATEST(credit_balances.expires_at, p_new_expiry),
        updated_at = now()
    RETURNING credit_balances.balance, credit_balances.expires_at;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_credit_balance(UUID, INT, TEXT, TIMESTAMPTZ, BOOLEAN) TO service_role;
