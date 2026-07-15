import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { computeCostUsd } from "@/lib/ai-pricing";
import { assertAdmin, checkIsAdmin } from "@/lib/admin-auth.server";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const DOWNLOAD_FEATURES = ["download_free", "download_premium"];

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** Usado pelo menu para decidir se mostra o link Admin — não expõe nada além
 * do booleano; a verificação real de acesso ao painel continua em getAdminDashboard.
 * Tem de usar supabaseAdmin (service role): a policy "No direct access to
 * user_roles" bloqueia leitura via RLS para anon/authenticated sempre, mesmo
 * para o próprio dono da role — um cliente autenticado nunca vê a sua linha. */
export const getIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ isAdmin: await checkIsAdmin(context.userId) }));

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * DAY_MS).toISOString();
    const thirtyDaysAgo = new Date(now - 30 * DAY_MS).toISOString();
    const sixtyDaysAgo = new Date(now - 60 * DAY_MS).toISOString();

    const [profilesRes, cvsRes, coverLettersRes, interviewPrepsRes, aiUsageRes, paymentsRes] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("id, email, full_name, created_at"),
        supabaseAdmin.from("cvs").select("user_id, updated_at"),
        supabaseAdmin.from("cover_letters").select("user_id, updated_at"),
        supabaseAdmin.from("interview_preps").select("user_id, updated_at"),
        supabaseAdmin
          .from("ai_usage")
          .select("feature, created_at, tokens_in, tokens_out, cost_usd, user_id"),
        supabaseAdmin
          .from("payments")
          .select("user_id, amount, paid_at, subscription_id")
          .eq("status", "confirmed"),
      ]);

    if (profilesRes.error) throw new Error(profilesRes.error.message);
    if (cvsRes.error) throw new Error(cvsRes.error.message);
    if (coverLettersRes.error) throw new Error(coverLettersRes.error.message);
    if (interviewPrepsRes.error) throw new Error(interviewPrepsRes.error.message);
    if (aiUsageRes.error) throw new Error(aiUsageRes.error.message);
    if (paymentsRes.error) throw new Error(paymentsRes.error.message);

    const profiles = profilesRes.data ?? [];
    const totalUsers = profiles.length;
    const newThisWeek = profiles.filter((p) => p.created_at >= sevenDaysAgo).length;

    // "Utilizador ativo" (decisão D2 do guia): qualquer sinal entre ai_usage
    // OU updated_at recente em cvs/cover_letters/interview_preps — produto de
    // uso episódico, só-IA subestimaria retenção. O mesmo mapa de atividade
    // (userId → timestamps) serve o tile de 7 dias e a retenção por cohort.
    const activityByUser = new Map<string, number[]>();
    function trackActivity(userId: string | null, iso: string) {
      if (!userId) return;
      const t = new Date(iso).getTime();
      const arr = activityByUser.get(userId);
      if (arr) arr.push(t);
      else activityByUser.set(userId, [t]);
    }
    for (const row of cvsRes.data ?? []) trackActivity(row.user_id, row.updated_at);
    for (const row of coverLettersRes.data ?? []) trackActivity(row.user_id, row.updated_at);
    for (const row of interviewPrepsRes.data ?? []) trackActivity(row.user_id, row.updated_at);
    for (const row of aiUsageRes.data ?? []) trackActivity(row.user_id, row.created_at);

    const sevenDaysAgoMs = now - 7 * DAY_MS;
    const activeUserIds = new Set<string>();
    for (const [userId, timestamps] of activityByUser) {
      if (timestamps.some((t) => t >= sevenDaysAgoMs)) activeUserIds.add(userId);
    }

    // ===== Chamadas de IA / custo (30 dias) =====
    const callsByDayMap = new Map<string, number>();
    const featureCounts = new Map<string, number>();
    const featureCosts = new Map<string, number>();
    const userCosts = new Map<string, number>();
    let costUsd30d = 0;
    let callsWithTokens = 0;
    let totalCallsLast30d = 0;
    for (const row of aiUsageRes.data ?? []) {
      if (row.created_at < thirtyDaysAgo) continue;
      totalCallsLast30d += 1;
      const key = dayKey(row.created_at);
      callsByDayMap.set(key, (callsByDayMap.get(key) ?? 0) + 1);
      featureCounts.set(row.feature, (featureCounts.get(row.feature) ?? 0) + 1);
      if (row.tokens_in != null || row.tokens_out != null) {
        callsWithTokens += 1;
        // cost_usd é gravado desde a Fase 0 da Proposta V3; linhas anteriores
        // a essa migration não têm o campo, por isso calcula-se a partir dos
        // tokens como fallback só para esses registos históricos.
        const rowCost = row.cost_usd ?? computeCostUsd(row.tokens_in, row.tokens_out);
        costUsd30d += rowCost;
        featureCosts.set(row.feature, (featureCosts.get(row.feature) ?? 0) + rowCost);
        if (row.user_id) {
          userCosts.set(row.user_id, (userCosts.get(row.user_id) ?? 0) + rowCost);
        }
      }
    }

    const callsByDay: { date: string; calls: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const key = dayKey(new Date(now - i * DAY_MS).toISOString());
      callsByDay.push({ date: key, calls: callsByDayMap.get(key) ?? 0 });
    }

    const topFeatures = [...featureCounts.entries()]
      .map(([feature, count]) => ({ feature, count }))
      .sort((a, b) => b.count - a.count);

    const costByFeature = [...featureCosts.entries()]
      .map(([feature, cost]) => ({ feature, costUsd: Number(cost.toFixed(4)) }))
      .sort((a, b) => b.costUsd - a.costUsd);

    // Fase 4 da Proposta V3 (§8): custo IA por utilizador + top 10 mais caros.
    const topUserIds = [...userCosts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId]) => userId);

    const profileById = new Map(profiles.map((p) => [p.id, p]));
    const topUsersByCost = topUserIds.map((userId) => {
      const profile = profileById.get(userId);
      return {
        userId,
        label: profile?.email ?? profile?.full_name ?? `${userId.slice(0, 8)}…`,
        costUsd: Number((userCosts.get(userId) ?? 0).toFixed(4)),
      };
    });

    // ===== Receita (D1: "MRR" renomeado para "Receita confirmada (30d)") =====
    // payments.amount é sempre MZN (nunca USD) — as variáveis abaixo já se
    // chamaram *Usd por engano, o que levava o dashboard a rotular receita
    // real em MZN como se fosse dólar. Corrigido: sufixo Mzn em todo o lado.
    const payments = paymentsRes.data ?? [];
    let revenue30dMzn = 0;
    let revenuePrev30dMzn = 0;
    let revenueAllTimeMzn = 0;
    let upgrades30d = 0;
    const payingUserIds = new Set<string>();
    const revenueByMonth = new Map<string, number>();
    for (const p of payments) {
      if (!p.paid_at) continue;
      const amount = Number(p.amount);
      revenueAllTimeMzn += amount;
      if (p.user_id) payingUserIds.add(p.user_id);
      revenueByMonth.set(monthKey(p.paid_at), (revenueByMonth.get(monthKey(p.paid_at)) ?? 0) + amount);
      if (p.paid_at >= thirtyDaysAgo) {
        revenue30dMzn += amount;
        if (p.subscription_id) upgrades30d += 1;
      } else if (p.paid_at >= sixtyDaysAgo) {
        revenuePrev30dMzn += amount;
      }
    }
    const revenueSeries = [...revenueByMonth.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([month, amountMzn]) => ({ month, amountMzn: Number(amountMzn.toFixed(2)) }));

    const revenueDeltaPct =
      revenuePrev30dMzn > 0
        ? Number((((revenue30dMzn - revenuePrev30dMzn) / revenuePrev30dMzn) * 100).toFixed(1))
        : null;

    const conversionPct = totalUsers > 0 ? (payingUserIds.size / totalUsers) * 100 : null;

    // Removido contributionMarginPct: comparava receita (MZN) com custo de IA
    // (USD) sem taxa de câmbio nenhuma, inflando artificialmente a margem
    // mostrada. Sem uma taxa de câmbio real para converter, os dois números
    // ficam separados no dashboard (receita em MZN, custo de IA em USD).

    const ltvMzn =
      payingUserIds.size > 0 ? Number((revenueAllTimeMzn / payingUserIds.size).toFixed(2)) : null;

    // ===== Retenção (D2 + D11: janelas em UTC) =====
    // M1: utilizadores com pelo menos 30 dias de conta, ativos nos seus
    // próprios primeiros 30 dias. Cohort por semana: para cada semana N desde
    // o registo, % de utilizadores (com conta velha o suficiente) ativos na
    // janela [signup + (N-1) semanas, signup + N semanas).
    let m1CohortSize = 0;
    let m1Active = 0;
    for (const p of profiles) {
      const signupMs = new Date(p.created_at).getTime();
      if (now - signupMs < 30 * DAY_MS) continue;
      m1CohortSize += 1;
      const timestamps = activityByUser.get(p.id) ?? [];
      if (timestamps.some((t) => t >= signupMs && t < signupMs + 30 * DAY_MS)) m1Active += 1;
    }
    const retentionM1Pct = m1CohortSize > 0 ? Number(((m1Active / m1CohortSize) * 100).toFixed(1)) : null;

    const retentionWeeklySeries: { week: number; pct: number | null; cohortSize: number }[] = [];
    for (let week = 1; week <= 8; week++) {
      let cohortSize = 0;
      let active = 0;
      for (const p of profiles) {
        const signupMs = new Date(p.created_at).getTime();
        if (now - signupMs < week * WEEK_MS) continue;
        cohortSize += 1;
        const timestamps = activityByUser.get(p.id) ?? [];
        const windowStart = signupMs + (week - 1) * WEEK_MS;
        const windowEnd = signupMs + week * WEEK_MS;
        if (timestamps.some((t) => t >= windowStart && t < windowEnd)) active += 1;
      }
      retentionWeeklySeries.push({
        week,
        pct: cohortSize > 0 ? Number(((active / cohortSize) * 100).toFixed(1)) : null,
        cohortSize,
      });
    }

    // ===== Funil de ativação =====
    const cvCreatedUsers = new Set(
      (cvsRes.data ?? []).map((r) => r.user_id).filter((id): id is string => !!id),
    );
    const downloadUsers = new Set(
      (aiUsageRes.data ?? [])
        .filter((r) => DOWNLOAD_FEATURES.includes(r.feature))
        .map((r) => r.user_id)
        .filter((id): id is string => !!id),
    );

    return {
      totalUsers,
      newThisWeek,
      activeUsers7d: activeUserIds.size,
      callsByDay,
      topFeatures,
      costByFeature,
      topUsersByCost,
      costUsd30d: Number(costUsd30d.toFixed(4)),
      costTrackedCalls: callsWithTokens,
      totalCallsLast30d,
      revenue: {
        confirmed30dMzn: Number(revenue30dMzn.toFixed(2)),
        deltaPct: revenueDeltaPct,
        series: revenueSeries,
      },
      conversion: {
        payingUsers: payingUserIds.size,
        pct: conversionPct !== null ? Number(conversionPct.toFixed(1)) : null,
        upgrades30d,
      },
      retention: {
        m1Pct: retentionM1Pct,
        m1CohortSize,
        weeklySeries: retentionWeeklySeries,
      },
      ltv: {
        avgRevenuePerPayingUserMzn: ltvMzn,
      },
      funnel: {
        registrations: totalUsers,
        cvsCreated: cvCreatedUsers.size,
        cvsDownloaded: downloadUsers.size,
        upgrades: upgrades30d,
      },
    };
  });
