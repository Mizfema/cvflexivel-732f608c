import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTransactionalEmail } from "@/lib/email.server";

const DEFAULT_THRESHOLD_USD = 5;

function todayUtcDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildAlertEmailHtml(costUsd: number, thresholdUsd: number): string {
  return `<p>O custo de IA do CV Flexível hoje já ultrapassou o limiar de alerta.</p>
<p>Custo acumulado hoje: <strong>US$${costUsd.toFixed(2)}</strong> (limiar: US$${thresholdUsd.toFixed(2)}).</p>
<p>Verifica o painel admin para identificar a operação/utilizador responsável.</p>`;
}

/** Fail-safe de custo diário (Fase 0 da Proposta V3 §6, item 5). Pensado para
 * correr várias vezes ao dia via cron externo (ver
 * src/routes/api/cron/ai-cost-alert.ts), ao contrário do cron de lembretes de
 * expiração que só precisa de rodar 1x/dia — um pico de custo tem de ser
 * apanhado ainda no mesmo dia. Idempotente por dia (ai_cost_alerts, único por
 * alert_date) — não repete o e-mail no mesmo dia mesmo correndo de hora a
 * hora. Nunca lança por si só ficar sem ai_usage — só quando o e-mail real
 * falha (ex: RESEND_API_KEY ausente), igual ao padrão de plan-reminders. */
export async function checkDailyAiCostAndAlert(): Promise<{
  costUsd: number;
  thresholdUsd: number;
  breached: boolean;
  alreadyAlerted: boolean;
  alerted: boolean;
}> {
  const thresholdUsd = Number(process.env.AI_DAILY_COST_ALERT_USD) || DEFAULT_THRESHOLD_USD;
  const alertDate = todayUtcDateKey();
  const todayStart = new Date(`${alertDate}T00:00:00.000Z`).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from("ai_usage")
    .select("cost_usd")
    .gte("created_at", todayStart);
  if (error) throw new Error(error.message);

  const costUsd = (rows ?? []).reduce((sum, row) => sum + (row.cost_usd ?? 0), 0);
  const breached = costUsd > thresholdUsd;

  if (!breached) {
    return { costUsd, thresholdUsd, breached, alreadyAlerted: false, alerted: false };
  }

  const { data: existing, error: existingErr } = await supabaseAdmin
    .from("ai_cost_alerts")
    .select("id")
    .eq("alert_date", alertDate)
    .maybeSingle();
  if (existingErr) throw new Error(existingErr.message);
  if (existing) {
    return { costUsd, thresholdUsd, breached, alreadyAlerted: true, alerted: false };
  }

  const adminEmail = process.env.ADMIN_ALERT_EMAIL;
  if (!adminEmail) {
    throw new Error(
      "ADMIN_ALERT_EMAIL não configurado — não há para onde mandar o alerta de custo diário.",
    );
  }

  await sendTransactionalEmail({
    to: adminEmail,
    subject: `Alerta: custo de IA hoje ultrapassou US$${thresholdUsd.toFixed(2)}`,
    html: buildAlertEmailHtml(costUsd, thresholdUsd),
  });

  const { error: insertErr } = await supabaseAdmin
    .from("ai_cost_alerts")
    .insert({ alert_date: alertDate, cost_usd_at_alert: costUsd, threshold_usd: thresholdUsd });
  if (insertErr) throw new Error(insertErr.message);

  return { costUsd, thresholdUsd, breached, alreadyAlerted: false, alerted: true };
}
