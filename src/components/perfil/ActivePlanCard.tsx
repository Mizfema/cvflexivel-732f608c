import { Link } from "@tanstack/react-router";
import { CheckCircle2, Crown, Coins, Sparkles, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPlanTimeLeft } from "@/lib/plan-time-format";

type ActivePlan =
  | { tier: "anonymous" }
  | { tier: "admin" }
  | {
      tier: "premium";
      plan: string | null;
      label: string | null;
      priceMzn: number | null;
      periodMinutes: number | null;
      periodEnd: string | null;
      minutesLeft: number | null;
    }
  | {
      tier: "avulso";
      packageId: string;
      label: string;
      balance: number;
      expiresAt: string;
    }
  | { tier: "free"; analysesRemaining: number | null };

/** Cartão "A minha assinatura" no /perfil. O botão de upgrade leva sempre a
 * /planos com `?from=perfil`, para essa página marcar o plano atual como já
 * comprado (badge + botão desativado). Sem duplicar lógica de checkout aqui. */
export function ActivePlanCard({ plan }: { plan: ActivePlan | null }) {
  if (!plan || plan.tier === "anonymous") return null;

  return (
    <section className="mb-8 rounded-xl border border-navy-rule bg-card p-6 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy-mid">
            A minha assinatura
          </p>
          <div className="mt-2 flex items-center gap-2">
            {plan.tier === "admin" || plan.tier === "premium" ? (
              <Crown className="h-4 w-4 shrink-0 text-navy" />
            ) : plan.tier === "avulso" ? (
              <Coins className="h-4 w-4 shrink-0 text-navy" />
            ) : (
              <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <h2 className="truncate font-serif text-xl text-foreground">
              {plan.tier === "admin"
                ? "Premium · Ilimitado (admin)"
                : plan.tier === "premium"
                  ? (plan.label ?? "Plano ativo")
                  : plan.tier === "avulso"
                    ? plan.label
                    : "Plano grátis"}
            </h2>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-ink-soft">
            {plan.tier === "premium" && (
              <>
                {plan.minutesLeft != null && (
                  <span>
                    <strong className="text-foreground">
                      {formatPlanTimeLeft(plan.minutesLeft)}
                    </strong>{" "}
                    restantes
                  </span>
                )}
                {plan.periodEnd && (
                  <span>
                    Expira em{" "}
                    <strong className="text-foreground">
                      {new Date(plan.periodEnd).toLocaleDateString("pt-PT", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </strong>
                  </span>
                )}
                {plan.priceMzn != null && (
                  <span>
                    Pago:{" "}
                    <strong className="text-foreground">{plan.priceMzn} MZN</strong>
                  </span>
                )}
              </>
            )}
            {plan.tier === "avulso" && (
              <>
                <span>
                  <strong className="text-foreground">{plan.balance}</strong> créditos
                </span>
                <span>
                  Válido até{" "}
                  <strong className="text-foreground">
                    {new Date(plan.expiresAt).toLocaleDateString("pt-PT", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </strong>
                </span>
              </>
            )}
            {plan.tier === "free" && (
              <span>
                {plan.analysesRemaining != null ? (
                  <>
                    <strong className="text-foreground">{plan.analysesRemaining}</strong> análises
                    grátis este mês
                  </>
                ) : (
                  "Funcionalidades limitadas"
                )}
              </span>
            )}
            {plan.tier === "admin" && (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Acesso total sem limites
              </span>
            )}
          </div>
        </div>

        {plan.tier !== "admin" && (
          <Link
            to="/planos"
            search={{ from: "perfil" }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            {plan.tier === "premium"
              ? "Fazer upgrade"
              : plan.tier === "avulso"
                ? "Ver planos"
                : "Ver planos"}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </section>
  );
}
