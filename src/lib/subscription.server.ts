import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Única porta de verificação de plano ativo (docs/PLANO-EXECUCAO.md secção 1.2 item 3).
 * Stripe (renovação automática) e M-Pesa/e-Mola (pré-pago, 30 dias) convergem aqui:
 * ambos gravam em `subscriptions` e esta função só olha status + validade. */
export async function hasActivePlan(userId: string | null): Promise<boolean> {
  if (!userId) return false;

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("current_period_end", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}
