import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Custo por chamada de IA ainda não é medido por token (ai_usage.tokens_in/out
 * fica por preencher desde a Fase 0.1) — esta é uma estimativa grosseira por
 * contagem de chamadas, só para dar ordem de grandeza até isso ser wired. */
const ESTIMATED_COST_PER_CALL_USD = 0.002;

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

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
          .select("feature, created_at")
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
    for (const row of aiUsageRes.data ?? []) {
      const key = dayKey(row.created_at);
      callsByDayMap.set(key, (callsByDayMap.get(key) ?? 0) + 1);
      featureCounts.set(row.feature, (featureCounts.get(row.feature) ?? 0) + 1);
    }

    const callsByDay: { date: string; calls: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const key = dayKey(new Date(now - i * DAY_MS).toISOString());
      callsByDay.push({ date: key, calls: callsByDayMap.get(key) ?? 0 });
    }

    const topFeatures = [...featureCounts.entries()]
      .map(([feature, count]) => ({ feature, count }))
      .sort((a, b) => b.count - a.count);

    const totalCallsLast30d = aiUsageRes.data?.length ?? 0;

    return {
      totalUsers: totalUsersRes.count ?? 0,
      newThisWeek: newThisWeekRes.count ?? 0,
      activeUsers7d: activeUserIds.size,
      callsByDay,
      topFeatures,
      estimatedCostUsd30d: Number((totalCallsLast30d * ESTIMATED_COST_PER_CALL_USD).toFixed(2)),
    };
  });
