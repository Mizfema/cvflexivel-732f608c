import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hasActivePlan, getActiveFairUseBypass } from "@/lib/subscription.server";
import { computeCostUsd } from "@/lib/ai-pricing";
import { getActiveCreditBalance, getCreditWeight, debitCredits } from "@/lib/credits.server";
import { hasActiveSuspension, AccountSuspendedError } from "@/lib/user-suspension.server";
import { checkIsAdmin } from "@/lib/admin-auth.server";
import type { Database } from "@/integrations/supabase/types";

export type UsageTier = "anonymous" | "free" | "premium";

export type UsageDenyReason =
  | "not_allowed_tier"
  | "daily_limit"
  | "monthly_limit"
  | "global_limit"
  | "session_limit"
  | "insufficient_credits";

export interface UsageCheckResult {
  allowed: boolean;
  reason: "ok" | UsageDenyReason;
  remainingToday: number | null;
  remainingMonth: number | null;
  retryAt: string | null;
  usageId: string | null;
  tier: UsageTier;
  /** Só definido quando a feature é coberta por créditos do avulso (Fase 3 da
   * Proposta V3) e o utilizador tem pacote ativo — null nos restantes casos. */
  creditsRemaining?: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;
const HOUR_MS = 60 * 60 * 1000;

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
  max_per_session: number | null;
  quota_group: string | null;
  enabled: boolean;
}

async function loadPolicy(feature: string, tier: UsageTier): Promise<AccessPolicyRow | null> {
  const { data, error } = await supabaseAdmin
    .from("access_policies")
    .select("max_per_day, max_per_month, cooldown_hours, max_per_session, quota_group, enabled")
    .eq("feature", feature)
    .eq("tier", tier)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Conta o uso de uma feature por sessão de navegador (sem janela de tempo —
 * a sessão "expira" sozinha porque o cliente gera um novo sessionId a cada
 * sessão, guardado em sessionStorage). Guard-rail transversal do
 * generateFieldSuggestions (Fase 0 da Proposta V3 §6, item 3), independente
 * dos tectos por dia/mês já existentes. */
async function countSessionUsage(sessionId: string, feature: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("feature", feature);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countUsage(
  identity: { userId: string | null; fingerprint: string | null },
  feature: string | string[] | null,
  sinceMs: number,
): Promise<{ count: number; oldest: string | null; latest: string | null }> {
  let query = supabaseAdmin
    .from("ai_usage")
    .select("created_at")
    .gte("created_at", new Date(sinceMs).toISOString())
    .order("created_at", { ascending: true });
  query = Array.isArray(feature)
    ? query.in("feature", feature)
    : feature
      ? query.eq("feature", feature)
      : query;
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

/** Resolve as features que partilham a mesma quota combinada (Fase 1 da
 * Proposta V3 §8, item 3 — ex.: alignCvToTdr + generateCvFromInterview
 * partilham 2/mês no grátis, em vez de 2/mês cada uma). */
async function resolveQuotaGroupFeatures(quotaGroup: string, tier: UsageTier): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("access_policies")
    .select("feature")
    .eq("quota_group", quotaGroup)
    .eq("tier", tier);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.feature);
}

/** Se a feature é coberta por créditos (Fase 3 da Proposta V3 §3/§8) e o
 * utilizador tem saldo de pacote avulso ativo, decide o pedido inteiramente
 * por créditos — nunca cai nos tectos por dia/mês do tier "free" (já pagou).
 * Devolve null quando não se aplica (feature fora do avulso, ou sem saldo
 * ativo), para o chamador cair na lógica normal por tier. */
async function tryCreditCoveredUsage(
  feature: string,
  userId: string,
  sessionId: string | null,
): Promise<UsageCheckResult | null> {
  const weight = await getCreditWeight(feature);
  if (weight == null) return null;

  const balance = await getActiveCreditBalance(userId);
  if (!balance) return null;

  const tier: UsageTier = "free";

  // O rate-limit por sessão (ex.: field_suggestions) é anti-abuso, não
  // cobrança — continua a aplicar-se mesmo coberto por créditos.
  const policy = await loadPolicy(feature, tier);
  if (sessionId && policy?.max_per_session != null) {
    const sessionCount = await countSessionUsage(sessionId, feature);
    if (sessionCount >= policy.max_per_session) {
      return {
        allowed: false,
        reason: "session_limit",
        remainingToday: 0,
        remainingMonth: 0,
        retryAt: null,
        usageId: null,
        tier,
      };
    }
  }

  if (weight > 0) {
    const newBalance = await debitCredits(userId, feature, weight);
    if (newBalance == null) {
      return {
        allowed: false,
        reason: "insufficient_credits",
        remainingToday: 0,
        remainingMonth: 0,
        retryAt: null,
        usageId: null,
        tier,
        creditsRemaining: balance.balance,
      };
    }
    const { data: inserted, error } = await supabaseAdmin
      .from("ai_usage")
      .insert({ user_id: userId, anon_fingerprint: null, feature, session_id: sessionId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return {
      allowed: true,
      reason: "ok",
      remainingToday: null,
      remainingMonth: null,
      retryAt: null,
      usageId: inserted.id,
      tier,
      creditsRemaining: newBalance,
    };
  }

  // Peso 0 (ex.: field_suggestions, downloads): grátis mesmo com créditos,
  // nunca debita — regra de ouro do produto (§3 do doc V3).
  const { data: inserted, error } = await supabaseAdmin
    .from("ai_usage")
    .insert({ user_id: userId, anon_fingerprint: null, feature, session_id: sessionId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return {
    allowed: true,
    reason: "ok",
    remainingToday: null,
    remainingMonth: null,
    retryAt: null,
    usageId: inserted.id,
    tier,
    creditsRemaining: balance.balance,
  };
}

/** Lê a política de acesso da feature para o tier do pedido, conta o uso na
 * janela de 24h/mês e, se permitido, regista o uso. Sem exceções hardcoded:
 * toda a lógica de limite vive nas linhas de access_policies. */
export async function checkAndRecordUsage(
  feature: string,
  userId: string | null,
  fingerprint: string | null,
  sessionId: string | null = null,
): Promise<UsageCheckResult> {
  // D7 da Fase A4: bloqueio de IA/download com erro distinto, nunca a
  // mensagem genérica de limite. Suspensão é só por user_id (abuso anónimo
  // fica fora do alcance desta mecânica, registado no backlog).
  if (userId && (await hasActiveSuspension(userId))) {
    throw new AccountSuspendedError();
  }

  // Contas admin não têm tectos de geração (CV, carta, entrevista, etc.):
  // regista o uso para auditoria (visualizador de auditoria da Fase A5), mas
  // nunca conta para limites nem debita créditos avulso. Tratado como
  // "premium" para herdar também os comportamentos associados (ex.: carta de
  // motivação sem truncar em llm.functions.ts).
  if (userId && (await checkIsAdmin(userId))) {
    const { data: inserted, error } = await supabaseAdmin
      .from("ai_usage")
      .insert({ user_id: userId, anon_fingerprint: null, feature, session_id: sessionId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return {
      allowed: true,
      reason: "ok",
      remainingToday: null,
      remainingMonth: null,
      retryAt: null,
      usageId: inserted.id,
      tier: "premium",
    };
  }

  const isPremium = userId ? await hasActivePlan(userId) : false;

  if (userId && !isPremium) {
    const creditResult = await tryCreditCoveredUsage(feature, userId, sessionId);
    if (creditResult) return creditResult;
  }

  // Fase B5 (Q1/Q3): plano com bypass de fair-use ignora os tectos normais do
  // tier premium e passa a ter só um teto horário técnico, invisível ao
  // utilizador. Lookup VIVO (getActiveFairUseBypass) — ver comentário lá.
  if (userId && isPremium) {
    const bypass = await getActiveFairUseBypass(userId);
    if (bypass) {
      const identity = { userId, fingerprint };
      if (bypass.fairUseHourlyCap != null) {
        const { count } = await countUsage(identity, null, Date.now() - HOUR_MS);
        if (count >= bypass.fairUseHourlyCap) {
          // Mesmo erro/mensagem genérica já usada pelo tecto diário normal do
          // premium (UsageLimitNotice.isPremiumFairUse) — nunca expor o teto.
          return {
            allowed: false,
            reason: "daily_limit",
            remainingToday: 0,
            remainingMonth: null,
            retryAt: null,
            usageId: null,
            tier: "premium",
          };
        }
      }

      const { data: inserted, error } = await supabaseAdmin
        .from("ai_usage")
        .insert({ user_id: userId, anon_fingerprint: null, feature, session_id: sessionId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return {
        allowed: true,
        reason: "ok",
        remainingToday: null,
        remainingMonth: null,
        retryAt: null,
        usageId: inserted.id,
        tier: "premium",
      };
    }
  }

  const tier: UsageTier = userId ? (isPremium ? "premium" : "free") : "anonymous";
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

  if (sessionId && policy?.max_per_session != null) {
    const sessionCount = await countSessionUsage(sessionId, feature);
    if (sessionCount >= policy.max_per_session) {
      return {
        allowed: false,
        reason: "session_limit",
        remainingToday: 0,
        remainingMonth: 0,
        retryAt: null,
        usageId: null,
        tier,
      };
    }
  }

  const quotaFeatures = policy?.quota_group
    ? await resolveQuotaGroupFeatures(policy.quota_group, tier)
    : null;
  const usageScope = quotaFeatures && quotaFeatures.length > 0 ? quotaFeatures : feature;

  let remainingToday: number | null = null;
  let remainingMonth: number | null = null;

  if (policy?.max_per_month != null) {
    const { count, oldest } = await countUsage(identity, usageScope, Date.now() - MONTH_MS);
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
    const { count, latest } = await countUsage(identity, usageScope, Date.now() - DAY_MS);
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
      session_id: sessionId,
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

/** Leitura sem efeitos secundários do saldo restante de uma feature (Fase 2 da
 * Proposta V3 — indicador "X análises restantes" na sidebar). Nunca insere em
 * `ai_usage`; só espelha o que checkAndRecordUsage calcularia antes de decidir. */
export async function peekRemainingUsage(
  feature: string,
  userId: string | null,
  fingerprint: string | null,
): Promise<{ remainingMonth: number | null; tier: UsageTier }> {
  const tier: UsageTier = userId
    ? (await hasActivePlan(userId))
      ? "premium"
      : "free"
    : "anonymous";
  const identity = { userId, fingerprint };
  const policy = await loadPolicy(feature, tier);
  if (!policy?.enabled || policy.max_per_month == null) {
    return { remainingMonth: null, tier };
  }

  const quotaFeatures = policy.quota_group
    ? await resolveQuotaGroupFeatures(policy.quota_group, tier)
    : null;
  const usageScope = quotaFeatures && quotaFeatures.length > 0 ? quotaFeatures : feature;
  const { count } = await countUsage(identity, usageScope, Date.now() - MONTH_MS);
  return { remainingMonth: Math.max(0, policy.max_per_month - count), tier };
}

export interface UsageSummaryItem {
  key: string;
  label: string;
  today: { remaining: number; resetAt: string | null } | null;
  month: { remaining: number; resetAt: string | null } | null;
}

const USAGE_SUMMARY_LABELS: Record<string, string> = {
  cv_analysis: "Análise de CV",
  ai_heavy: "Alinhamento CV ↔ TdR / CV via entrevista",
  cover_letter: "Carta de apresentação",
  download_free: "Download do CV",
};
const USAGE_SUMMARY_ORDER = Object.keys(USAGE_SUMMARY_LABELS);

/** Painel de uso do tier grátis — uma linha por feature (ou por quota_group,
 * quando partilhada, ex.: ai_heavy) com o saldo de hoje e do mês e quando cada
 * um renova. Só serve o tier grátis: premium tem fair-use invisível de
 * propósito (nunca expor o teto, ver getActiveFairUseBypass) e avulso já
 * mostra o seu próprio saldo de créditos (getActiveCreditBalance) — um pool
 * partilhado, não um teto por feature. */
export async function getUsageSummary(userId: string): Promise<UsageSummaryItem[]> {
  const { data, error } = await supabaseAdmin
    .from("access_policies")
    .select("feature, max_per_day, max_per_month, cooldown_hours, quota_group")
    .eq("tier", "free")
    .eq("enabled", true);
  if (error) throw new Error(error.message);

  const policies = data ?? [];
  const identity = { userId, fingerprint: null };
  const seen = new Set<string>();
  const items: UsageSummaryItem[] = [];

  for (const policy of policies) {
    if (policy.max_per_day == null && policy.max_per_month == null) continue;
    const key = policy.quota_group ?? policy.feature;
    if (seen.has(key)) continue;
    seen.add(key);

    const scope: string | string[] = policy.quota_group
      ? policies.filter((p) => p.quota_group === policy.quota_group).map((p) => p.feature)
      : policy.feature;

    let today: UsageSummaryItem["today"] = null;
    if (policy.max_per_day != null) {
      const { count, latest } = await countUsage(identity, scope, Date.now() - DAY_MS);
      const remaining = Math.max(0, policy.max_per_day - count);
      const cooldownMs = (policy.cooldown_hours ?? 24) * HOUR_MS;
      today = {
        remaining,
        resetAt:
          remaining === 0 && latest
            ? new Date(new Date(latest).getTime() + cooldownMs).toISOString()
            : null,
      };
    }

    let month: UsageSummaryItem["month"] = null;
    if (policy.max_per_month != null) {
      const { count, oldest } = await countUsage(identity, scope, Date.now() - MONTH_MS);
      const remaining = Math.max(0, policy.max_per_month - count);
      month = {
        remaining,
        resetAt:
          remaining === 0 && oldest
            ? new Date(new Date(oldest).getTime() + MONTH_MS).toISOString()
            : null,
      };
    }

    items.push({ key, label: USAGE_SUMMARY_LABELS[key] ?? key, today, month });
  }

  items.sort((a, b) => USAGE_SUMMARY_ORDER.indexOf(a.key) - USAGE_SUMMARY_ORDER.indexOf(b.key));
  return items;
}

/** Regista os tokens reais e o custo USD da chamada de IA já autorizada
 * (Fase 0.2, e Fase 0 da Proposta V3 §6 item 4 — custo real em vez de
 * estimativa por contagem de chamadas, gravado desde o primeiro request).
 * Nunca lança — telemetria não pode derrubar a resposta ao utilizador. */
export async function recordUsageTokens(
  usageId: string | null,
  usage: { inputTokens?: number; outputTokens?: number } | undefined,
): Promise<void> {
  if (!usageId || !usage) return;
  try {
    const tokensIn = usage.inputTokens ?? null;
    const tokensOut = usage.outputTokens ?? null;
    await supabaseAdmin
      .from("ai_usage")
      .update({
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        cost_usd: computeCostUsd(tokensIn, tokensOut),
      })
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
        tier: result.tier,
        creditsRemaining: result.creditsRemaining ?? null,
      }),
    );
    this.name = "LimitReachedError";
  }
}

export async function requireUsageAllowed(
  feature: string,
  userId: string | null,
  fingerprint: string | null,
  sessionId: string | null = null,
): Promise<UsageCheckResult> {
  const result = await checkAndRecordUsage(feature, userId, fingerprint, sessionId);
  if (!result.allowed) throw new LimitReachedError(result);
  return result;
}
