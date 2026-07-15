import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { optionalIdentity, peekRemainingUsage } from "@/lib/access-control.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  hasActivePlan,
  getPlanExpiryWarning,
  getActivePlanTimeLeft,
  getEffectivePlanPrice,
} from "@/lib/subscription.server";
import { getActiveCreditBalance } from "@/lib/credits.server";
import { checkIsAdmin } from "@/lib/admin-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createPaymentRequest } from "@/lib/paysuite.server";

const DAY_MS = 24 * 60 * 60 * 1000;

// Fase B3: plan deixa de ser um union estático (SUBSCRIPTION_PLANS removido) —
// validado em runtime contra plan_prices (existe + enabled + kind certo) em vez
// de um enum do TypeScript, para qualquer plano novo criado no admin funcionar
// em checkout sem alteração de código.
const checkoutInputSchema = z.object({
  plan: z.string().trim().min(1).optional().default("mensal"),
});

const creditCheckoutInputSchema = z.object({
  plan: z.string().trim().min(1),
});

/** Copy da descrição de pagamento (PaySuite) — period_minutes substitui
 * period_days como fonte canónica (Fase B3), planos sub-diários mostram horas. */
function formatDurationForDescription(periodMinutes: number): string {
  if (periodMinutes % 1440 === 0) {
    const days = periodMinutes / 1440;
    return `${days} dia${days === 1 ? "" : "s"}`;
  }
  const hours = Math.round(periodMinutes / 60);
  return `${hours}h`;
}

/** Usado pelo cliente para decidir entre vitrine e funcionalidade completa
 * (ex: preparação de entrevista). Sessão é opcional (anónimo também não tem
 * plano). A verificação que realmente importa continua server-side em
 * requireUsageAllowed/hasActivePlan. */
export const getMyPlanStatus = createServerFn({ method: "GET" })
  .middleware([optionalIdentity])
  .handler(async ({ context }) => ({
    isPremium: await hasActivePlan(context.userId),
    expiryWarning: await getPlanExpiryWarning(context.userId),
  }));

/** Preços/pacotes vivos em `plan_prices` (Fase 1 da Proposta V3, allowlist
 * pública da Fase B4/N3 do Guia B0-B5) — a página `/planos` nunca hardcoda
 * valores, só lê esta função. `bypasses_fair_use`/`fair_use_hourly_cap` e
 * planos desativados/ocultos NUNCA chegam ao browser de um visitante — só os
 * campos selecionados abaixo saem daqui. Ordenado por `display_order` para um
 * plano novo criado no admin aparecer na posição certa sem deploy. */
export const getPlanPrices = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("plan_prices")
    .select(
      "plan, label, kind, price_mzn, promo_price_mzn, is_promotional, promo_badge_text, promo_ends_at, period_minutes, credits, features, display_order",
    )
    .eq("enabled", true)
    .eq("visible_on_pricing_page", true)
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  // promo_price_mzn nunca sai daqui — o browser só recebe o preço efetivo já
  // calculado (N2); o valor promocional em si não é um campo público.
  return data.map(({ promo_price_mzn, ...row }) => ({
    ...row,
    kind: row.kind as "subscription_unlimited" | "credit_pack",
    features: (row.features as string[] | null) ?? [],
    effective_price_mzn: getEffectivePlanPrice({ ...row, promo_price_mzn }),
  }));
});

/** Saldo de créditos do avulso do utilizador autenticado, ou null se nunca
 * comprou ou o pacote já expirou (Fase 3 da Proposta V3 §8). */
export const getMyCreditBalance = createServerFn({ method: "GET" })
  .middleware([optionalIdentity])
  .handler(async ({ context }) => {
    if (!context.userId) return null;
    return getActiveCreditBalance(context.userId);
  });

/** Indicador da sidebar (Fase 2+3 da Proposta V3 §8; minutos desde a Fase B4
 * do Guia B0-B5): premium vê tempo restante real do plano (dias ou horas,
 * conforme a duração — um "ilimitado 12h" nunca pode mostrar "0 dias"); dono
 * de pacote avulso vê saldo de créditos e validade; grátis/anónimo vê
 * análises restantes no mês. */
export const getSidebarStatus = createServerFn({ method: "GET" })
  .middleware([optionalIdentity])
  .handler(async ({ context }) => {
    if (!context.userId) return { tier: "anonymous" as const };

    // Admin tem geração ilimitada (access-control.server.ts) — mostra o
    // mesmo badge "Premium · Ilimitado" em vez de análises restantes do
    // grátis, que seria enganoso.
    if (await checkIsAdmin(context.userId)) {
      return { tier: "premium" as const, minutesLeft: null };
    }

    const isPremium = await hasActivePlan(context.userId);
    if (isPremium) {
      const minutesLeft = await getActivePlanTimeLeft(context.userId);
      return { tier: "premium" as const, minutesLeft };
    }

    const credits = await getActiveCreditBalance(context.userId);
    if (credits) {
      const daysLeft = Math.max(
        1,
        Math.ceil((new Date(credits.expiresAt).getTime() - Date.now()) / DAY_MS),
      );
      return { tier: "avulso" as const, balance: credits.balance, daysLeft };
    }

    const { remainingMonth } = await peekRemainingUsage("cv_analysis", context.userId, null);
    return { tier: "free" as const, analysesRemaining: remainingMonth };
  });

/** Fase 1 da Proposta V3 (docs/PROPOSTA-V3-FINAL-CONSOLIDADA.md §8): cria a
 * intenção de assinatura (subscriptions+payments em "pending") e devolve o
 * checkout_url da PaySuite para o cliente redirecionar. Preço e período vêm
 * de `plan_prices` (UPDATE muda preço, nunca deploy) — nunca hardcoded nem em
 * env var. O método de pagamento (M-Pesa/e-Mola/mKesh/cartão) é escolhido no
 * checkout hospedado da PaySuite, não aqui. A confirmação real chega pelo
 * webhook (src/routes/api/paysuite-webhook.ts), nunca por este pedido — este
 * só inicia o fluxo. */
export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => checkoutInputSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { data: planPrice, error: priceError } = await supabaseAdmin
      .from("plan_prices")
      .select("price_mzn, period_minutes, label, is_promotional, promo_ends_at, promo_price_mzn")
      .eq("plan", data.plan)
      .eq("kind", "subscription_unlimited")
      .eq("enabled", true)
      .maybeSingle();
    if (priceError) throw new Error(priceError.message);
    if (!planPrice || !planPrice.period_minutes) {
      throw new Error(`Plano "${data.plan}" indisponível de momento.`);
    }
    // Fase B3 (N2): o valor cobrado vem sempre de getEffectivePlanPrice — nunca do
    // cliente — para a promoção expirar mecanicamente sem depender de UI nenhuma.
    const amount = getEffectivePlanPrice(planPrice);

    const request = getRequest();
    const origin = request ? new URL(request.url).origin : "";
    // Referência única: user + plano + período (timestamp de criação).
    const reference = `cv-${context.userId.slice(0, 8)}-${data.plan}-${Date.now()}`;

    const { data: subscription, error: subError } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        user_id: context.userId,
        plan: data.plan,
        status: "pending",
        provider: "paysuite",
      })
      .select("id")
      .single();
    if (subError) throw new Error(subError.message);

    const { data: payment, error: payError } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: context.userId,
        subscription_id: subscription.id,
        provider: "paysuite",
        reference,
        amount,
        currency: "MZN",
        status: "pending",
        period_minutes: planPrice.period_minutes,
        plan_kind: "subscription_unlimited",
        plan: data.plan,
      })
      .select("id")
      .single();
    if (payError) throw new Error(payError.message);

    try {
      const result = await createPaymentRequest({
        amount,
        reference,
        description: `${planPrice.label} — CV Flexível (${formatDurationForDescription(planPrice.period_minutes)})`,
        returnUrl: `${origin}/planos?checkout=${subscription.id}`,
        callbackUrl: `${origin}/api/paysuite-webhook`,
      });

      await supabaseAdmin.from("payments").update({ provider_ref: result.id }).eq("id", payment.id);
      await supabaseAdmin
        .from("subscriptions")
        .update({ provider_ref: result.id })
        .eq("id", subscription.id);

      if (!result.checkout_url) {
        throw new Error("PaySuite não devolveu um checkout_url.");
      }
      return { checkoutUrl: result.checkout_url };
    } catch (err) {
      await supabaseAdmin.from("payments").update({ status: "failed" }).eq("id", payment.id);
      throw new Error(
        `Não foi possível iniciar o pagamento: ${err instanceof Error ? err.message : "erro desconhecido"}`,
      );
    }
  });

/** Fase 3 da Proposta V3 (docs/PROPOSTA-V3-FINAL-CONSOLIDADA.md §8): cria a
 * intenção de compra de créditos (avulso ou recarga) — sem `subscription_id`,
 * porque não é assinatura ilimitada. O webhook credita `credit_balances`
 * quando a PaySuite confirmar o pagamento (nunca aqui, este só inicia o
 * fluxo). Recarga exige um pacote avulso ativo, porque "herda a validade do
 * pacote activo" (§2 do doc V3) — sem pacote não há validade a herdar. */
export const createCreditCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => creditCheckoutInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (data.plan === "recarga") {
      const balance = await getActiveCreditBalance(context.userId);
      if (!balance) {
        throw new Error("A recarga só está disponível para quem já tem um pacote avulso ativo.");
      }
    }

    const { data: planPrice, error: priceError } = await supabaseAdmin
      .from("plan_prices")
      .select("price_mzn, credits, label, is_promotional, promo_ends_at, promo_price_mzn")
      .eq("plan", data.plan)
      .eq("kind", "credit_pack")
      .eq("enabled", true)
      .maybeSingle();
    if (priceError) throw new Error(priceError.message);
    if (!planPrice || !planPrice.credits) {
      throw new Error(`Pacote "${data.plan}" indisponível de momento.`);
    }
    const amount = getEffectivePlanPrice(planPrice);

    const request = getRequest();
    const origin = request ? new URL(request.url).origin : "";
    const reference = `cv-${context.userId.slice(0, 8)}-${data.plan}-${Date.now()}`;

    const { data: payment, error: payError } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: context.userId,
        provider: "paysuite",
        reference,
        amount,
        currency: "MZN",
        status: "pending",
        plan_kind: "credit_pack",
        plan: data.plan,
      })
      .select("id")
      .single();
    if (payError) throw new Error(payError.message);

    try {
      const result = await createPaymentRequest({
        amount,
        reference,
        description: `${planPrice.label} — CV Flexível (+${planPrice.credits} créditos)`,
        returnUrl: `${origin}/planos?checkout=${payment.id}`,
        callbackUrl: `${origin}/api/paysuite-webhook`,
      });

      await supabaseAdmin.from("payments").update({ provider_ref: result.id }).eq("id", payment.id);

      if (!result.checkout_url) {
        throw new Error("PaySuite não devolveu um checkout_url.");
      }
      return { checkoutUrl: result.checkout_url };
    } catch (err) {
      await supabaseAdmin.from("payments").update({ status: "failed" }).eq("id", payment.id);
      throw new Error(
        `Não foi possível iniciar o pagamento: ${err instanceof Error ? err.message : "erro desconhecido"}`,
      );
    }
  });
