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
import { formatPlanDuration } from "@/lib/plan-time-format";
import { track } from "@/lib/analytics";

const searchSchema = z.object({
  checkout: z.string().optional(),
  from: z.enum(["perfil"]).optional(),
});


export const Route = createFileRoute("/planos")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Planos — CVelite" },
      {
        name: "description",
        content:
          "Compara o plano grátis, o pacote avulso e a assinatura Premium do CVelite: download ilimitado, cartas de apresentação completas e preparação de entrevista.",
      },
    ],
  }),
  component: PlanosPage,
});

/* Só um selo de confiança visual — o método real é escolhido no checkout hospedado da PaySuite. */
const TRUSTED_METHODS = ["M-Pesa", "e-Mola", "mKesh", "Visa/Mastercard"];

/* Fase B4 do Guia B0-B5: getPlanPrices() já devolve só a allowlist pública
 * (N3) — nunca bypasses_fair_use/fair_use_hourly_cap — e já vem ordenada por
 * display_order e filtrada a enabled+visible_on_pricing_page. */
type PlanPrice = {
  plan: string;
  label: string;
  kind: "subscription_unlimited" | "credit_pack";
  price_mzn: number;
  effective_price_mzn: number;
  is_promotional: boolean;
  promo_badge_text: string | null;
  promo_ends_at: string | null;
  period_minutes: number | null;
  credits: number | null;
  features: string[];
  display_order: number;
};

/* Preço efetivo + countdown recalculados no cliente ao ritmo de 1/min (N2):
 * ao expirar promo_ends_at, o preço risca de volta ao normal e o selo some
 * sozinho, sem reload — a mesma condição de getEffectivePlanPrice no
 * servidor, só que reavaliada aqui a cada minuto para ser reativa. */
function usePromoStatus(plan: PlanPrice | null) {
  const [now, setNow] = useState(() => Date.now());
  const promoEndsAt = plan?.promo_ends_at ?? null;
  const isPromotional = plan?.is_promotional ?? false;

  useEffect(() => {
    if (!isPromotional || !promoEndsAt) return;
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, [isPromotional, promoEndsAt]);

  if (!plan || !isPromotional || !promoEndsAt) {
    return { active: false, countdownLabel: null as string | null };
  }
  const msLeft = new Date(promoEndsAt).getTime() - now;
  if (msLeft <= 0) return { active: false, countdownLabel: null };
  return { active: true, countdownLabel: formatCountdown(msLeft) };
}

function formatCountdown(msLeft: number): string {
  const totalMinutes = Math.ceil(msLeft / 60_000);
  if (totalMinutes >= 48 * 60) {
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    return `Termina em ${days}d ${hours}h`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `Termina em ${hours}h ${minutes}min` : `Termina em ${minutes}min`;
}

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
  const [subscribingPlan, setSubscribingPlan] = useState<string | null>(null);
  const [buyingPlan, setBuyingPlan] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [returning, setReturning] = useState(!!checkout);
  const [confirmDelayed, setConfirmDelayed] = useState(false);

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
    // Janela rápida (5×2s) cobre o caminho feliz (webhook a funcionar); depois
    // disso passa a polling mais espaçado (10×15s ≈ 2.5min) porque, enquanto
    // o webhook da PaySuite devolver 401 (bug confirmado do lado deles,
    // 15/07/2026), a confirmação só chega via job de reconciliação a cada
    // 3min — sem isto o cliente veria "a confirmar" sumir sem nunca ter
    // confirmado, e pensaria que perdeu o dinheiro.
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

          if (!checkout || succeeded) {
            setReturning(false);
            setConfirmDelayed(false);
            return;
          }

          if (attempts < 5) {
            setTimeout(poll, 2000);
          } else if (attempts < 15) {
            setReturning(false);
            setConfirmDelayed(true);
            setTimeout(poll, 15000);
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

  async function handleSubscribeClick(plan: string) {
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

  async function handleBuyCredits(plan: string) {
    track("cta_click", { source: `planos_subscribe_${plan}` });
    track("checkout_started", { plan });
    setCheckoutError(null);
    setBuyingPlan(plan);
    try {
      const { checkoutUrl } = await startCreditCheckout({ data: { plan } });
      window.location.href = checkoutUrl;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Erro ao iniciar o pagamento.");
      setBuyingPlan(null);
    }
  }

  // "recarga" nunca aparece na página /planos (regra de ouro §2 do doc V3) —
  // já filtrado no servidor via visible_on_pricing_page, mas o find() abaixo
  // continua explícito para os 3 planos com layout próprio.
  const avulso = prices?.find((p) => p.plan === "avulso") ?? null;
  const mensal = prices?.find((p) => p.plan === "mensal") ?? null;
  const trimestral = prices?.find((p) => p.plan === "trimestral") ?? null;
  // Fase B4: qualquer plano novo criado no admin (fora dos 3 com layout
  // próprio) aparece aqui, já na posição certa (display_order vem do servidor).
  const otherPlans =
    prices?.filter((p) => p.plan !== "avulso" && p.plan !== "mensal" && p.plan !== "trimestral") ??
    [];

  // Reavaliado a cada minuto (mesma promo status do PlanPriceDisplay) — sem
  // isto, a caixa de ancoragem ficaria presa no preço promocional do fetch
  // inicial mesmo depois da promoção expirar.
  const avulsoPromo = usePromoStatus(avulso);
  const mensalPromo = usePromoStatus(mensal);
  const trimestralPromo = usePromoStatus(trimestral);
  const avulsoEffective = avulso ? (avulsoPromo.active ? avulso.effective_price_mzn : avulso.price_mzn) : null;
  const mensalEffective = mensal ? (mensalPromo.active ? mensal.effective_price_mzn : mensal.price_mzn) : null;
  const trimestralEffective = trimestral
    ? trimestralPromo.active
      ? trimestral.effective_price_mzn
      : trimestral.price_mzn
    : null;

  // Enquanto confirmDelayed, um novo pagamento ainda não é seguro (o anterior
  // pode confirmar a qualquer momento via job de reconciliação) — mantém os
  // botões desativados para não arriscar pagamento duplicado.
  const checkoutInFlight = returning || confirmDelayed;

  const avulsoDouble = avulsoEffective ? avulsoEffective * 2 : null;
  const trimestralSavings =
    mensalEffective && trimestralEffective ? mensalEffective * 3 - trimestralEffective : null;

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
              {avulsoEffective} <small className="text-xs font-sans text-ink-soft">MZN</small>
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
              {mensalEffective} <small className="text-xs font-sans text-ink-soft">MZN</small>
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
          price={<PlanPriceDisplay plan={avulso} fallback="—" />}
          meta={
            avulso
              ? `${avulso.credits ?? "—"} créditos · válido ${formatPlanDuration(avulso.period_minutes)}`
              : ""
          }
        >
          <Feat icon={<Coins className="h-3.5 w-3.5 text-navy" />}>
            <strong>{avulso?.credits ?? 8} créditos</strong> = 1 candidatura completa com folga
          </Feat>
          <Feat ok>Templates premium desbloqueados</Feat>
          <Feat ok>Downloads sem marca d'água</Feat>
          <Feat ok>Válido {formatPlanDuration(avulso?.period_minutes ?? 43200)} sem renovar</Feat>
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
              disabled={!avulso || buyingPlan !== null || subscribingPlan !== null || checkoutInFlight}
              onClick={() => handleBuyCredits("avulso")}
            >
              {buyingPlan === "avulso" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Comprar avulso"
              )}
            </Button>
          )}
        </PlanCard>

        <PlanCard
          title={mensal ? `${mensal.label} · ${formatPlanDuration(mensal.period_minutes)}` : "Mensal"}
          price={<PlanPriceDisplay plan={mensal} fallback="—" />}
          meta="Pagamento único, sem renovação automática"
          highlight
          badge="Mais escolhido"
        >
          <Feat icon={<InfinityIcon className="h-3.5 w-3.5 text-navy" />}>
            <strong>Tudo ilimitado</strong> por {formatPlanDuration(mensal?.period_minutes ?? 43200)}
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
              disabled={!mensal || subscribingPlan !== null || buyingPlan !== null || checkoutInFlight}
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
          title={
            trimestral
              ? `${trimestral.label} · ${formatPlanDuration(trimestral.period_minutes)}`
              : "Trimestral"
          }
          price={<PlanPriceDisplay plan={trimestral} fallback="—" />}
          meta="Pagamento único, sem renovação automática"
          badge={trimestralSavings ? `Poupa ${trimestralSavings} MZN` : undefined}
          badgeVariant="save"
        >
          <Feat icon={<InfinityIcon className="h-3.5 w-3.5 text-navy" />}>
            <strong>Tudo ilimitado</strong> por{" "}
            {formatPlanDuration(trimestral?.period_minutes ?? 129600)}
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
              disabled={!trimestral || subscribingPlan !== null || buyingPlan !== null || checkoutInFlight}
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

        {otherPlans.map((plan) => (
          <GenericPlanCard
            key={plan.plan}
            plan={plan}
            session={session}
            ready={ready}
            isPremium={isPremium}
            creditBalance={creditBalance}
            subscribingPlan={subscribingPlan}
            buyingPlan={buyingPlan}
            returning={checkoutInFlight}
            onSubscribe={handleSubscribeClick}
            onBuyCredits={handleBuyCredits}
          />
        ))}
      </div>

      {returning && (
        <p className="mt-4 flex items-center justify-center gap-2 text-sm text-ink-soft">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />A confirmar o teu pagamento…
        </p>
      )}
      {confirmDelayed && (
        <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm text-ink-soft">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          Recebemos o teu pagamento — a confirmação pode levar alguns minutos. O plano/créditos
          aparecem aqui automaticamente assim que confirmar, sem precisares de fazer nada.
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
          <CreditItem cost={0} title="Download PDF" desc="Durante a validade do pacote" />
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
  price: React.ReactNode;
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

/* Preço base riscado + preço efetivo + selo + countdown quando a promoção
 * está vigente (N2) — some sozinho ao expirar, sem reload (usePromoStatus
 * reavalia a cada minuto). `effective_price_mzn` é só um snapshot do servidor
 * no momento do fetch — depois de expirar (sem refetch), o preço mostrado
 * TEM de cair para `price_mzn` (base) e não para o snapshot promocional
 * congelado, senão o preço "voltaria sozinho" só na aparência, mentindo. */
function PlanPriceDisplay({ plan, fallback }: { plan: PlanPrice | null; fallback: string }) {
  const { active, countdownLabel } = usePromoStatus(plan);
  if (!plan) return <>{fallback}</>;
  if (active) {
    return (
      <span className="inline-flex flex-col items-center gap-0.5">
        <span className="flex items-baseline gap-1.5">
          <s className="text-sm font-normal text-muted-foreground/60">{plan.price_mzn} MZN</s>
          <span>{plan.effective_price_mzn} MZN</span>
        </span>
        <span className="whitespace-nowrap text-[11px] font-semibold text-amber-700">
          {plan.promo_badge_text ?? "Promoção"} · {countdownLabel}
        </span>
      </span>
    );
  }
  return <>{plan.price_mzn} MZN</>;
}

/** Card genérico para qualquer plano criado no admin fora de
 * avulso/mensal/trimestral (Fase B4) — sem badge fixo nem caixa de
 * comparação (isso é tratamento especial dos 3 planos com layout próprio),
 * mas com preço/promo/duração/features data-driven e o botão certo conforme
 * `kind`. Features vêm como texto puro — nunca dangerouslySetInnerHTML. */
function GenericPlanCard({
  plan,
  session,
  ready,
  isPremium,
  creditBalance,
  subscribingPlan,
  buyingPlan,
  returning,
  onSubscribe,
  onBuyCredits,
}: {
  plan: PlanPrice;
  session: unknown;
  ready: boolean;
  isPremium: boolean | null;
  creditBalance: { balance: number; expiresAt: string } | null;
  subscribingPlan: string | null;
  buyingPlan: string | null;
  returning: boolean;
  onSubscribe: (plan: string) => void;
  onBuyCredits: (plan: string) => void;
}) {
  const isSubscription = plan.kind === "subscription_unlimited";
  const busy = subscribingPlan === plan.plan || buyingPlan === plan.plan;
  const otherActionInFlight =
    (subscribingPlan !== null && subscribingPlan !== plan.plan) ||
    (buyingPlan !== null && buyingPlan !== plan.plan);

  return (
    <PlanCard
      title={`${plan.label}${plan.period_minutes ? ` · ${formatPlanDuration(plan.period_minutes)}` : ""}`}
      price={<PlanPriceDisplay plan={plan} fallback="—" />}
      meta={
        isSubscription
          ? "Pagamento único, sem renovação automática"
          : `${plan.credits ?? "—"} créditos · válido ${formatPlanDuration(plan.period_minutes)}`
      }
    >
      {plan.features.map((feature, i) => (
        <Feat key={i} ok>
          {feature}
        </Feat>
      ))}
      {!session && ready ? (
        <Link
          to="/auth"
          search={{ next: "/planos" }}
          className="mt-auto inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
        >
          Criar conta grátis
        </Link>
      ) : isSubscription && isPremium ? (
        <Button variant="outline" className="mt-auto" disabled>
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          Plano ativo
        </Button>
      ) : !isSubscription && isPremium ? (
        <Button variant="outline" className="mt-auto" disabled>
          Inclui o teu plano
        </Button>
      ) : !isSubscription && creditBalance ? (
        <Button variant="outline" className="mt-auto" disabled>
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {creditBalance.balance} créditos ativos
        </Button>
      ) : (
        <Button
          variant="outline"
          className="mt-auto"
          disabled={busy || otherActionInFlight || returning}
          onClick={() => (isSubscription ? onSubscribe(plan.plan) : onBuyCredits(plan.plan))}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isSubscription ? (
            `Ativar ${plan.label}`
          ) : (
            `Comprar ${plan.label}`
          )}
        </Button>
      )}
    </PlanCard>
  );
}
