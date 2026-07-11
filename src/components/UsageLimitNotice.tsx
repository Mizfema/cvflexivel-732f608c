import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Coins, Loader2, Sparkles } from "lucide-react";
import { track } from "@/lib/analytics";
import type { LimitInfo } from "@/lib/usage-error";
import { createCreditCheckout } from "@/lib/subscription.functions";

const REASON_MESSAGE: Record<LimitInfo["reason"], string> = {
  not_allowed_tier: "Isto faz parte do plano pago.",
  daily_limit: "Atingiste o limite diário desta funcionalidade.",
  monthly_limit: "Atingiste o limite mensal desta funcionalidade.",
  global_limit: "Muitos pedidos em pouco tempo. Tenta novamente mais tarde.",
  session_limit:
    "Atingiste o limite de sugestões nesta sessão. Recarrega a página para continuares.",
  insufficient_credits: "Não tens créditos suficientes para esta operação.",
};

/** Tecto invisível de fair-use do plano ilimitado (Proposta V3 §5) — quem já é
 * premium nunca vê isto na copy de venda, só ao bater no limite. Mensagem
 * suave, sem upsell (já pagou), com saída para contacto em vez de "/planos". */
const PREMIUM_FAIR_USE_MESSAGE =
  "Atingiste o máximo diário desta funcionalidade. Volta amanhã ou contacta-nos se precisas de mais volume.";

/** Pendente de configuração real (mesmo padrão de RESEND_API_KEY/ADMIN_ALERT_EMAIL
 * — ver docs/PLANO-EXECUCAO.md): define VITE_SUPPORT_CONTACT_URL com um mailto:
 * ou link de WhatsApp real assim que existir um canal de suporte. */
const SUPPORT_CONTACT_URL =
  import.meta.env.VITE_SUPPORT_CONTACT_URL || "mailto:suporte@cvflexivel.co.mz";

function formatCountdown(ms: number): string {
  if (ms <= 0) return "já disponível";
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}min`;
  return `${h}h ${m}min`;
}

function Countdown({ retryAt }: { retryAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = new Date(retryAt).getTime() - now;
  return <>{formatCountdown(remaining)}</>;
}

/** Recarga (79 MZN/+4 créditos) só existe in-app, nunca na página `/planos`
 * (regra de ouro §2 do doc V3) — por isso o botão inicia o checkout
 * diretamente daqui em vez de linkar para /planos. */
function RechargeButton() {
  const startCheckout = useServerFn(createCreditCheckout);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    track("checkout_started", { plan: "recarga" });
    setLoading(true);
    setError(null);
    try {
      const { checkoutUrl } = await startCheckout({ data: { plan: "recarga" } });
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar a recarga.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-900 px-3 py-1.5 text-xs font-medium text-amber-50 transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Coins className="h-3.5 w-3.5" />
        )}
        Recarregar (+4 créditos · 79 MZN)
      </button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function UsageLimitNotice({
  feature,
  reason,
  retryAt,
  tier,
  creditsRemaining,
}: LimitInfo & { feature: string }) {
  // Tecto de fair-use invisível (Proposta V3 §5): quem já é premium bateu num
  // tecto diário técnico, não num limite de venda — mensagem e CTA diferentes.
  const isPremiumFairUse =
    tier === "premium" && (reason === "daily_limit" || reason === "monthly_limit");
  const isInsufficientCredits = reason === "insufficient_credits";
  // Só é "paywall" quando o CTA é mesmo a upsell para /planos — fair-use do
  // premium e falta de créditos do avulso são outras jornadas (Fase 4 §8).
  const isPaywallUpsell = !isPremiumFairUse && !isInsufficientCredits;

  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    track("limit_hit", { feature, reason, tier });
    if (isPaywallUpsell) {
      track("paywall_opened", { feature, reason, tier });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feature, reason, tier]);
  const message = isPremiumFairUse
    ? PREMIUM_FAIR_USE_MESSAGE
    : isInsufficientCredits
      ? `Não tens créditos suficientes para esta operação (restam ${creditsRemaining ?? 0}).`
      : REASON_MESSAGE[reason];

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <Clock className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{message}</p>
        {retryAt && !isPremiumFairUse && !isInsufficientCredits && (
          <p className="mt-1 text-amber-800">
            Disponível de novo em <Countdown retryAt={retryAt} />.
          </p>
        )}
        {isPremiumFairUse ? (
          <a
            href={SUPPORT_CONTACT_URL}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-900 px-3 py-1.5 text-xs font-medium text-amber-50 transition-opacity hover:opacity-90"
          >
            Contacta-nos
          </a>
        ) : isInsufficientCredits ? (
          <RechargeButton />
        ) : (
          <Link
            to="/planos"
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-900 px-3 py-1.5 text-xs font-medium text-amber-50 transition-opacity hover:opacity-90"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Não quer esperar? Veja os planos
          </Link>
        )}
      </div>
    </div>
  );
}
