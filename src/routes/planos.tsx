import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, CreditCard, Smartphone, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getMyPlanStatus } from "@/lib/subscription.functions";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos — CV Flexível" },
      {
        name: "description",
        content:
          "Compara o plano grátis e o plano Premium do CV Flexível: download ilimitado, cartas de apresentação completas e preparação de entrevista.",
      },
    ],
  }),
  component: PlanosPage,
});

type Provider = "stripe" | "mpesa" | "emola";

const PROVIDERS: { id: Provider; label: string; Icon: typeof CreditCard }[] = [
  { id: "stripe", label: "Cartão", Icon: CreditCard },
  { id: "mpesa", label: "M-Pesa", Icon: Smartphone },
  { id: "emola", label: "e-Mola", Icon: Smartphone },
];

/* Matriz de acesso v1.0 (docs/PLANO-EXECUCAO.md secção 1.3) — usada como copy. */
const COMPARISON: { label: string; free: string; premium: string }[] = [
  { label: "Editar CV, trocar template (inclusive premium)", free: "Ilimitado", premium: "Ilimitado" },
  { label: "Analisar CV", free: "1×/24h, 3/mês", premium: "Ilimitado" },
  { label: "IA (sugestões, CV sob medida para vaga)", free: "2 usos, depois espera 24h; máx 4/mês", premium: "Ilimitado" },
  { label: "Download com template grátis", free: "1/dia, 3/mês", premium: "Ilimitado" },
  { label: "Download com template premium", free: "Experimenta, não baixa", premium: "Ilimitado" },
  { label: "Carta de apresentação", free: "Amostra parcial, 1×/24h, 3/mês", premium: "Completa, ilimitada" },
  { label: "Preparação de entrevista", free: "Só vitrine", premium: "Ilimitado" },
];

function PlanosPage() {
  const { session, ready } = useAuth();
  const getPlanStatus = useServerFn(getMyPlanStatus);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      setIsPremium(false);
      return;
    }
    getPlanStatus()
      .then((r) => setIsPremium(r.isPremium))
      .catch(() => setIsPremium(false));
  }, [ready, session, getPlanStatus]);

  function handleProviderClick(provider: Provider) {
    track("cta_click", { source: "planos_subscribe", provider });
    setSelectedProvider(provider);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy-mid">Planos</p>
        <h1 className="mt-3 font-serif text-3xl leading-tight text-foreground sm:text-4xl">
          Grátis para começar, <em className="font-serif text-navy">Premium para ir até ao fim</em>
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
          Os preços e os métodos de pagamento (cartão, M-Pesa, e-Mola) estão a ser finalizados.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <PlanCard title="Grátis" price="0 MZN" highlight={false} />
        <PlanCard title="Premium" price="A definir" highlight />
      </div>

      <div className="mt-10 overflow-x-auto rounded-xl border border-navy-rule">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-navy-rule bg-card text-left">
              <th className="p-4 font-serif text-base font-normal text-foreground">Funcionalidade</th>
              <th className="p-4 font-serif text-base font-normal text-foreground">Grátis</th>
              <th className="p-4 font-serif text-base font-normal text-navy">Premium</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map((row) => (
              <tr key={row.label} className="border-b border-navy-rule last:border-0">
                <td className="p-4 text-foreground">{row.label}</td>
                <td className="p-4 text-ink-soft">{row.free}</td>
                <td className="p-4 font-medium text-foreground">{row.premium}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-12 rounded-xl border border-navy-rule bg-card p-6 sm:p-8">
        {isPremium === true ? (
          <p className="flex items-center justify-center gap-2 text-center text-sm font-medium text-foreground">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            Já tens o plano Premium ativo. Obrigado por apoiares o CV Flexível.
          </p>
        ) : !session && ready ? (
          <div className="text-center">
            <p className="text-sm text-ink-soft">
              Cria a tua conta grátis primeiro — depois volta aqui para assinar o Premium.
            </p>
            <Link
              to="/auth"
              search={{ next: "/planos" }}
              className="mt-4 inline-flex items-center justify-center rounded-md bg-navy px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Criar conta grátis
            </Link>
          </div>
        ) : (
          <div>
            <p className="text-center text-sm font-medium text-foreground">
              Assinar Premium — escolhe o método de pagamento
            </p>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {PROVIDERS.map(({ id, label, Icon }) => (
                <Button
                  key={id}
                  variant="outline"
                  className="h-auto flex-col gap-2 py-4"
                  onClick={() => handleProviderClick(id)}
                >
                  <Icon className="h-5 w-5 text-navy-mid" />
                  {label}
                </Button>
              ))}
            </div>
            {selectedProvider && (
              <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                <XCircle className="h-3.5 w-3.5 shrink-0" />
                A integração de pagamento ainda está a ser finalizada. Assim que estiver pronta,
                avisamos-te por email.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PlanCard({
  title,
  price,
  highlight,
}: {
  title: string;
  price: string;
  highlight: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "rounded-xl border-2 border-navy bg-card p-6 shadow-elevated"
          : "rounded-xl border border-navy-rule bg-card p-6"
      }
    >
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-navy-mid">{title}</p>
      <p className="mt-2 font-serif text-3xl text-foreground">{price}</p>
      {highlight && <p className="mt-1 text-xs text-muted-foreground">por mês, quando disponível</p>}
    </div>
  );
}
