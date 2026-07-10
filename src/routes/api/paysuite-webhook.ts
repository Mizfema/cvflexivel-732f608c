import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyWebhookSignature } from "@/lib/paysuite.server";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface PaySuiteWebhookPayload {
  event: "payment.success" | "payment.failed" | string;
  data?: { id?: string };
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
          .select("id, status, subscription_id")
          .eq("provider_ref", paymentRef)
          .maybeSingle();
        if (findError) return new Response(findError.message, { status: 500 });
        if (!payment) return new Response("Pagamento não encontrado", { status: 404 });

        // Idempotente: webhook pode reentregar o mesmo evento (até 5 tentativas).
        if (payment.status !== "pending") {
          return new Response("ok", { status: 200 });
        }

        if (payload.event === "payment.success") {
          const { error: payErr } = await supabaseAdmin
            .from("payments")
            .update({ status: "confirmed" })
            .eq("id", payment.id);
          if (payErr) return new Response(payErr.message, { status: 500 });

          if (payment.subscription_id) {
            const { error: subErr } = await supabaseAdmin
              .from("subscriptions")
              .update({
                status: "active",
                current_period_end: new Date(Date.now() + THIRTY_DAYS_MS).toISOString(),
              })
              .eq("id", payment.subscription_id);
            if (subErr) return new Response(subErr.message, { status: 500 });
          }
        } else if (payload.event === "payment.failed") {
          const { error: payErr } = await supabaseAdmin
            .from("payments")
            .update({ status: "failed" })
            .eq("id", payment.id);
          if (payErr) return new Response(payErr.message, { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
