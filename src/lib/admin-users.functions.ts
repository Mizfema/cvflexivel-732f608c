import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/lib/admin-auth.server";
import { computeCostUsd } from "@/lib/ai-pricing";
import { listAdminActions } from "@/lib/admin-audit.functions";

const DAY_MS = 24 * 60 * 60 * 1000;

function getGraceDays(): number {
  const parsed = Number(process.env.GRACE_DAYS);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 2;
}

/** Remove caracteres com significado especial no filtro `.or()` do PostgREST
 * (vírgula abre um novo predicado, parênteses agrupam) — a busca é texto
 * livre do admin, não deve conseguir alterar a estrutura do filtro. */
function sanitizeSearchTerm(q: string): string {
  return q.replace(/[,()]/g, "").trim();
}

type PlanInfo = { status: "free" | "active"; plan: string | null; isAdminGrant: boolean };

/** Um utilizador nunca deveria ter duas subscriptions 'active' simultâneas,
 * mas se acontecer (corrida, dado histórico) escolhe a de period_end mais
 * distante — é a leitura mais otimista e menos surpreendente para o admin. */
function pickActivePlan(
  rows: { user_id: string; plan: string; provider: string; current_period_end: string | null }[],
  graceCutoffIso: string,
): PlanInfo {
  const active = rows.filter((r) => r.current_period_end && r.current_period_end > graceCutoffIso);
  if (active.length === 0) return { status: "free", plan: null, isAdminGrant: false };
  const best = active.sort((a, b) =>
    (b.current_period_end ?? "").localeCompare(a.current_period_end ?? ""),
  )[0];
  return { status: "active", plan: best.plan, isAdminGrant: best.provider === "admin" };
}

const listAdminUsersSchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
  page: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export const listAdminUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listAdminUsersSchema.parse(input ?? {}))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    const { q, page, pageSize } = data;
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    const term = sanitizeSearchTerm(q);
    if (term) {
      query = query.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`);
    }

    const { data: rows, count, error } = await query;
    if (error) throw new Error(error.message);

    const userIds = (rows ?? []).map((r) => r.id);
    if (userIds.length === 0) {
      return { rows: [], total: count ?? 0, page, pageSize };
    }

    const graceCutoff = new Date(Date.now() - getGraceDays() * DAY_MS).toISOString();

    const [subscriptionsRes, creditBalancesRes, suspensionsRes] = await Promise.all([
      supabaseAdmin
        .from("subscriptions")
        .select("user_id, plan, provider, current_period_end")
        .in("user_id", userIds)
        .eq("status", "active"),
      supabaseAdmin
        .from("credit_balances")
        .select("user_id, balance, expires_at")
        .in("user_id", userIds),
      supabaseAdmin.from("user_suspensions").select("user_id").in("user_id", userIds),
    ]);
    if (subscriptionsRes.error) throw new Error(subscriptionsRes.error.message);
    if (creditBalancesRes.error) throw new Error(creditBalancesRes.error.message);
    if (suspensionsRes.error) throw new Error(suspensionsRes.error.message);

    const subsByUser = new Map<string, typeof subscriptionsRes.data>();
    for (const sub of subscriptionsRes.data ?? []) {
      const arr = subsByUser.get(sub.user_id);
      if (arr) arr.push(sub);
      else subsByUser.set(sub.user_id, [sub]);
    }
    const creditsByUser = new Map((creditBalancesRes.data ?? []).map((c) => [c.user_id, c]));
    const suspendedUsers = new Set((suspensionsRes.data ?? []).map((s) => s.user_id));

    const now = new Date().toISOString();
    const usersRows = (rows ?? []).map((profile) => {
      const plan = pickActivePlan(subsByUser.get(profile.id) ?? [], graceCutoff);
      const credits = creditsByUser.get(profile.id);
      const activeCredits = credits && credits.expires_at > now ? credits.balance : null;
      return {
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        createdAt: profile.created_at,
        plan,
        creditsBalance: activeCredits,
        suspended: suspendedUsers.has(profile.id),
      };
    });

    return { rows: usersRows, total: count ?? 0, page, pageSize };
  });

const getAdminUserDetailSchema = z.object({ userId: z.string().uuid() });

export const getAdminUserDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => getAdminUserDetailSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { userId } = data;

    const thirtyDaysAgo = new Date(Date.now() - 30 * DAY_MS).toISOString();

    const [
      profileRes,
      subscriptionsRes,
      paymentsRes,
      creditBalanceRes,
      creditTransactionsRes,
      aiUsageRes,
      rolesRes,
      suspensionRes,
      adminActionsResult,
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabaseAdmin
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("payments")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("credit_balances")
        .select("balance, expires_at, package_id, updated_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("credit_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("ai_usage")
        .select("feature, created_at, tokens_in, tokens_out, cost_usd")
        .eq("user_id", userId)
        .gte("created_at", thirtyDaysAgo),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
      supabaseAdmin.from("user_suspensions").select("*").eq("user_id", userId).maybeSingle(),
      listAdminActions({ data: { targetUserId: userId, page: 0, pageSize: 50 } }),
    ]);

    if (profileRes.error) throw new Error(profileRes.error.message);
    if (!profileRes.data) throw new Error("Utilizador não encontrado.");
    if (subscriptionsRes.error) throw new Error(subscriptionsRes.error.message);
    if (paymentsRes.error) throw new Error(paymentsRes.error.message);
    if (creditBalanceRes.error) throw new Error(creditBalanceRes.error.message);
    if (creditTransactionsRes.error) throw new Error(creditTransactionsRes.error.message);
    if (aiUsageRes.error) throw new Error(aiUsageRes.error.message);
    if (rolesRes.error) throw new Error(rolesRes.error.message);
    if (suspensionRes.error) throw new Error(suspensionRes.error.message);

    let aiCallsLast30d = 0;
    let aiCostUsd30d = 0;
    for (const row of aiUsageRes.data ?? []) {
      aiCallsLast30d += 1;
      if (row.tokens_in != null || row.tokens_out != null) {
        aiCostUsd30d += row.cost_usd ?? computeCostUsd(row.tokens_in, row.tokens_out);
      }
    }

    const graceCutoff = new Date(Date.now() - getGraceDays() * DAY_MS).toISOString();
    const plan = pickActivePlan(
      (subscriptionsRes.data ?? []).filter((s) => s.status === "active"),
      graceCutoff,
    );

    return {
      profile: profileRes.data,
      plan,
      subscriptions: subscriptionsRes.data ?? [],
      payments: paymentsRes.data ?? [],
      creditBalance: creditBalanceRes.data,
      creditTransactions: creditTransactionsRes.data ?? [],
      aiUsage30d: { calls: aiCallsLast30d, costUsd: Number(aiCostUsd30d.toFixed(4)) },
      roles: (rolesRes.data ?? []).map((r) => r.role),
      suspension: suspensionRes.data,
      adminActions: adminActionsResult.rows,
    };
  });
