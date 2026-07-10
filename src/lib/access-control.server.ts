import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hasActivePlan } from "@/lib/subscription.server";
import type { Database } from "@/integrations/supabase/types";

export type UsageTier = "anonymous" | "free" | "premium";

export type UsageDenyReason = "not_allowed_tier" | "daily_limit" | "monthly_limit" | "global_limit";

export interface UsageCheckResult {
  allowed: boolean;
  reason: "ok" | UsageDenyReason;
  remainingToday: number | null;
  remainingMonth: number | null;
  retryAt: string | null;
  usageId: string | null;
  tier: UsageTier;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;

function getClientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

function computeFingerprint(headers: Headers): string {
  const ip = getClientIp(headers);
  const userAgent = headers.get("user-agent") || "unknown";
  return createHash("sha256").update(`${ip}|${userAgent}`).digest("hex");
}

/** Identifica o pedido sem exigir autenticação: userId se houver sessão válida,
 * fingerprint (hash de IP+user-agent) para o rate-limit anti-abuso de anónimos. */
export const optionalIdentity = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const request = getRequest();
  const headers = request?.headers ?? null;
  const fingerprint = headers ? computeFingerprint(headers) : null;

  let userId: string | null = null;
  const authHeader = headers?.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length);
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (token && SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) {
      const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      });
      const { data } = await supabase.auth.getClaims(token);
      if (data?.claims?.sub) userId = data.claims.sub as string;
    }
  }

  return next({ context: { userId, fingerprint } });
});

interface AccessPolicyRow {
  max_per_day: number | null;
  max_per_month: number | null;
  cooldown_hours: number | null;
  enabled: boolean;
}

async function loadPolicy(feature: string, tier: UsageTier): Promise<AccessPolicyRow | null> {
  const { data, error } = await supabaseAdmin
    .from("access_policies")
    .select("max_per_day, max_per_month, cooldown_hours, enabled")
    .eq("feature", feature)
    .eq("tier", tier)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function countUsage(
  identity: { userId: string | null; fingerprint: string | null },
  feature: string | null,
  sinceMs: number,
): Promise<{ count: number; oldest: string | null; latest: string | null }> {
  let query = supabaseAdmin
    .from("ai_usage")
    .select("created_at")
    .gte("created_at", new Date(sinceMs).toISOString())
    .order("created_at", { ascending: true });
  query = feature ? query.eq("feature", feature) : query;
  query = identity.userId
    ? query.eq("user_id", identity.userId)
    : query.eq("anon_fingerprint", identity.fingerprint ?? "__no_fingerprint__");

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  return {
    count: rows.length,
    oldest: rows[0]?.created_at ?? null,
    latest: rows[rows.length - 1]?.created_at ?? null,
  };
}

/** Lê a política de acesso da feature para o tier do pedido, conta o uso na
 * janela de 24h/mês e, se permitido, regista o uso. Sem exceções hardcoded:
 * toda a lógica de limite vive nas linhas de access_policies. */
export async function checkAndRecordUsage(
  feature: string,
  userId: string | null,
  fingerprint: string | null,
): Promise<UsageCheckResult> {
  const tier: UsageTier = userId ? ((await hasActivePlan(userId)) ? "premium" : "free") : "anonymous";
  const identity = { userId, fingerprint };

  if (!userId) {
    const globalPolicy = await loadPolicy("_global", "anonymous");
    if (globalPolicy?.enabled && globalPolicy.max_per_day != null) {
      const { count, latest } = await countUsage(identity, null, Date.now() - DAY_MS);
      if (count >= globalPolicy.max_per_day) {
        return {
          allowed: false,
          reason: "global_limit",
          remainingToday: 0,
          remainingMonth: null,
          retryAt: latest ? new Date(new Date(latest).getTime() + DAY_MS).toISOString() : null,
          usageId: null,
          tier,
        };
      }
    }
  }

  const policy = await loadPolicy(feature, tier);
  if (policy && !policy.enabled) {
    return {
      allowed: false,
      reason: "not_allowed_tier",
      remainingToday: 0,
      remainingMonth: 0,
      retryAt: null,
      usageId: null,
      tier,
    };
  }

  let remainingToday: number | null = null;
  let remainingMonth: number | null = null;

  if (policy?.max_per_month != null) {
    const { count, oldest } = await countUsage(identity, feature, Date.now() - MONTH_MS);
    remainingMonth = Math.max(0, policy.max_per_month - count);
    if (count >= policy.max_per_month) {
      return {
        allowed: false,
        reason: "monthly_limit",
        remainingToday: 0,
        remainingMonth: 0,
        retryAt: oldest ? new Date(new Date(oldest).getTime() + MONTH_MS).toISOString() : null,
        usageId: null,
        tier,
      };
    }
  }

  if (policy?.max_per_day != null) {
    const { count, latest } = await countUsage(identity, feature, Date.now() - DAY_MS);
    remainingToday = Math.max(0, policy.max_per_day - count);
    if (count >= policy.max_per_day) {
      const cooldownMs = (policy.cooldown_hours ?? 24) * 60 * 60 * 1000;
      return {
        allowed: false,
        reason: "daily_limit",
        remainingToday: 0,
        remainingMonth,
        retryAt: latest ? new Date(new Date(latest).getTime() + cooldownMs).toISOString() : null,
        usageId: null,
        tier,
      };
    }
  }

  const { data: inserted, error } = await supabaseAdmin
    .from("ai_usage")
    .insert({
      user_id: userId,
      anon_fingerprint: userId ? null : fingerprint,
      feature,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  return {
    allowed: true,
    reason: "ok",
    remainingToday: remainingToday != null ? Math.max(0, remainingToday - 1) : null,
    remainingMonth: remainingMonth != null ? Math.max(0, remainingMonth - 1) : null,
    retryAt: null,
    usageId: inserted.id,
    tier,
  };
}

/** Regista os tokens reais da chamada de IA já autorizada (Fase 0.2: custo real
 * em vez de estimativa por contagem de chamadas). Nunca lança — telemetria não
 * pode derrubar a resposta ao utilizador. */
export async function recordUsageTokens(
  usageId: string | null,
  usage: { inputTokens?: number; outputTokens?: number } | undefined,
): Promise<void> {
  if (!usageId || !usage) return;
  try {
    await supabaseAdmin
      .from("ai_usage")
      .update({ tokens_in: usage.inputTokens ?? null, tokens_out: usage.outputTokens ?? null })
      .eq("id", usageId);
  } catch (err) {
    console.warn("Falha ao registar tokens de uso de IA", err);
  }
}

/** Erro estruturado para a UI (Fase 1.3): a mensagem é o próprio JSON,
 * porque o transporte de erros entre server function e cliente só preserva `message`. */
export class LimitReachedError extends Error {
  constructor(result: UsageCheckResult) {
    super(
      JSON.stringify({
        code: "LIMIT_REACHED",
        reason: result.reason,
        retryAt: result.retryAt,
        upgrade: true,
      }),
    );
    this.name = "LimitReachedError";
  }
}

export async function requireUsageAllowed(
  feature: string,
  userId: string | null,
  fingerprint: string | null,
): Promise<UsageCheckResult> {
  const result = await checkAndRecordUsage(feature, userId, fingerprint);
  if (!result.allowed) throw new LimitReachedError(result);
  return result;
}
