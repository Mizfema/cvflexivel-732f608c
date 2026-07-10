import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { optionalIdentity } from "@/lib/access-control.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasActivePlan, getPlanExpiryWarning } from "@/lib/subscription.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createPaymentRequest, type PaySuiteMethod } from "@/lib/paysuite.server";

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

const PAYMENT_METHODS = ["mpesa", "emola", "mkesh", "card"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const checkoutInputSchema = z.object({
  paymentMethod: z.enum(PAYMENT_METHODS),
});

function toPaySuiteMethod(method: PaymentMethod): PaySuiteMethod | undefined {
  if (method === "card") return "credit_card";
  if (method === "mkesh") return undefined; // não listado no parâmetro `method` da API; usuário escolhe no checkout hospedado.
  return method;
}

/** Fase 1.4c: cria a intenção de assinatura (subscriptions+payments em
 * "pending") e devolve o checkout_url da PaySuite para o cliente redirecionar.
 * A confirmação real chega pelo webhook (src/routes/api/paysuite-webhook.ts),
 * nunca por este pedido — este só inicia o fluxo. */
export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => checkoutInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const priceMzn = Number(process.env.PLAN_PRICE_MZN);
    if (!priceMzn || Number.isNaN(priceMzn)) {
      throw new Error(
        "Preço do plano (PLAN_PRICE_MZN) ainda não configurado. Aguardando decisão de preço.",
      );
    }

    const request = getRequest();
    const origin = request ? new URL(request.url).origin : "";
    const reference = `cv-${context.userId.slice(0, 8)}-${Date.now()}`;

    const { data: subscription, error: subError } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        user_id: context.userId,
        plan: "premium",
        status: "pending",
        provider: "paysuite",
        payment_method: data.paymentMethod,
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
        payment_method: data.paymentMethod,
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
        method: toPaySuiteMethod(data.paymentMethod),
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
