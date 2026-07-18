import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { runPlanReminders } from "@/lib/plan-reminders.server";

/** Gatilho do motor de lembretes (Fase 1.4d item 1). Protegido por CRON_SECRET
 * em vez de assinatura HMAC (não há payload de terceiros aqui, só um
 * disparo periódico) — chamado 1x/dia por pg_cron+pg_net do próprio Supabase
 * (ver instruções em docs/PLANO-EXECUCAO.md secção 1.4) ou por qualquer cron
 * externo equivalente. */
export const Route = createFileRoute("/api/cron/plan-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const authHeader = request.headers.get("authorization");
        if (!secret || authHeader !== `Bearer ${secret}`) {
          return new Response("Não autorizado", { status: 401 });
        }

        const result = await runPlanReminders();
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
