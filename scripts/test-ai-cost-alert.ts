/**
 * Dev-only: testa src/lib/ai-cost-alert.server.ts (via a rota
 * /api/cron/ai-cost-alert) sem esperar o custo real do dia ultrapassar o
 * limiar. Insere uma linha de ai_usage de hoje com cost_usd já acima do
 * limiar (AI_DAILY_COST_ALERT_USD, default 5), chama a rota do cron
 * localmente, e mostra o resultado. Sem RESEND_API_KEY/ADMIN_ALERT_EMAIL
 * configurados o envio falha com erro claro (esperado — mesmo padrão do
 * PaySuite/plan-reminders) e nenhuma linha fica em ai_cost_alerts, por isso
 * o --repeat tenta reenviar em vez de pular. Com as env vars reais
 * configuradas, --repeat deve mostrar `alreadyAlerted: true` em vez de
 * `alerted: true` na segunda chamada (idempotência por dia).
 *
 * Uso (com o `bun dev` a correr noutro terminal):
 *   CRON_SECRET=segredo-local bun run scripts/test-ai-cost-alert.ts \
 *     [--url=http://localhost:3000/api/cron/ai-cost-alert] [--repeat]
 */
import { supabaseAdmin } from "../src/integrations/supabase/client.server";

function parseArgs(argv: string[]) {
  const flags: Record<string, string | boolean> = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (match) flags[match[1]] = match[2] ?? true;
  }
  return flags;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(
      "Define CRON_SECRET no ambiente — o mesmo valor que o servidor dev (`bun dev`) está a usar.",
    );
    process.exit(1);
  }

  const url =
    typeof flags.url === "string" ? flags.url : "http://localhost:3000/api/cron/ai-cost-alert";
  const repeat = !!flags.repeat;
  const thresholdUsd = Number(process.env.AI_DAILY_COST_ALERT_USD) || 5;
  const costAboveThreshold = thresholdUsd + 1;

  const { error: insertErr } = await supabaseAdmin.from("ai_usage").insert({
    feature: "cv_analysis",
    anon_fingerprint: "test-ai-cost-alert-script",
    tokens_in: 1000,
    tokens_out: 1000,
    cost_usd: costAboveThreshold,
  });
  if (insertErr) throw new Error(insertErr.message);

  console.log(
    `Inserida linha de ai_usage de hoje com cost_usd=${costAboveThreshold} (limiar=${thresholdUsd}).`,
  );

  async function callCron(label: string) {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    console.log(`[${label}] cron respondeu ${res.status}:`, await res.text());
  }

  await callCron("1ª chamada");
  if (repeat) await callCron("2ª chamada (repetida — deve vir alreadyAlerted, não alerted, se a 1ª mandou)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
