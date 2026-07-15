import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getPaymentStatus } from "@/lib/paysuite.server";
import { grantCredits } from "@/lib/credits.server";
import { computeExtendedPeriodEnd } from "@/lib/subscription.server";

const MINUTE_MS = 60 * 1000;
// Fallback só para pagamentos criados antes da coluna payments.period_days existir.
const FALLBACK_PERIOD_DAYS = 30;

/** Confirma um pagamento "pending" da PaySuite (extensão de subscription ou
 * crédito de pacote) — extraído do handler do webhook para ser reutilizável
 * também pelo job de reconciliação (src/routes/api/reconcile-payments.ts),
 * já que a entrega automática do webhook da PaySuite está a falhar com 401
 * (bug do lado deles, confirmado 15/07/2026 — reassinar manualmente com o
 * mesmo secret funciona sempre). UPDATE condicional WHERE status='pending'
 * garante idempotência entre o webhook (se algum dia voltar a funcionar) e
 * o job de reconciliação correndo em paralelo. */
export async function confirmPendingPayment(
  paymentRef: string,
  method: string | null,
  paidAt: string,
): Promise<{ status: number; message: string }> {
  const { data: payment, error: findError } = await supabaseAdmin
    .from("payments")
    .select("id, user_id, subscription_id, period_days, period_minutes, plan_kind, plan")
    .eq("provider_ref", paymentRef)
    .maybeSingle();
  if (findError) return { status: 500, message: findError.message };
  if (!payment) return { status: 404, message: "Pagamento não encontrado" };

  const { data: confirmedPayment, error: payErr } = await supabaseAdmin
    .from("payments")
    .update({ status: "confirmed", method, paid_at: paidAt })
    .eq("id", payment.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (payErr) return { status: 500, message: payErr.message };

  // Já processado (webhook ou reconciliação anterior) — idempotente.
  if (!confirmedPayment) return { status: 200, message: "já confirmado" };

  if (payment.subscription_id) {
    const { data: subscription, error: subFetchErr } = await supabaseAdmin
      .from("subscriptions")
      .select("current_period_end")
      .eq("id", payment.subscription_id)
      .single();
    if (subFetchErr) return { status: 500, message: subFetchErr.message };

    const periodMinutes =
      payment.period_minutes ??
      (payment.period_days != null ? payment.period_days * 1440 : FALLBACK_PERIOD_DAYS * 1440);
    const newPeriodEnd = computeExtendedPeriodEnd(subscription.current_period_end, periodMinutes);

    const { error: subErr } = await supabaseAdmin
      .from("subscriptions")
      .update({ status: "active", current_period_end: newPeriodEnd })
      .eq("id", payment.subscription_id);
    if (subErr) return { status: 500, message: subErr.message };
  } else if (
    payment.plan_kind ? payment.plan_kind === "credit_pack" : payment.plan === "avulso" || payment.plan === "recarga"
  ) {
    if (!payment.plan) return { status: 500, message: "payments.plan em falta para compra de créditos" };

    const { data: planPrice, error: priceErr } = await supabaseAdmin
      .from("plan_prices")
      .select("credits, period_minutes")
      .eq("plan", payment.plan)
      .maybeSingle();
    if (priceErr) return { status: 500, message: priceErr.message };
    if (!planPrice?.credits) return { status: 500, message: `plan_prices sem créditos para "${payment.plan}"` };

    try {
      await grantCredits(
        payment.user_id,
        planPrice.credits,
        payment.plan,
        payment.plan === "recarga" ? "recharge" : "purchase",
        payment.plan === "avulso"
          ? new Date(Date.now() + (planPrice.period_minutes ?? FALLBACK_PERIOD_DAYS * 1440) * MINUTE_MS)
          : undefined,
      );
    } catch (err) {
      return { status: 500, message: err instanceof Error ? err.message : "Falha ao creditar" };
    }
  }

  return { status: 200, message: "ok" };
}

export async function markPendingPaymentFailed(paymentRef: string): Promise<void> {
  await supabaseAdmin
    .from("payments")
    .update({ status: "failed" })
    .eq("provider_ref", paymentRef)
    .eq("status", "pending");
}

/** Job de reconciliação (Fase paliativa, 15/07/2026): a entrega automática do
 * webhook da PaySuite está a devolver 401 em toda transação real testada —
 * bug confirmado do lado deles (reassinar manualmente com o mesmo secret
 * sempre funciona). Enquanto o suporte deles não resolve, esta função
 * consulta GET /payments/{id} para cada pagamento "pending" com provider_ref,
 * e confirma os que a PaySuite já marcou como completed — mesma lógica do
 * webhook, chamada aqui em vez de esperar a entrega deles. Só age em
 * "completed" (nunca infere "failed" a partir do polling — não observámos
 * ainda os valores exatos que a PaySuite usa para transações falhadas, mais
 * seguro deixar como está do que marcar failed errado). */
export async function reconcilePendingPayments(): Promise<{
  checked: number;
  confirmed: number;
  errors: Array<{ reference: string; message: string }>;
}> {
  const cutoff = new Date(Date.now() - 30 * 1000).toISOString();
  const { data: pending, error } = await supabaseAdmin
    .from("payments")
    .select("reference, provider_ref")
    .eq("status", "pending")
    .not("provider_ref", "is", null)
    .lt("created_at", cutoff);
  if (error) throw new Error(error.message);

  let confirmed = 0;
  const errors: Array<{ reference: string; message: string }> = [];

  for (const payment of pending ?? []) {
    if (!payment.provider_ref) continue;
    try {
      const status = await getPaymentStatus(payment.provider_ref);
      if (status.transaction?.status === "completed") {
        const result = await confirmPendingPayment(
          payment.provider_ref,
          status.transaction.method ?? null,
          status.transaction.paid_at ?? new Date().toISOString(),
        );
        if (result.status === 200) confirmed++;
        else errors.push({ reference: payment.reference, message: result.message });
      }
    } catch (err) {
      errors.push({
        reference: payment.reference,
        message: err instanceof Error ? err.message : "erro desconhecido",
      });
    }
  }

  return { checked: pending?.length ?? 0, confirmed, errors };
}
