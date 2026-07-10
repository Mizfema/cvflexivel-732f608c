import { supabaseAdmin } from "@/integrations/supabase/client.server";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/** PaySuite (M-Pesa, e-Mola, mKesh, cartão) é pré-pago e não tem renovação
 * automática (docs/PLANO-EXECUCAO.md secção 1.2 item 3) — não há webhook de
 * expiração, por isso marcamos "expired" oportunisticamente sempre que
 * verificamos o plano do utilizador, em vez de depender de um cron. */
async function expireDuePlans(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update({ status: "expired" })
    .eq("user_id", userId)
    .eq("status", "active")
    .lte("current_period_end", new Date().toISOString());
  if (error) throw new Error(error.message);
}

/** Única porta de verificação de plano ativo (docs/PLANO-EXECUCAO.md secção 1.2 item 3).
 * PaySuite converge aqui: grava em `subscriptions` e esta função só olha status + validade. */
export async function hasActivePlan(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  await expireDuePlans(userId);

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

/** Aviso de expiração próxima (Fase 1.4c): dias restantes quando o plano ativo
 * vence nos próximos 3 dias, para o app mostrar "renova pela PaySuite". */
export async function getPlanExpiryWarning(
  userId: string | null,
): Promise<{ daysLeft: number } | null> {
  if (!userId) return null;

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("current_period_end")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.current_period_end) return null;

  const msLeft = new Date(data.current_period_end).getTime() - Date.now();
  if (msLeft <= 0 || msLeft > THREE_DAYS_MS) return null;
  return { daysLeft: Math.max(1, Math.ceil(msLeft / (24 * 60 * 60 * 1000))) };
}
