-- ============ FASE 3 da Proposta V3 — débito atómico de créditos ============
-- supabase-js não faz `balance = balance - peso` num único UPDATE sem SQL bruto;
-- uma função de Postgres com a condição no WHERE evita a corrida de dois
-- pedidos simultâneos (ex.: duplo clique) levarem o saldo a negativo.
CREATE OR REPLACE FUNCTION public.debit_credit_balance(p_user_id UUID, p_weight INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INT;
BEGIN
  UPDATE public.credit_balances
  SET balance = balance - p_weight, updated_at = now()
  WHERE user_id = p_user_id AND balance >= p_weight AND expires_at > now()
  RETURNING balance INTO v_new_balance;

  RETURN v_new_balance; -- NULL se não havia saldo suficiente ou pacote ativo
END;
$$;

GRANT EXECUTE ON FUNCTION public.debit_credit_balance(UUID, INT) TO service_role;
