import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyWebhookSignature } from "@/lib/paysuite.server";

const PLAN_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

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
          .select("id, subscription_id")
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

            const currentEnd = subscription.current_period_end
              ? new Date(subscription.current_period_end).getTime()
              : 0;
            const base = Math.max(Date.now(), currentEnd);
            const newPeriodEnd = new Date(base + PLAN_PERIOD_MS).toISOString();

            const { error: subErr } = await supabaseAdmin
              .from("subscriptions")
              .update({ status: "active", current_period_end: newPeriodEnd })
              .eq("id", payment.subscription_id);
            if (subErr) return new Response(subErr.message, { status: 500 });
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
