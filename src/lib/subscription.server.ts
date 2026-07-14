import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DAY_MS = 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * DAY_MS;

export const SUBSCRIPTION_PLANS = ["mensal", "trimestral"] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

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

/** Fórmula única de extensão de período (webhook PaySuite + concessão manual
 * admin, Fase A3): nunca encurta um período já em curso, estende a partir do
 * fim atual ou de agora, o que for mais tarde. */
export function computeExtendedPeriodEnd(
  currentPeriodEndIso: string | null,
  periodDays: number,
): string {
  const currentEnd = currentPeriodEndIso ? new Date(currentPeriodEndIso).getTime() : 0;
  const base = Math.max(Date.now(), currentEnd);
  return new Date(base + periodDays * DAY_MS).toISOString();
}

async function getLatestActiveSubscription(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Concede/estende um plano manualmente (Fase A3 do painel admin). Nunca
 * insere em `payments` — não houve pagamento real. `subscriptions` não tem
 * unique constraint em `user_id` (só PK em `id`, por desenho: uma linha por
 * checkout), por isso isto não é um upsert — procura a linha ativa atual e
 * estende-a, ou insere uma nova com `provider: 'admin'`. */
export async function adminGrantPlan(
  userId: string,
  plan: SubscriptionPlan,
  periodDays: number,
) {
  const existing = await getLatestActiveSubscription(userId);
  const newPeriodEnd = computeExtendedPeriodEnd(existing?.current_period_end ?? null, periodDays);

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .update({ plan, current_period_end: newPeriodEnd })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .insert({ user_id: userId, plan, status: "active", provider: "admin", current_period_end: newPeriodEnd })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Revoga o plano ativo agora (Fase A3) — funciona tanto para planos
 * concedidos manualmente como pagos (reembolso/abuso). Marca `status:
 * 'expired'` (não só encurta `current_period_end`) porque `hasActivePlan`
 * tolera uma janela de graça (`GRACE_DAYS`) depois do período terminar — só
 * mudar a data deixaria a conta ativa durante essa janela. */
export async function adminRevokePlan(userId: string) {
  const existing = await getLatestActiveSubscription(userId);
  if (!existing) throw new Error("Utilizador não tem plano ativo para revogar.");

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .update({ status: "expired", current_period_end: new Date().toISOString() })
    .eq("id", existing.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
