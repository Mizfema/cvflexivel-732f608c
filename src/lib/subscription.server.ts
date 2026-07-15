import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const THREE_DAYS_MS = 3 * DAY_MS;
const SUB_DAY_THRESHOLD_MINUTES = 1440; // 24h — abaixo disto, "sub-diário" (N1 do Guia B0-B5)

function getGraceDays(): number {
  const parsed = Number(process.env.GRACE_DAYS);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 2;
}

async function getPlanPeriodMinutes(plan: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("plan_prices")
    .select("period_minutes")
    .eq("plan", plan)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.period_minutes ?? null;
}

/** Regra N1 do Guia B0-B5: `GRACE_DAYS` nunca se aplica a planos sub-diários
 * (`period_minutes < 1440`) — expiram no minuto exato do fim do período. Sem
 * isto, um "ilimitado 12h" ganharia dias extra de acesso depois de suposto
 * expirar, o pior lugar possível para tolerância. `periodMinutes` null
 * (plano sem período próprio, ex. "recarga") ou >= 1440 mantém a graça normal. */
function graceMsForPeriodMinutes(periodMinutes: number | null): number {
  if (periodMinutes != null && periodMinutes < SUB_DAY_THRESHOLD_MINUTES) return 0;
  return getGraceDays() * DAY_MS;
}

/** PaySuite (M-Pesa, e-Mola, mKesh, cartão) é pré-pago e não tem renovação
 * automática (docs/PLANO-EXECUCAO.md secção 1.2 item 3) — não há webhook de
 * expiração, por isso marcamos "expired" oportunisticamente sempre que
 * verificamos o plano do utilizador, em vez de depender de um cron. Só marca
 * depois do período de graça passar — dentro da graça o acesso continua e o
 * status fica "active". Só busca candidatos cujo period_end já passou (sem
 * grace) — para o caminho normal (plano bem dentro do período) isto continua
 * a ser zero queries extra a `plan_prices`, mesmo com a graça agora dependente
 * do plano (N1). */
async function expireDuePlans(userId: string): Promise<void> {
  const now = Date.now();
  const { data: candidates, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id, plan, current_period_end")
    .eq("user_id", userId)
    .eq("status", "active")
    .not("current_period_end", "is", null)
    .lte("current_period_end", new Date(now).toISOString());
  if (error) throw new Error(error.message);
  if (!candidates || candidates.length === 0) return;

  for (const sub of candidates) {
    const periodMinutes = await getPlanPeriodMinutes(sub.plan);
    const graceMs = graceMsForPeriodMinutes(periodMinutes);
    const periodEndMs = new Date(sub.current_period_end as string).getTime();
    if (now < periodEndMs + graceMs) continue; // ainda dentro da graça (ou nem chegou a expirar)

    const { error: updError } = await supabaseAdmin
      .from("subscriptions")
      .update({ status: "expired" })
      .eq("id", sub.id);
    if (updError) throw new Error(updError.message);
  }
}

/** Única porta de verificação de plano ativo (docs/PLANO-EXECUCAO.md secção 1.2 item 3).
 * PaySuite converge aqui: grava em `subscriptions` e esta função só olha o
 * status. `expireDuePlans` (chamada logo acima) já aplicou a graça correta
 * por plano (N1) e marcou "expired" qualquer linha fora da janela — por isso
 * um simples status='active' aqui já é a resposta certa, sem repetir o
 * cálculo de graça uma segunda vez. */
export async function hasActivePlan(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  await expireDuePlans(userId);

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
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

/** Minutos restantes do plano ativo, sem o corte dos 3 dias (Fase B1 —
 * substitui o cálculo em dias como fonte de verdade, para planos sub-diários
 * ("ilimitado 12h") não ficarem sem forma correta de mostrar tempo restante). */
export async function getActivePlanTimeLeft(userId: string | null): Promise<number | null> {
  if (!userId) return null;
  const periodEnd = await getActiveSubscriptionEnd(userId);
  if (!periodEnd) return null;
  const msLeft = periodEnd - Date.now();
  if (msLeft <= 0) return null;
  return Math.max(1, Math.ceil(msLeft / MINUTE_MS));
}

type PlanPriceRow = {
  price_mzn: number;
  promo_price_mzn: number | null;
  is_promotional: boolean;
  promo_ends_at: string | null;
};

/** Preço efetivo de um plano (N2 do Guia B0-B5) — única fonte de preço para o
 * checkout (B3) e para `/planos` (B4). Devolve o preço promocional só enquanto
 * `promo_ends_at` estiver no futuro; caso contrário o preço base. O countdown
 * na UI e o valor cobrado bebem sempre da mesma função — nunca um selo
 * decorativo sem efeito no valor real. */
export function getEffectivePlanPrice(planRow: PlanPriceRow): number {
  if (
    planRow.is_promotional &&
    planRow.promo_ends_at &&
    new Date(planRow.promo_ends_at).getTime() > Date.now()
  ) {
    return planRow.promo_price_mzn ?? planRow.price_mzn;
  }
  return planRow.price_mzn;
}

/** Fórmula única de extensão de período (webhook PaySuite + concessão manual
 * admin, Fase A3). Fase B1: unidade passa de dias para minutos, para suportar
 * planos sub-diários ("ilimitado 12h") — os chamadores que ainda só têm um
 * número de dias convertem para minutos (`dias * 1440`) antes de chamar.
 * Nunca encurta um período já em curso, estende a partir do fim atual ou de
 * agora, o que for mais tarde. */
export function computeExtendedPeriodEnd(
  currentPeriodEndIso: string | null,
  periodMinutes: number,
): string {
  const currentEnd = currentPeriodEndIso ? new Date(currentPeriodEndIso).getTime() : 0;
  const base = Math.max(Date.now(), currentEnd);
  return new Date(base + periodMinutes * MINUTE_MS).toISOString();
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

export interface FairUseBypass {
  fairUseHourlyCap: number | null;
}

/** Bypass de fair-use do plano ativo (Fase B5, Q1/Q3/N3 do Guia B0-B5) — devolve
 * `null` quando o plano ativo não tem `bypasses_fair_use`. Exceção deliberada à
 * regra de edição prospetiva (Q3): este lookup é VIVO a cada pedido, nunca
 * cacheado — desligar `bypasses_fair_use` no admin corta o bypass imediatamente
 * para todos os assinantes ativos desse plano (kill switch de abuso), sem
 * esperar a próxima renovação. */
export async function getActiveFairUseBypass(userId: string | null): Promise<FairUseBypass | null> {
  if (!userId) return null;
  const sub = await getLatestActiveSubscription(userId);
  if (!sub) return null;

  const { data, error } = await supabaseAdmin
    .from("plan_prices")
    .select("bypasses_fair_use, fair_use_hourly_cap")
    .eq("plan", sub.plan)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.bypasses_fair_use) return null;
  return { fairUseHourlyCap: data.fair_use_hourly_cap };
}

/** Concede/estende um plano manualmente (Fase A3 do painel admin). Nunca
 * insere em `payments` — não houve pagamento real. `subscriptions` não tem
 * unique constraint em `user_id` (só PK em `id`, por desenho: uma linha por
 * checkout), por isso isto não é um upsert — procura a linha ativa atual e
 * estende-a, ou insere uma nova com `provider: 'admin'`.
 *
 * Fase B1: valida `plan` contra `plan_prices` ao vivo (existe, `enabled` e
 * `kind='subscription_unlimited'`) em vez de confiar numa união estática de
 * TypeScript — `plan` é uma string qualquer desde a B3 (SUBSCRIPTION_PLANS
 * removido), qualquer plano criado no admin passa por aqui sem alteração de
 * código. `periodDays` continua a ser o valor escolhido por quem chama
 * (mantém a flexibilidade já existente de conceder uma duração diferente da
 * do plano — a B3 pré-preenche este valor a partir do próprio plano, mas
 * continua a permitir override manual), só convertido para minutos
 * internamente. */
export async function adminGrantPlan(
  userId: string,
  plan: string,
  periodDays: number,
) {
  const { data: planRow, error: planError } = await supabaseAdmin
    .from("plan_prices")
    .select("enabled, kind")
    .eq("plan", plan)
    .maybeSingle();
  if (planError) throw new Error(planError.message);
  if (!planRow || !planRow.enabled || planRow.kind !== "subscription_unlimited") {
    throw new Error("Plano não encontrado ou desativado.");
  }

  const existing = await getLatestActiveSubscription(userId);
  const newPeriodEnd = computeExtendedPeriodEnd(
    existing?.current_period_end ?? null,
    periodDays * 1440,
  );

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
