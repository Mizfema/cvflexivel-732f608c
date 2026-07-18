import { createFileRoute } from "@tanstack/react-router";
import { reconcilePendingPayments } from "@/lib/payment-reconciliation.server";

/** Chamada periódica (pg_cron + pg_net no Supabase, ver migration) — paliativo
 * enquanto a entrega automática do webhook da PaySuite devolver 401 (bug do
 * lado deles, confirmado 15/07/2026). Autenticada por um secret partilhado
 * simples (não HMAC como o webhook) porque pg_net só faz um header fixo. */
export const Route = createFileRoute("/api/reconcile-payments")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PAYSUITE_RECONCILE_SECRET;
        const received = request.headers.get("x-reconcile-secret");
        if (!secret || !received || received !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const result = await reconcilePendingPayments();
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          return new Response(err instanceof Error ? err.message : "erro desconhecido", {
            status: 500,
          });
        }
      },
    },
  },
});
