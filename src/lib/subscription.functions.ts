import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { optionalIdentity } from "@/lib/access-control.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasActivePlan, getPlanExpiryWarning } from "@/lib/subscription.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createPaymentRequest } from "@/lib/paysuite.server";

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

/** Fase 1.4c: cria a intenção de assinatura (subscriptions+payments em
 * "pending") e devolve o checkout_url da PaySuite para o cliente redirecionar.
 * O método de pagamento (M-Pesa/e-Mola/mKesh/cartão) é escolhido no checkout
 * hospedado da PaySuite, não aqui. A confirmação real chega pelo webhook
 * (src/routes/api/paysuite-webhook.ts), nunca por este pedido — este só inicia
 * o fluxo. */
export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const priceMzn = Number(process.env.PLAN_PRICE_MZN);
    if (!priceMzn || Number.isNaN(priceMzn)) {
      throw new Error(
        "Preço do plano (PLAN_PRICE_MZN) ainda não configurado. Aguardando decisão de preço.",
      );
    }

    const request = getRequest();
    const origin = request ? new URL(request.url).origin : "";
    // Referência única: user + plano + período (timestamp de criação).
    const reference = `cv-${context.userId.slice(0, 8)}-premium-${Date.now()}`;

    const { data: subscription, error: subError } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        user_id: context.userId,
        plan: "premium",
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
        amount: priceMzn,
        currency: "MZN",
        status: "pending",
      })
      .select("id")
      .single();
    if (payError) throw new Error(payError.message);

    try {
      const result = await createPaymentRequest({
        amount: priceMzn,
        reference,
        description: "Plano Premium — CV Flexível (30 dias)",
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
