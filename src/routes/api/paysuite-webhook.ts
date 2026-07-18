import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookSignature } from "@/lib/paysuite.server";
import { confirmPendingPayment, markPendingPaymentFailed } from "@/lib/payment-reconciliation.server";

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

        if (payload.event === "payment.success") {
          const result = await confirmPendingPayment(
            paymentRef,
            payload.data?.method ?? null,
            payload.data?.paid_at ?? new Date().toISOString(),
          );
          return new Response(result.message, { status: result.status });
        } else if (payload.event === "payment.failed") {
          await markPendingPaymentFailed(paymentRef);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
