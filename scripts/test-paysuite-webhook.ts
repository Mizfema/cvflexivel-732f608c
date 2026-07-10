/**
 * Dev-only: testa src/routes/api/paysuite-webhook.ts sem depender de sandbox
 * da PaySuite (não existe). Cria uma subscription+payment "pending" reais na
 * BD, assina um payload payment.success (ou payment.failed) com HMAC-SHA256
 * usando PAYSUITE_WEBHOOK_SECRET, faz POST ao webhook local, e mostra o
 * estado da subscription antes/depois — para validar a extensão de
 * current_period_end e a idempotência sem um pagamento real.
 *
 * Uso (com o `bun dev` a correr noutro terminal):
 *   PAYSUITE_WEBHOOK_SECRET=segredo-local bun run scripts/test-paysuite-webhook.ts <userId> \
 *     [--event=payment.success|payment.failed] [--url=http://localhost:3000/api/paysuite-webhook] [--repeat]
 *
 * <userId> tem de ser um UUID real de auth.users (FK obrigatória em
 * subscriptions.user_id) — usa o teu próprio id, visível no Supabase Studio
 * em Authentication → Users. --repeat reenvia o mesmo payload para confirmar
 * que a segunda entrega não estende o período outra vez (idempotência).
 */
import { createHmac } from "node:crypto";
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
      "Uso: bun run scripts/test-paysuite-webhook.ts <userId> [--event=payment.success|payment.failed] [--url=...] [--repeat]",
    );
    process.exit(1);
  }

  const secret = process.env.PAYSUITE_WEBHOOK_SECRET;
  if (!secret) {
    console.error(
      "Define PAYSUITE_WEBHOOK_SECRET no ambiente — o mesmo valor que o servidor dev (`bun dev`) está a usar.",
    );
    process.exit(1);
  }

  const event = typeof flags.event === "string" ? flags.event : "payment.success";
  const url =
    typeof flags.url === "string" ? flags.url : "http://localhost:3000/api/paysuite-webhook";
  const repeat = !!flags.repeat;

  const providerRef = `test-${Date.now()}`;
  const reference = `test-ref-${Date.now()}`;

  const { data: subscription, error: subError } = await supabaseAdmin
    .from("subscriptions")
    .insert({ user_id: userId, plan: "premium", status: "pending", provider: "paysuite" })
    .select("id, current_period_end")
    .single();
  if (subError) throw new Error(subError.message);

  const { data: payment, error: payError } = await supabaseAdmin
    .from("payments")
    .insert({
      user_id: userId,
      subscription_id: subscription.id,
      provider: "paysuite",
      reference,
      provider_ref: providerRef,
      amount: Number(process.env.PLAN_PRICE_MZN) || 500,
      currency: "MZN",
      status: "pending",
    })
    .select("id")
    .single();
  if (payError) throw new Error(payError.message);

  console.log(
    `Criado subscription ${subscription.id} + payment ${payment.id} (provider_ref=${providerRef}), status=pending, current_period_end=${subscription.current_period_end ?? "null"}.`,
  );

  const payload = JSON.stringify({
    event,
    data: { id: providerRef, method: "mpesa", paid_at: new Date().toISOString() },
    created_at: Math.floor(Date.now() / 1000),
    request_id: providerRef,
  });
  const signature = createHmac("sha256", secret).update(payload).digest("hex");

  async function sendWebhook(label: string) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Webhook-Signature": signature },
      body: payload,
    });
    console.log(`[${label}] webhook respondeu ${res.status}: ${await res.text()}`);
  }

  await sendWebhook("1ª entrega");
  if (repeat) await sendWebhook("2ª entrega (repetida — deve ser no-op)");

  const { data: updatedSub, error: fetchErr } = await supabaseAdmin
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("id", subscription.id)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);
  console.log("Subscription depois do webhook:", updatedSub);

  const { data: updatedPayment, error: fetchPayErr } = await supabaseAdmin
    .from("payments")
    .select("status, method, paid_at")
    .eq("id", payment.id)
    .single();
  if (fetchPayErr) throw new Error(fetchPayErr.message);
  console.log("Payment depois do webhook:", updatedPayment);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
