import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTransactionalEmail } from "@/lib/email.server";

const DAY_MS = 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * DAY_MS;

type ReminderKind = "expiring_soon" | "expired";

function buildEmailHtml(kind: ReminderKind, daysLeft: number): string {
  if (kind === "expired") {
    return `<p>O teu plano premium do CV Flexível expirou.</p>
<p>Renova a qualquer momento pela PaySuite (M-Pesa, e-Mola, mKesh ou cartão) para voltar a ter acesso.</p>`;
  }
  return `<p>O teu plano premium do CV Flexível expira em ${daysLeft} dia${daysLeft === 1 ? "" : "s"}.</p>
<p>Renova pela PaySuite (M-Pesa, e-Mola, mKesh ou cartão) para não perder o acesso.</p>`;
}

function buildEmailSubject(kind: ReminderKind, daysLeft: number): string {
  return kind === "expired"
    ? "O teu plano CV Flexível expirou"
    : `O teu plano CV Flexível expira em ${daysLeft} dia${daysLeft === 1 ? "" : "s"}`;
}

/** Motor de lembretes (Fase 1.4d item 1), pensado para correr uma vez por dia
 * via cron externo (ver src/routes/api/cron/plan-reminders.ts). PaySuite é
 * pré-pago sem renovação automática, então isto é a única forma de avisar o
 * usuário antes/depois do vencimento. Idempotente por período
 * (plan_reminder_emails, único por subscription+kind+period_end) — pode correr
 * todos os dias sem duplicar envios dentro da mesma janela de 3 dias. */
export async function runPlanReminders(): Promise<{
  sent: number;
  skipped: number;
  failed: number;
}> {
  const now = Date.now();
  const soonCutoff = new Date(now + THREE_DAYS_MS).toISOString();

  const { data: subs, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id, user_id, current_period_end")
    .eq("status", "active")
    .not("current_period_end", "is", null)
    .lte("current_period_end", soonCutoff);
  if (error) throw new Error(error.message);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const sub of subs ?? []) {
    const periodEnd = sub.current_period_end as string;
    const kind: ReminderKind = new Date(periodEnd).getTime() <= now ? "expired" : "expiring_soon";
    const daysLeft = Math.max(0, Math.ceil((new Date(periodEnd).getTime() - now) / DAY_MS));

    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("plan_reminder_emails")
      .select("id")
      .eq("subscription_id", sub.id)
      .eq("kind", kind)
      .eq("period_end", periodEnd)
      .maybeSingle();
    if (existingErr) {
      failed++;
      continue;
    }
    if (existing) {
      skipped++;
      continue;
    }

    const { data: userResult, error: userErr } = await supabaseAdmin.auth.admin.getUserById(
      sub.user_id,
    );
    const email = userResult?.user?.email;
    if (userErr || !email) {
      failed++;
      continue;
    }

    try {
      await sendTransactionalEmail({
        to: email,
        subject: buildEmailSubject(kind, daysLeft),
        html: buildEmailHtml(kind, daysLeft),
      });
      const { error: insertErr } = await supabaseAdmin
        .from("plan_reminder_emails")
        .insert({ subscription_id: sub.id, kind, period_end: periodEnd });
      if (insertErr) throw new Error(insertErr.message);
      sent++;
    } catch {
      failed++;
    }
  }

  return { sent, skipped, failed };
}
