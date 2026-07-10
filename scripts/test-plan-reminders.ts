/**
 * Dev-only: testa src/lib/plan-reminders.server.ts (via a rota
 * /api/cron/plan-reminders) sem esperar 3 dias nem ter RESEND_API_KEY real.
 * Cria uma subscription "active" com current_period_end já dentro da janela
 * de aviso (ou já expirada, com --expired), chama a rota do cron localmente,
 * e mostra o resultado. Sem RESEND_API_KEY configurada o envio falha com erro
 * claro (esperado — mesmo padrão do PaySuite, pronto mas a aguardar
 * credenciais) e nenhuma linha fica em plan_reminder_emails, por isso o
 * --repeat tenta reenviar em vez de pular. Com a chave real configurada,
 * --repeat deve mostrar `skipped` em vez de `sent` na segunda chamada
 * (idempotência por período).
 *
 * Uso (com o `bun dev` a correr noutro terminal):
 *   CRON_SECRET=segredo-local bun run scripts/test-plan-reminders.ts <userId> \
 *     [--expired] [--url=http://localhost:3000/api/cron/plan-reminders] [--repeat]
 *
 * <userId> tem de ser um UUID real de auth.users (FK obrigatória em
 * subscriptions.user_id, e o e-mail vem de lá) — visível no Supabase Studio
 * em Authentication → Users.
 */
import { supabaseAdmin } from "../src/integrations/supabase/client.server";

function parseArgs(argv: string[]) {
  const [userId, ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  for (const arg of rest) {
    const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (match) flags[match[1]] = match[2] ?? true;
  }
  return { userId, flags };
}

async function main() {
  const { userId, flags } = parseArgs(process.argv.slice(2));
  if (!userId) {
    console.error(
      "Uso: bun run scripts/test-plan-reminders.ts <userId> [--expired] [--url=...] [--repeat]",
    );
    process.exit(1);
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(
      "Define CRON_SECRET no ambiente — o mesmo valor que o servidor dev (`bun dev`) está a usar.",
    );
    process.exit(1);
  }

  const url =
    typeof flags.url === "string" ? flags.url : "http://localhost:3000/api/cron/plan-reminders";
  const repeat = !!flags.repeat;
  const expired = !!flags.expired;

  const DAY_MS = 24 * 60 * 60 * 1000;
  const periodEnd = new Date(Date.now() + (expired ? -DAY_MS : 2 * DAY_MS)).toISOString();

  const { data: subscription, error: subError } = await supabaseAdmin
    .from("subscriptions")
    .insert({
      user_id: userId,
      plan: "premium",
      status: "active",
      provider: "paysuite",
      current_period_end: periodEnd,
    })
    .select("id, current_period_end")
    .single();
  if (subError) throw new Error(subError.message);

  console.log(
    `Criada subscription ${subscription.id}, status=active, current_period_end=${subscription.current_period_end} (${expired ? "já expirada" : "expira em ~2 dias"}).`,
  );

  async function callCron(label: string) {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    console.log(`[${label}] cron respondeu ${res.status}:`, await res.text());
  }

  await callCron("1ª chamada");
  if (repeat) await callCron("2ª chamada (repetida — deve vir skipped, não sent, se a 1ª mandou)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
