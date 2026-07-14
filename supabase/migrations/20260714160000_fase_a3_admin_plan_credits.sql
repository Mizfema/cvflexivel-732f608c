-- ============ FASE A3 — correção de segurança encontrada antes da fase ============
-- grant_credit_balance (Fase A0) e debit_credit_balance (Fase 3) são
-- SECURITY DEFINER e não verificam quem chama. Nenhuma das duas migrations
-- originais tinha REVOKE, e o projeto tem
-- ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS TO anon, authenticated
-- a nível de schema (confirmado no dump ao vivo) — qualquer conta
-- autenticada conseguia chamar ambas diretamente via supabase.rpc(...),
-- sem passar pelo servidor: grant_credit_balance permitia conceder-se
-- créditos ilimitados de graça; debit_credit_balance permitia zerar os
-- créditos de qualquer outro utilizador. Ambas só são chamadas via
-- supabaseAdmin (service_role) em credits.server.ts — revogar de
-- anon/authenticated/PUBLIC não quebra nenhum caminho existente.
REVOKE ALL ON FUNCTION public.grant_credit_balance(UUID, INT, TEXT, TIMESTAMPTZ, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.debit_credit_balance(UUID, INT)
  FROM PUBLIC, anon, authenticated;
