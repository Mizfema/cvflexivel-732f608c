// Cliente-safe: interpreta o erro estruturado que `LimitReachedError`
// (src/lib/access-control.server.ts) serializa em `error.message`, porque o
// transporte de erros entre server function e cliente só preserva `message`.

export type UsageDenyReason =
  | "not_allowed_tier"
  | "daily_limit"
  | "monthly_limit"
  | "global_limit"
  | "session_limit"
  | "insufficient_credits";

export type UsageTier = "anonymous" | "free" | "premium";

export interface LimitInfo {
  reason: UsageDenyReason;
  retryAt: string | null;
  upgrade: boolean;
  tier: UsageTier;
  /** Só definido quando reason === "insufficient_credits" (Fase 3 da Proposta V3). */
  creditsRemaining: number | null;
}

export function parseLimitError(error: unknown): LimitInfo | null {
  if (!(error instanceof Error)) return null;
  try {
    const parsed = JSON.parse(error.message);
    if (parsed && parsed.code === "LIMIT_REACHED") {
      return {
        reason: parsed.reason,
        retryAt: parsed.retryAt ?? null,
        upgrade: Boolean(parsed.upgrade),
        tier: parsed.tier ?? "free",
        creditsRemaining: parsed.creditsRemaining ?? null,
      };
    }
  } catch {
    // não era JSON — erro genérico, não um LimitReachedError.
  }
  return null;
}
