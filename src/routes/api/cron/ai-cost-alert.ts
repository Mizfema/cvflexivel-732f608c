import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { checkDailyAiCostAndAlert } from "@/lib/ai-cost-alert.server";

/** Gatilho do fail-safe de custo diário (Fase 0 da Proposta V3 §6, item 5).
 * Mesmo padrão de src/routes/api/cron/plan-reminders.ts (CRON_SECRET), mas
 * pensado para correr de hora a hora em vez de 1x/dia — ver SQL de
 * cron.schedule sugerido em docs/PLANO-EXECUCAO.md. */
export const Route = createFileRoute("/api/cron/ai-cost-alert")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const authHeader = request.headers.get("authorization");
        if (!secret || authHeader !== `Bearer ${secret}`) {
          return new Response("Não autorizado", { status: 401 });
        }

        const result = await checkDailyAiCostAndAlert();
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
