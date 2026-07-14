import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { optionalIdentity, peekRemainingUsage } from "@/lib/access-control.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  hasActivePlan,
  getPlanExpiryWarning,
  getActivePlanDaysLeft,
  SUBSCRIPTION_PLANS,
} from "@/lib/subscription.server";
import { getActiveCreditBalance } from "@/lib/credits.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createPaymentRequest } from "@/lib/paysuite.server";

const DAY_MS = 24 * 60 * 60 * 1000;

const checkoutInputSchema = z.object({
  plan: z.enum(SUBSCRIPTION_PLANS).optional().default("mensal"),
});

const creditCheckoutInputSchema = z.object({
  plan: z.enum(["avulso", "recarga"]),
});

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

/** Preços/pacotes vivos em `plan_prices` (Fase 1 da Proposta V3) — a página
 * `/planos` nunca hardcoda valores, só lê esta tabela. `UPDATE` muda preço
 * sem deploy. */
export const getPlanPrices = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("plan_prices")
    .select("plan, price_mzn, period_days, credits, label, enabled")
    .eq("enabled", true);
  if (error) throw new Error(error.message);
  return data;
});

/** Saldo de créditos do avulso do utilizador autenticado, ou null se nunca
 * comprou ou o pacote já expirou (Fase 3 da Proposta V3 §8). */
export const getMyCreditBalance = createServerFn({ method: "GET" })
  .middleware([optionalIdentity])
  .handler(async ({ context }) => {
    if (!context.userId) return null;
    return getActiveCreditBalance(context.userId);
  });

/** Indicador da sidebar (Fase 2+3 da Proposta V3 §8): premium vê dias
 * restantes reais do plano; dono de pacote avulso vê saldo de créditos e
 * validade; grátis/anónimo vê análises restantes no mês. */
export const getSidebarStatus = createServerFn({ method: "GET" })
  .middleware([optionalIdentity])
  .handler(async ({ context }) => {
    if (!context.userId) return { tier: "anonymous" as const };

    const isPremium = await hasActivePlan(context.userId);
    if (isPremium) {
      const daysLeft = await getActivePlanDaysLeft(context.userId);
      return { tier: "premium" as const, daysLeft };
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
      .select("price_mzn, period_days, label")
      .eq("plan", data.plan)
      .eq("enabled", true)
      .maybeSingle();
    if (priceError) throw new Error(priceError.message);
    if (!planPrice || !planPrice.period_days) {
      throw new Error(`Plano "${data.plan}" indisponível de momento.`);
    }

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
        amount: planPrice.price_mzn,
        currency: "MZN",
        status: "pending",
        period_days: planPrice.period_days,
        plan: data.plan,
      })
      .select("id")
      .single();
    if (payError) throw new Error(payError.message);

    try {
      const result = await createPaymentRequest({
        amount: planPrice.price_mzn,
        reference,
        description: `${planPrice.label} — CV Flexível (${planPrice.period_days} dias)`,
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
      .select("price_mzn, credits, label")
      .eq("plan", data.plan)
      .eq("enabled", true)
      .maybeSingle();
    if (priceError) throw new Error(priceError.message);
    if (!planPrice || !planPrice.credits) {
      throw new Error(`Pacote "${data.plan}" indisponível de momento.`);
    }

    const request = getRequest();
    const origin = request ? new URL(request.url).origin : "";
    const reference = `cv-${context.userId.slice(0, 8)}-${data.plan}-${Date.now()}`;

    const { data: payment, error: payError } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: context.userId,
        provider: "paysuite",
        reference,
        amount: planPrice.price_mzn,
        currency: "MZN",
        status: "pending",
        plan: data.plan,
      })
      .select("id")
      .single();
    if (payError) throw new Error(payError.message);

    try {
      const result = await createPaymentRequest({
        amount: planPrice.price_mzn,
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
