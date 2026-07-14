import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyWebhookSignature } from "@/lib/paysuite.server";
import { grantCredits } from "@/lib/credits.server";
import { computeExtendedPeriodEnd } from "@/lib/subscription.server";

const MINUTE_MS = 60 * 1000;
// Fallback só para pagamentos criados antes da coluna payments.period_days
// existir (Fase 1 da Proposta V3) — nunca deveria disparar para pagamentos novos.
const FALLBACK_PERIOD_DAYS = 30;

interface PaySuiteWebhookPayload {
  event: "payment.success" | "payment.failed" | string;
  data?: { id?: string; method?: string; paid_at?: string };
  request_id?: string;
}

export const Route = createFileRoute("/api/paysuite-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-webhook-signature");

        if (!verifyWebhookSignature(rawBody, signature)) {
          return new Response("Assinatura inválida", { status: 401 });
        }

        let payload: PaySuiteWebhookPayload;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("JSON inválido", { status: 400 });
        }

        const paymentRef = payload.request_id ?? payload.data?.id;
        if (!paymentRef) {
          return new Response("Sem referência de pagamento", { status: 400 });
        }

        const { data: payment, error: findError } = await supabaseAdmin
          .from("payments")
          .select("id, user_id, subscription_id, period_days, period_minutes, plan_kind, plan")
          .eq("provider_ref", paymentRef)
          .maybeSingle();
        if (findError) return new Response(findError.message, { status: 500 });
        if (!payment) return new Response("Pagamento não encontrado", { status: 404 });

        if (payload.event === "payment.success") {
          // UPDATE condicional (WHERE status='pending'): só a primeira entrega do
          // webhook confirma e estende o período — retries subsequentes (a PaySuite
          // tenta até 5x) não fazem nada porque a linha já não está "pending".
          const { data: confirmedPayment, error: payErr } = await supabaseAdmin
            .from("payments")
            .update({
              status: "confirmed",
              method: payload.data?.method ?? null,
              paid_at: payload.data?.paid_at ?? new Date().toISOString(),
            })
            .eq("id", payment.id)
            .eq("status", "pending")
            .select("id")
            .maybeSingle();
          if (payErr) return new Response(payErr.message, { status: 500 });

          // Já processado por uma entrega anterior — idempotente, responde ok sem repetir.
          if (!confirmedPayment) return new Response("ok", { status: 200 });

          if (payment.subscription_id) {
            const { data: subscription, error: subFetchErr } = await supabaseAdmin
              .from("subscriptions")
              .select("current_period_end")
              .eq("id", payment.subscription_id)
              .single();
            if (subFetchErr) return new Response(subFetchErr.message, { status: 500 });

            // Fase B3: period_minutes é o snapshot canónico (suporta planos sub-diários);
            // fallback a period_days*1440 só para pagamentos criados antes desta fase.
            const periodMinutes =
              payment.period_minutes ??
              (payment.period_days != null ? payment.period_days * 1440 : FALLBACK_PERIOD_DAYS * 1440);
            const newPeriodEnd = computeExtendedPeriodEnd(
              subscription.current_period_end,
              periodMinutes,
            );

            const { error: subErr } = await supabaseAdmin
              .from("subscriptions")
              .update({ status: "active", current_period_end: newPeriodEnd })
              .eq("id", payment.subscription_id);
            if (subErr) return new Response(subErr.message, { status: 500 });
          } else if (
            // Fase B3: plan_kind é o snapshot canónico; fallback ao string-check antigo só
            // para pagamentos criados antes desta fase (plan_kind null).
            payment.plan_kind
              ? payment.plan_kind === "credit_pack"
              : payment.plan === "avulso" || payment.plan === "recarga"
          ) {
            // Fase 3 da Proposta V3: compra de créditos (sem subscription_id).
            // Fase B1: validade dos créditos migrada de period_days para period_minutes
            // (único caminho do sistema que deriva credit_balances.expires_at de
            // plan_prices ao vivo, em vez de um snapshot — mapeado no Passo 0 da B0).
            if (!payment.plan) {
              return new Response("payments.plan em falta para compra de créditos", {
                status: 500,
              });
            }

            const { data: planPrice, error: priceErr } = await supabaseAdmin
              .from("plan_prices")
              .select("credits, period_minutes")
              .eq("plan", payment.plan)
              .maybeSingle();
            if (priceErr) return new Response(priceErr.message, { status: 500 });
            if (!planPrice?.credits) {
              return new Response(`plan_prices sem créditos para "${payment.plan}"`, {
                status: 500,
              });
            }

            try {
              await grantCredits(
                payment.user_id,
                planPrice.credits,
                payment.plan,
                payment.plan === "recarga" ? "recharge" : "purchase",
                payment.plan === "avulso"
                  ? new Date(
                      Date.now() +
                        (planPrice.period_minutes ?? FALLBACK_PERIOD_DAYS * 1440) * MINUTE_MS,
                    )
                  : undefined,
              );
            } catch (err) {
              return new Response(err instanceof Error ? err.message : "Falha ao creditar", {
                status: 500,
              });
            }
          }
        } else if (payload.event === "payment.failed") {
          const { error: payErr } = await supabaseAdmin
            .from("payments")
            .update({ status: "failed" })
            .eq("id", payment.id)
            .eq("status", "pending");
          if (payErr) return new Response(payErr.message, { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
