import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  AlertTriangle,
  CheckCircle2,
  Coins,
  Infinity as InfinityIcon,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from "@/hooks/use-auth";
import {
  getMyPlanStatus,
  createSubscriptionCheckout,
  createCreditCheckout,
  getPlanPrices,
  getMyCreditBalance,
} from "@/lib/subscription.functions";
import { track } from "@/lib/analytics";

const searchSchema = z.object({
  checkout: z.string().optional(),
});

export const Route = createFileRoute("/planos")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Planos — CV Flexível" },
      {
        name: "description",
        content:
          "Compara o plano grátis, o pacote avulso e a assinatura Premium do CV Flexível: download ilimitado, cartas de apresentação completas e preparação de entrevista.",
      },
    ],
  }),
  component: PlanosPage,
});

/* Só um selo de confiança visual — o método real é escolhido no checkout hospedado da PaySuite. */
const TRUSTED_METHODS = ["M-Pesa", "e-Mola", "mKesh", "Visa/Mastercard"];

type PlanPrice = {
  plan: string;
  price_mzn: number;
  period_days: number | null;
  credits: number | null;
  label: string;
};

/* Tabela comparativa (docs/PROPOSTA-V3-FINAL-CONSOLIDADA.md §2/§4). "Por crédito" no
 * avulso é copy, não cálculo — os pesos exactos vivem na secção 3 do documento. */
const COMPARISON: { label: string; free: string; avulso: string; premium: string }[] = [
  {
    label: "Editar CV, trocar template, sugestões de campo",
    free: "Ilimitado",
    avulso: "Ilimitado",
    premium: "Ilimitado",
  },
  { label: "Analisar CV vs vaga", free: "3/mês", avulso: "Por crédito", premium: "Ilimitado" },
  {
    label: "IA pesada (CV alinhado, CV por entrevista)",
    free: "2/mês",
    avulso: "Por crédito",
    premium: "Ilimitado",
  },
  {
    label: "Carta de apresentação",
    free: "Amostra parcial, 3/mês",
    avulso: "Por crédito",
    premium: "Completa, ilimitada",
  },
  {
    label: "Preparação de entrevista",
    free: "Só vitrine",
    avulso: "Por crédito",
    premium: "Ilimitado",
  },
  {
    label: "Download com template premium",
    free: "Experimenta, não baixa",
    avulso: "Desbloqueado",
    premium: "Ilimitado",
  },
];

/* Perguntas frequentes — matemática já corrigida (secção 10, ronda 4 do doc V3):
 * o mensal só compensa a partir da 3ª candidatura, nunca da 2ª (298 < 349). */
const FAQ: { q: string; a: string }[] = [
  {
    q: 'O "ilimitado" tem letras pequenas?',
    a: "Existem limites diários muito acima do uso normal, só para proteger o serviço contra abuso automatizado. Um candidato a fazer 3 ou 4 candidaturas por dia nunca os atinge. Só quem estiver a produzir CVs em série para terceiros vê o aviso.",
  },
  {
    q: "O pagamento renova sozinho?",
    a: "Não. Pagas uma vez, usas pelo período do passe, e só compras de novo se quiseres. Sem surpresas na tua conta M-Pesa ou e-Mola.",
  },
  {
    q: "Qual a diferença entre avulso e mensal?",
    a: "O avulso dá créditos que gastas conforme usas — bom para 1 candidatura pontual. O mensal é ilimitado por 30 dias — se vais candidatar-te a mais que 2 vagas, sai mais barato que comprar avulso duas vezes.",
  },
  {
    q: "O que acontece quando o passe expira?",
    a: "O teu CV continua teu e editável. Só as funcionalidades premium voltam aos limites do plano grátis, e créditos não usados do avulso expiram com o pacote.",
  },
  {
    q: "Como pago com M-Pesa ou e-Mola?",
    a: 'Ao clicar em "Ativar", és redirecionado para o checkout seguro da PaySuite, onde escolhes o método e confirmas com o PIN do teu telemóvel.',
  },
];

function PlanosPage() {
  const { checkout } = Route.useSearch();
  const { session, ready } = useAuth();
  const getPlanStatus = useServerFn(getMyPlanStatus);
  const startCheckout = useServerFn(createSubscriptionCheckout);
  const startCreditCheckout = useServerFn(createCreditCheckout);
  const fetchPlanPrices = useServerFn(getPlanPrices);
  const fetchCreditBalance = useServerFn(getMyCreditBalance);

  const [prices, setPrices] = useState<PlanPrice[] | null>(null);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [expiryWarning, setExpiryWarning] = useState<{ daysLeft: number } | null>(null);
  const [creditBalance, setCreditBalance] = useState<{
    balance: number;
    expiresAt: string;
  } | null>(null);
  const [subscribingPlan, setSubscribingPlan] = useState<"mensal" | "trimestral" | null>(null);
  const [buyingAvulso, setBuyingAvulso] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [returning, setReturning] = useState(!!checkout);

  useEffect(() => {
    fetchPlanPrices()
      .then(setPrices)
      .catch(() => setPrices([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      setIsPremium(false);
      setCreditBalance(null);
      setReturning(false);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let trackedCompletion = false;

    // Regressar de um checkout (mensal/trimestral, ?checkout=<subscription.id>,
    // ou avulso/recarga, ?checkout=<payment.id>) não diz qual dos dois — por
    // isso tenta os dois em paralelo e para assim que qualquer um confirmar
    // (Fase 4 da Proposta V3 §8: dispara "payment_completed" nesse momento).
    function poll() {
      Promise.all([getPlanStatus(), fetchCreditBalance()])
        .then(([planStatus, credits]) => {
          if (cancelled) return;
          setIsPremium(planStatus.isPremium);
          setExpiryWarning(planStatus.expiryWarning);
          setCreditBalance(credits);
          attempts += 1;

          const succeeded = planStatus.isPremium || credits != null;
          if (checkout && succeeded && !trackedCompletion) {
            trackedCompletion = true;
            track("payment_completed", { kind: planStatus.isPremium ? "premium" : "credits" });
          }

          if (checkout && !succeeded && attempts < 5) {
            setTimeout(poll, 2000);
          } else {
            setReturning(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setIsPremium(false);
            setReturning(false);
          }
        });
    }
    poll();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session, getPlanStatus, fetchCreditBalance]);

  async function handleSubscribeClick(plan: "mensal" | "trimestral") {
    track("cta_click", { source: `planos_subscribe_${plan}` });
    track("checkout_started", { plan });
    setCheckoutError(null);
    setSubscribingPlan(plan);
    try {
      const { checkoutUrl } = await startCheckout({ data: { plan } });
      window.location.href = checkoutUrl;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Erro ao iniciar o pagamento.");
      setSubscribingPlan(null);
    }
  }

  async function handleBuyAvulso() {
    track("cta_click", { source: "planos_subscribe_avulso" });
    track("checkout_started", { plan: "avulso" });
    setCheckoutError(null);
    setBuyingAvulso(true);
    try {
      const { checkoutUrl } = await startCreditCheckout({ data: { plan: "avulso" } });
      window.location.href = checkoutUrl;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Erro ao iniciar o pagamento.");
      setBuyingAvulso(false);
    }
  }

  // "recarga" nunca aparece na página /planos (regra de ouro §2 do doc V3) —
  // filtrado aqui mesmo que a tabela plan_prices o devolva no futuro.
  const avulso = prices?.find((p) => p.plan === "avulso") ?? null;
  const mensal = prices?.find((p) => p.plan === "mensal") ?? null;
  const trimestral = prices?.find((p) => p.plan === "trimestral") ?? null;

  const avulsoDouble = avulso ? avulso.price_mzn * 2 : null;
  const trimestralSavings =
    mensal && trimestral ? mensal.price_mzn * 3 - trimestral.price_mzn : null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy-mid">Planos</p>
        <h1 className="mt-3 font-serif text-3xl leading-tight text-foreground sm:text-4xl">
          Escolhe o passe certo para a tua{" "}
          <em className="font-serif text-navy">próxima oportunidade</em>
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
          Pagamento seguro através da PaySuite — escolhes o método no checkout. Sem renovação
          automática.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-navy-mid" />
          {TRUSTED_METHODS.join(" · ")}
        </div>
      </div>

      {expiryWarning && (
        <div className="mt-8 flex items-center justify-center gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-center text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />O teu plano expira em{" "}
          {expiryWarning.daysLeft} {expiryWarning.daysLeft === 1 ? "dia" : "dias"} — renova abaixo
          pela PaySuite.
        </div>
      )}

      {/* Ancoragem visual: a matemática que faz o mensal ganhar sozinho. */}
      {avulso && avulsoDouble && mensal && (
        <div className="mt-10 flex flex-col divide-y divide-navy-rule overflow-hidden rounded-xl border border-navy-rule bg-card sm:flex-row sm:divide-x sm:divide-y-0">
          <div className="flex-1 p-4 text-center">
            <p className="font-serif text-xl text-foreground">
              {avulso.price_mzn} <small className="text-xs font-sans text-ink-soft">MZN</small>
            </p>
            <p className="mt-1 text-xs text-ink-soft">1 candidatura avulsa</p>
          </div>
          <div className="flex-1 p-4 text-center">
            <p className="font-serif text-xl text-foreground">
              {avulsoDouble} <small className="text-xs font-sans text-ink-soft">MZN</small>
            </p>
            <p className="mt-1 text-xs text-ink-soft">2 candidaturas avulsas</p>
          </div>
          <div className="flex-1 bg-emerald-50 p-4 text-center">
            <p className="font-serif text-xl text-navy">
              {mensal.price_mzn} <small className="text-xs font-sans text-ink-soft">MZN</small>
            </p>
            <p className="mt-1 text-xs font-semibold text-emerald-700">Mês inteiro sem contar</p>
          </div>
        </div>
      )}

      {/* 4 cards */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <PlanCard title="Grátis" price="0 MZN" meta="Renova todo mês">
          <Feat ok>Editor de CV ilimitado</Feat>
          <Feat ok>Sugestões de campo livres</Feat>
          <Feat ok>3 análises de CV/mês</Feat>
          <Feat ok>2 usos de IA pesada/mês</Feat>
          <Feat ok>3 cartas (amostra)/mês</Feat>
          <Feat>Templates premium</Feat>
          {!session && ready ? (
            <Link
              to="/auth"
              search={{ next: "/planos" }}
              className="mt-auto inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
            >
              Criar conta grátis
            </Link>
          ) : (
            <Button variant="outline" className="mt-auto" disabled>
              {isPremium ? "Inclui o teu plano" : "Já és grátis"}
            </Button>
          )}
        </PlanCard>

        <PlanCard
          title={avulso ? `${avulso.label}` : "Avulso"}
          price={avulso ? `${avulso.price_mzn} MZN` : "—"}
          meta={
            avulso ? `${avulso.credits ?? "—"} créditos · válido ${avulso.period_days} dias` : ""
          }
        >
          <Feat icon={<Coins className="h-3.5 w-3.5 text-navy" />}>
            <strong>{avulso?.credits ?? 8} créditos</strong> = 1 candidatura completa com folga
          </Feat>
          <Feat ok>Templates premium desbloqueados</Feat>
          <Feat ok>Downloads sem marca d'água</Feat>
          <Feat ok>Válido {avulso?.period_days ?? 30} dias sem renovar</Feat>
          {!session && ready ? (
            <Link
              to="/auth"
              search={{ next: "/planos" }}
              className="mt-auto inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
            >
              Criar conta grátis
            </Link>
          ) : isPremium ? (
            <Button variant="outline" className="mt-auto" disabled>
              Inclui o teu plano
            </Button>
          ) : creditBalance ? (
            <Button variant="outline" className="mt-auto" disabled>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {creditBalance.balance} créditos ativos
            </Button>
          ) : (
            <Button
              variant="outline"
              className="mt-auto"
              disabled={!avulso || buyingAvulso || subscribingPlan !== null || returning}
              onClick={handleBuyAvulso}
            >
              {buyingAvulso ? <Loader2 className="h-4 w-4 animate-spin" /> : "Comprar avulso"}
            </Button>
          )}
        </PlanCard>

        <PlanCard
          title={mensal ? `${mensal.label} · ${mensal.period_days} dias` : "Mensal"}
          price={mensal ? `${mensal.price_mzn} MZN` : "—"}
          meta="Pagamento único, sem renovação automática"
          highlight
          badge="Mais escolhido"
        >
          <Feat icon={<InfinityIcon className="h-3.5 w-3.5 text-navy" />}>
            <strong>Tudo ilimitado</strong> por {mensal?.period_days ?? 30} dias
          </Feat>
          <Feat ok>Análises, IA e cartas sem contar</Feat>
          <Feat ok>Todos os templates premium</Feat>
          <Feat ok>Downloads sem marca d'água</Feat>
          <Feat ok>Preparação de entrevista completa</Feat>
          {!session && ready ? (
            <Link
              to="/auth"
              search={{ next: "/planos" }}
              className="mt-auto inline-flex h-9 items-center justify-center rounded-md bg-navy px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Criar conta grátis
            </Link>
          ) : isPremium ? (
            <Button className="mt-auto bg-navy hover:bg-navy/90" disabled>
              <CheckCircle2 className="h-4 w-4" />
              Plano ativo
            </Button>
          ) : (
            <Button
              className="mt-auto bg-navy hover:bg-navy/90"
              disabled={!mensal || subscribingPlan !== null || returning}
              onClick={() => handleSubscribeClick("mensal")}
            >
              {subscribingPlan === "mensal" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Ativar Mensal"
              )}
            </Button>
          )}
        </PlanCard>

        <PlanCard
          title={trimestral ? `${trimestral.label} · ${trimestral.period_days} dias` : "Trimestral"}
          price={trimestral ? `${trimestral.price_mzn} MZN` : "—"}
          meta="Pagamento único, sem renovação automática"
          badge={trimestralSavings ? `Poupa ${trimestralSavings} MZN` : undefined}
          badgeVariant="save"
        >
          <Feat icon={<InfinityIcon className="h-3.5 w-3.5 text-navy" />}>
            <strong>Tudo ilimitado</strong> por {trimestral?.period_days ?? 90} dias
          </Feat>
          <Feat ok>Cobre o ciclo de procura completo</Feat>
          <Feat ok>Sem renovações manuais no meio</Feat>
          {!session && ready ? (
            <Link
              to="/auth"
              search={{ next: "/planos" }}
              className="mt-auto inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
            >
              Criar conta grátis
            </Link>
          ) : isPremium ? (
            <Button variant="outline" className="mt-auto" disabled>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Plano ativo
            </Button>
          ) : (
            <Button
              variant="outline"
              className="mt-auto"
              disabled={!trimestral || subscribingPlan !== null || returning}
              onClick={() => handleSubscribeClick("trimestral")}
            >
              {subscribingPlan === "trimestral" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Ativar Trimestral"
              )}
            </Button>
          )}
        </PlanCard>
      </div>

      {returning && (
        <p className="mt-4 flex items-center justify-center gap-2 text-sm text-ink-soft">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />A confirmar o teu pagamento…
        </p>
      )}
      {checkoutError && (
        <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {checkoutError}
        </p>
      )}

      {/* Como funcionam os créditos do avulso */}
      <div className="mt-10 rounded-xl border border-navy-rule bg-card p-5">
        <p className="font-serif text-base text-foreground">Como funcionam os créditos do avulso</p>
        <p className="mt-1 text-xs text-ink-soft">
          Só se aplica ao pacote avulso. Nos planos mensal e trimestral é tudo ilimitado.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CreditItem cost={0} title="Editar CV" desc="Grátis para sempre" />
          <CreditItem cost={0} title="Sugestão de campo" desc="Livre com limite por sessão" />
          <CreditItem cost={1} title="Analisar CV vs vaga" desc="Cobertura, lacunas e sugestões" />
          <CreditItem cost={1} title="Carta de apresentação" desc="Carta completa personalizada" />
          <CreditItem cost={2} title="CV alinhado à vaga" desc="Reescreve o CV para a vaga" />
          <CreditItem cost={2} title="Preparação de entrevista" desc="Perguntas e pontos-chave" />
          <CreditItem
            cost={3}
            title="CV via entrevista com IA"
            desc="A IA constrói o CV numa conversa"
          />
          <CreditItem cost={0} title="Download PDF/Word" desc="Durante a validade do pacote" />
          <CreditItem cost={0} title="Trocar template" desc="Grátis, inclusive premium" />
        </div>
        <p className="mt-4 rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-ink-soft">
          <strong className="text-foreground">Candidatura completa típica:</strong> análise (1) + CV
          alinhado (2) + carta (1) + preparação de entrevista (2) ={" "}
          <strong className="text-foreground">6 créditos</strong>. O avulso traz{" "}
          {avulso?.credits ?? 8} — folga de 2 para uma segunda tentativa.
        </p>
      </div>

      {/* Comparação */}
      <h2 className="mt-10 font-serif text-lg text-foreground">Comparar planos</h2>
      <div className="mt-4 overflow-x-auto rounded-xl border border-navy-rule">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-navy-rule bg-card text-left">
              <th className="p-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Funcionalidade
              </th>
              <th className="p-3 text-center text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Grátis
              </th>
              <th className="p-3 text-center text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Avulso
              </th>
              <th className="p-3 text-center text-xs font-semibold uppercase tracking-wide text-navy">
                Mensal / Trimestral
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map((row) => (
              <tr key={row.label} className="border-b border-navy-rule last:border-0">
                <td className="p-3 text-foreground">{row.label}</td>
                <td className="p-3 text-center text-ink-soft">{row.free}</td>
                <td className="p-3 text-center text-ink-soft">{row.avulso}</td>
                <td className="p-3 text-center font-medium text-foreground">{row.premium}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FAQ */}
      <h2 className="mt-10 font-serif text-lg text-foreground">Perguntas frequentes</h2>
      <Accordion type="single" collapsible className="mt-2">
        {FAQ.map((item, i) => (
          <AccordionItem key={item.q} value={`faq-${i}`} className="border-navy-rule">
            <AccordionTrigger className="text-foreground">{item.q}</AccordionTrigger>
            <AccordionContent className="text-ink-soft">{item.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
        <span>M-Pesa</span>
        <span className="h-3.5 w-px bg-navy-rule" />
        <span>e-Mola</span>
        <span className="h-3.5 w-px bg-navy-rule" />
        <span>Cartão</span>
        <span className="h-3.5 w-px bg-navy-rule" />
        <span>Pagamento único, sem surpresas</span>
      </div>
    </div>
  );
}

function PlanCard({
  title,
  price,
  meta,
  highlight,
  badge,
  badgeVariant,
  children,
}: {
  title: string;
  price: string;
  meta?: string;
  highlight?: boolean;
  badge?: string;
  badgeVariant?: "save";
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        highlight
          ? "relative flex flex-col rounded-xl border-2 border-navy bg-card p-5 shadow-elevated"
          : "relative flex flex-col rounded-xl border border-navy-rule bg-card p-5"
      }
    >
      {badge && (
        <span
          className={
            badgeVariant === "save"
              ? "absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-800"
              : "absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-800"
          }
        >
          {badge}
        </span>
      )}
      <p
        className={
          highlight
            ? "text-xs font-semibold uppercase tracking-wide text-navy"
            : "text-xs font-semibold uppercase tracking-wide text-ink-soft"
        }
      >
        {title}
      </p>
      <p className="mt-2 font-serif text-2xl text-foreground">{price}</p>
      {meta && <p className="mt-1 min-h-[2rem] text-xs text-muted-foreground">{meta}</p>}
      <div className="mt-3 flex flex-1 flex-col gap-2 border-t border-navy-rule pt-3">
        {children}
      </div>
    </div>
  );
}

function Feat({
  ok,
  icon,
  children,
}: {
  ok?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
      {icon ?? (
        <CheckCircle2
          className={
            ok
              ? "mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600"
              : "mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40"
          }
        />
      )}
      <span className={ok || icon ? "" : "text-muted-foreground/60"}>{children}</span>
    </p>
  );
}

function CreditItem({ cost, title, desc }: { cost: number; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={
          cost === 0
            ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-100 font-serif text-sm font-bold text-emerald-800"
            : "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted font-serif text-sm font-bold text-ink-soft"
        }
      >
        {cost}
      </span>
      <div>
        <p className="text-xs font-medium text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
