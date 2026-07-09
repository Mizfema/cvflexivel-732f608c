import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Clock, Sparkles } from "lucide-react";
import { track } from "@/lib/analytics";
import type { LimitInfo } from "@/lib/usage-error";

const REASON_MESSAGE: Record<LimitInfo["reason"], string> = {
  not_allowed_tier: "Isto faz parte do plano pago.",
  daily_limit: "Atingiste o limite diário desta funcionalidade.",
  monthly_limit: "Atingiste o limite mensal desta funcionalidade.",
  global_limit: "Muitos pedidos em pouco tempo. Tenta novamente mais tarde.",
};

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

export function UsageLimitNotice({ feature, reason, retryAt }: LimitInfo & { feature: string }) {
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    track("limit_hit", { feature, reason });
  }, [feature, reason]);

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <Clock className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{REASON_MESSAGE[reason]}</p>
        {retryAt && (
          <p className="mt-1 text-amber-800">
            Disponível de novo em <Countdown retryAt={retryAt} />.
          </p>
        )}
        <Link
          to="/planos"
          className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-900 px-3 py-1.5 text-xs font-medium text-amber-50 transition-opacity hover:opacity-90"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Não quer esperar? Veja os planos
        </Link>
      </div>
    </div>
  );
}
