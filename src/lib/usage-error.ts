// Cliente-safe: interpreta o erro estruturado que `LimitReachedError`
// (src/lib/access-control.server.ts) serializa em `error.message`, porque o
// transporte de erros entre server function e cliente só preserva `message`.

export type UsageDenyReason = "not_allowed_tier" | "daily_limit" | "monthly_limit" | "global_limit";

export interface LimitInfo {
  reason: UsageDenyReason;
  retryAt: string | null;
  upgrade: boolean;
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
      };
    }
  } catch {
    // não era JSON — erro genérico, não um LimitReachedError.
  }
  return null;
}
