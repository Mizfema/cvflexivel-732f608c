import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DAY_MS = 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * DAY_MS;

function getGraceDays(): number {
  const parsed = Number(process.env.GRACE_DAYS);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 2;
}

/** PaySuite (M-Pesa, e-Mola, mKesh, cartão) é pré-pago e não tem renovação
 * automática (docs/PLANO-EXECUCAO.md secção 1.2 item 3) — não há webhook de
 * expiração, por isso marcamos "expired" oportunisticamente sempre que
 * verificamos o plano do utilizador, em vez de depender de um cron. Só marca
 * depois do período de graça (GRACE_DAYS) passar — dentro da graça o acesso
 * continua e o status fica "active". */
async function expireDuePlans(userId: string): Promise<void> {
  const graceCutoff = new Date(Date.now() - getGraceDays() * DAY_MS).toISOString();
  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update({ status: "expired" })
    .eq("user_id", userId)
    .eq("status", "active")
    .lte("current_period_end", graceCutoff);
  if (error) throw new Error(error.message);
}

/** Única porta de verificação de plano ativo (docs/PLANO-EXECUCAO.md secção 1.2 item 3).
 * PaySuite converge aqui: grava em `subscriptions` e esta função só olha status + validade,
 * com um período de graça configurável (GRACE_DAYS) antes de cortar acesso. */
export async function hasActivePlan(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  await expireDuePlans(userId);

  const graceCutoff = new Date(Date.now() - getGraceDays() * DAY_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("current_period_end", graceCutoff)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

async function getActiveSubscriptionEnd(userId: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("current_period_end")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.current_period_end ? new Date(data.current_period_end).getTime() : null;
}

/** Aviso de expiração próxima (Fase 1.4c): dias restantes quando o plano ativo
 * vence nos próximos 3 dias, para o app mostrar "renova pela PaySuite". Baseado
 * na data real de expiração, não no período de graça. */
export async function getPlanExpiryWarning(
  userId: string | null,
): Promise<{ daysLeft: number } | null> {
  if (!userId) return null;

  const periodEnd = await getActiveSubscriptionEnd(userId);
  if (!periodEnd) return null;

  const msLeft = periodEnd - Date.now();
  if (msLeft <= 0 || msLeft > THREE_DAYS_MS) return null;
  return { daysLeft: Math.max(1, Math.ceil(msLeft / DAY_MS)) };
}

/** Dias restantes do plano ativo, sem o corte dos 3 dias — usado pelo
 * indicador "Premium · X dias restantes" da sidebar (Fase 2 da Proposta V3). */
export async function getActivePlanDaysLeft(userId: string | null): Promise<number | null> {
  if (!userId) return null;
  const periodEnd = await getActiveSubscriptionEnd(userId);
  if (!periodEnd) return null;
  const msLeft = periodEnd - Date.now();
  if (msLeft <= 0) return null;
  return Math.max(1, Math.ceil(msLeft / DAY_MS));
}
