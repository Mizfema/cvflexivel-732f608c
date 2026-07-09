import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Preço do google/gemini-3-flash-preview via Lovable AI Gateway: pass-through
 * do preço do Google, sem markup (US$0.50 / 1M tokens de entrada, US$3.00 / 1M
 * de saída). Se o modelo usado nas server functions mudar, actualizar aqui. */
const INPUT_PRICE_PER_TOKEN_USD = 0.5 / 1_000_000;
const OUTPUT_PRICE_PER_TOKEN_USD = 3 / 1_000_000;

async function checkIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

async function assertAdmin(userId: string) {
  if (!(await checkIsAdmin(userId))) {
    throw new Error("Acesso restrito a administradores.");
  }
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Usado pelo menu para decidir se mostra o link Admin — não expõe nada além
 * do booleano; a verificação real de acesso ao painel continua em getAdminDashboard. */
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
          .select("feature, created_at, tokens_in, tokens_out")
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
    let costUsd30d = 0;
    let callsWithTokens = 0;
    for (const row of aiUsageRes.data ?? []) {
      const key = dayKey(row.created_at);
      callsByDayMap.set(key, (callsByDayMap.get(key) ?? 0) + 1);
      featureCounts.set(row.feature, (featureCounts.get(row.feature) ?? 0) + 1);
      if (row.tokens_in != null || row.tokens_out != null) {
        callsWithTokens += 1;
        costUsd30d +=
          (row.tokens_in ?? 0) * INPUT_PRICE_PER_TOKEN_USD +
          (row.tokens_out ?? 0) * OUTPUT_PRICE_PER_TOKEN_USD;
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

    const totalCallsLast30d = aiUsageRes.data?.length ?? 0;

    return {
      totalUsers: totalUsersRes.count ?? 0,
      newThisWeek: newThisWeekRes.count ?? 0,
      activeUsers7d: activeUserIds.size,
      callsByDay,
      topFeatures,
      costUsd30d: Number(costUsd30d.toFixed(4)),
      costTrackedCalls: callsWithTokens,
      totalCallsLast30d,
    };
  });
