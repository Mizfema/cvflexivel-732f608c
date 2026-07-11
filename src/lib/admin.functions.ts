import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { computeCostUsd } from "@/lib/ai-pricing";

const DAY_MS = 24 * 60 * 60 * 1000;

async function checkIsAdmin(
  userId: string,
  client: typeof supabaseAdmin,
): Promise<boolean> {
  const { data, error } = await client
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

async function assertAdmin(userId: string) {
  if (!(await checkIsAdmin(userId, supabaseAdmin))) {
    throw new Error("Acesso restrito a administradores.");
  }
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Usado pelo menu para decidir se mostra o link Admin — não expõe nada além
 * do booleano; a verificação real de acesso ao painel continua em getAdminDashboard.
 * Usa o cliente autenticado do utilizador (RLS) para não exigir service-role key. */
export const getIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({
    isAdmin: await checkIsAdmin(context.userId, context.supabase as unknown as typeof supabaseAdmin),
  }));

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * DAY_MS).toISOString();
    const thirtyDaysAgo = new Date(now - 30 * DAY_MS).toISOString();

    const [totalUsersRes, newThisWeekRes, activeAiUsersRes, activeCvUsersRes, aiUsageRes] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
        supabaseAdmin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gte("created_at", sevenDaysAgo),
        supabaseAdmin.from("ai_usage").select("user_id").gte("created_at", sevenDaysAgo),
        supabaseAdmin.from("cvs").select("user_id").gte("updated_at", sevenDaysAgo),
        supabaseAdmin
          .from("ai_usage")
          .select("feature, created_at, tokens_in, tokens_out, cost_usd, user_id")
          .gte("created_at", thirtyDaysAgo),
      ]);

    if (totalUsersRes.error) throw new Error(totalUsersRes.error.message);
    if (newThisWeekRes.error) throw new Error(newThisWeekRes.error.message);
    if (activeAiUsersRes.error) throw new Error(activeAiUsersRes.error.message);
    if (activeCvUsersRes.error) throw new Error(activeCvUsersRes.error.message);
    if (aiUsageRes.error) throw new Error(aiUsageRes.error.message);

    const activeUserIds = new Set<string>();
    for (const row of activeAiUsersRes.data ?? []) {
      if (row.user_id) activeUserIds.add(row.user_id);
    }
    for (const row of activeCvUsersRes.data ?? []) {
      if (row.user_id) activeUserIds.add(row.user_id);
    }

    const callsByDayMap = new Map<string, number>();
    const featureCounts = new Map<string, number>();
    const featureCosts = new Map<string, number>();
    const userCosts = new Map<string, number>();
    let costUsd30d = 0;
    let callsWithTokens = 0;
    for (const row of aiUsageRes.data ?? []) {
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

    const totalCallsLast30d = aiUsageRes.data?.length ?? 0;

    // Fase 4 da Proposta V3 (§8): custo IA por utilizador + top 10 mais caros.
    const topUserIds = [...userCosts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId]) => userId);

    const topUsersByCost: { userId: string; label: string; costUsd: number }[] = [];
    if (topUserIds.length > 0) {
      const { data: profilesData, error: profilesErr } = await supabaseAdmin
        .from("profiles")
        .select("id, email, full_name")
        .in("id", topUserIds);
      if (profilesErr) throw new Error(profilesErr.message);

      const profileById = new Map((profilesData ?? []).map((p) => [p.id, p]));
      for (const userId of topUserIds) {
        const profile = profileById.get(userId);
        topUsersByCost.push({
          userId,
          label: profile?.email ?? profile?.full_name ?? `${userId.slice(0, 8)}…`,
          costUsd: Number((userCosts.get(userId) ?? 0).toFixed(4)),
        });
      }
    }

    return {
      totalUsers: totalUsersRes.count ?? 0,
      newThisWeek: newThisWeekRes.count ?? 0,
      activeUsers7d: activeUserIds.size,
      callsByDay,
      topFeatures,
      costByFeature,
      topUsersByCost,
      costUsd30d: Number(costUsd30d.toFixed(4)),
      costTrackedCalls: callsWithTokens,
      totalCallsLast30d,
    };
  });
