import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface CreditBalance {
  balance: number;
  expiresAt: string;
  packageId: string;
}

/** Saldo ativo (não expirado) de créditos do pacote avulso, ou null se o
 * utilizador nunca comprou avulso ou o pacote já expirou (Fase 3 da Proposta
 * V3 §3/§8). Nunca devolve saldo expirado — a validade "morre sozinha" aqui,
 * sem precisar de um cron para marcar o pacote como inativo. */
export async function getActiveCreditBalance(userId: string): Promise<CreditBalance | null> {
  const { data, error } = await supabaseAdmin
    .from("credit_balances")
    .select("balance, expires_at, package_id")
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { balance: data.balance, expiresAt: data.expires_at, packageId: data.package_id };
}

/** Peso em créditos de uma operação (secção 3 do doc V3) — null se a feature
 * não é coberta por créditos (ex.: features que só existem no ilimitado). */
export async function getCreditWeight(feature: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("credit_weights")
    .select("weight")
    .eq("feature", feature)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.weight ?? null;
}

/** Débito atómico (função de Postgres — evita corrida de dois pedidos
 * simultâneos levarem o saldo a negativo) + registo no livro-razão. Devolve o
 * saldo novo, ou null se não havia saldo suficiente/ativo (chamador deve ter
 * verificado antes, isto é só a rede de segurança final). */
export async function debitCredits(
  userId: string,
  feature: string,
  weight: number,
): Promise<number | null> {
  if (weight <= 0) return null;

  const { data: newBalance, error } = await supabaseAdmin.rpc("debit_credit_balance", {
    p_user_id: userId,
    p_weight: weight,
  });
  if (error) throw new Error(error.message);
  if (newBalance == null) return null;

  const { error: txError } = await supabaseAdmin.from("credit_transactions").insert({
    user_id: userId,
    feature,
    delta: -weight,
    balance_after: newBalance,
    reason: "debit",
  });
  if (txError) throw new Error(txError.message);

  return newBalance;
}

/** Credita o saldo de uma compra de avulso ou recarga (Fase 3 §8), ou uma
 * concessão manual admin (Fase A3). Nunca reduz créditos existentes: uma nova
 * compra de avulso soma ao saldo actual e estende a validade para a mais
 * distante das duas (nunca a encurta) — feito atomicamente pelo RPC
 * grant_credit_balance (migration 20260713150000, espelha debit_credit_balance)
 * para evitar a mesma corrida de leitura-depois-escrita que debitCredits já
 * evitava. Recarga "herda a validade do pacote ativo" (§2 do doc V3) — só soma
 * créditos, nunca mexe na validade, e exige um pacote avulso ativo (o RPC
 * devolve zero linhas nesse caso, tratado abaixo como erro explícito). */
export async function grantCredits(
  userId: string,
  amount: number,
  packageId: string,
  reason: "purchase" | "recharge",
  purchaseExpiresAt?: Date,
): Promise<void> {
  const requireExisting = reason === "recharge";

  const { data, error } = await supabaseAdmin.rpc("grant_credit_balance", {
    p_user_id: userId,
    p_amount: amount,
    p_package_id: packageId,
    p_new_expiry: (purchaseExpiresAt ?? new Date()).toISOString(),
    p_require_existing: requireExisting,
  });
  if (error) throw new Error(error.message);

  const row = data?.[0];
  if (!row) {
    throw new Error("Recarga sem pacote avulso ativo.");
  }

  const { error: txError } = await supabaseAdmin.from("credit_transactions").insert({
    user_id: userId,
    feature: null,
    delta: amount,
    balance_after: row.balance,
    reason,
  });
  if (txError) throw new Error(txError.message);
}
