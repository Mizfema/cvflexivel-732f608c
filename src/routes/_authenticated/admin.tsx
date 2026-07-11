import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { CircleCheck, TrendingDown, TrendingUp } from "lucide-react";
import { getAdminDashboard } from "@/lib/admin.functions";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type Dashboard = Awaited<ReturnType<typeof getAdminDashboard>>;

const FEATURE_LABELS: Record<string, string> = {
  cv_analysis: "Análise de CV",
  field_suggestions: "Sugestões de campo",
  align_cv_tdr: "Alinhamento CV ↔ TdR",
  generate_cv_interview: "CV via entrevista",
  interview_prep: "Preparação de entrevista",
  cover_letter: "Carta de apresentação",
};

function featureLabel(feature: string): string {
  return FEATURE_LABELS[feature] ?? feature;
}

/**
 * Métricas de receita/retenção/funil abaixo são ilustrativas: dependem de
 * subscriptions/payments (Fase 1.4 do plano de monetização), que ainda não
 * existe. Ficam claramente marcadas como "dados de demonstração" e devem ser
 * substituídas por consultas reais assim que essa fase for implementada.
 */
const DEMO = {
  baseAtual: 1284,
  mrrUsd: 1069,
  mrrGrowthPct: 14,
  conversionPct: 8.4,
  conversionUpgrades: 108,
  retentionM1Pct: 38,
  retentionM1DeltaPp: -3,
  ltvCac: 4.2,
  marginContribPct: 82,
  ltvUsd: 38,
  cacUsd: 9,
  paybackMonths: 1.4,
  mrrSeries: [
    { month: "Jan", real: 420, projetado: null as number | null },
    { month: "Fev", real: 510, projetado: null },
    { month: "Mar", real: 590, projetado: null },
    { month: "Abr", real: 680, projetado: null },
    { month: "Mai", real: 790, projetado: null },
    { month: "Jun", real: 910, projetado: null },
    { month: "Jul", real: 1069, projetado: 1069 },
    { month: "Ago", real: null, projetado: 1280 },
    { month: "Set", real: null, projetado: 1500 },
  ],
  funil: [
    { label: "Registo", value: 1284, pct: 100 },
    { label: "CV criado", value: 902, pct: 70 },
    { label: "CV descarregado", value: 611, pct: 48 },
    { label: "Bateu no limite", value: 214, pct: 17 },
    { label: "Upgrade p/ Pro", value: 108, pct: 8.4 },
  ],
  retentionSeries: [
    { week: "S1", pct: 100 },
    { week: "S2", pct: 61 },
    { week: "S3", pct: 54 },
    { week: "S4", pct: 49 },
    { week: "S5", pct: 44 },
    { week: "S6", pct: 40 },
    { week: "S7", pct: 38 },
    { week: "S8", pct: 37 },
  ],
};

const callsChartConfig = {
  calls: { label: "Chamadas de IA", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

const mrrChartConfig = {
  real: { label: "MRR real", color: "var(--chart-4)" },
  projetado: { label: "Projeção", color: "var(--chart-4)" },
} satisfies ChartConfig;

const retentionChartConfig = {
  pct: { label: "Retenção", color: "var(--chart-4)" },
} satisfies ChartConfig;

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [{ title: "Painel admin — CV Flexível" }],
  }),
  component: AdminPage,
});

function DemoBadge() {
  return (
    <Badge
      variant="outline"
      className="border-amber-400/30 bg-amber-400/10 text-amber-300"
      title="Depende de subscriptions/payments (Fase 1.4), ainda não implementada. Substituir por dados reais quando essa fase existir."
    >
      Dados de demonstração
    </Badge>
  );
}

function RealBadge() {
  return (
    <Badge variant="outline" className="border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
      Dados reais
    </Badge>
  );
}

function SectionHeading({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-serif text-lg text-foreground">{title}</h2>
      {action}
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  delta,
}: {
  label: string;
  value: string | number;
  sub?: string;
  delta?: { direction: "up" | "down"; text: string };
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-serif text-3xl text-foreground">{value}</p>
      {(sub || delta) && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs">
          {delta && (
            <span
              className={
                delta.direction === "up"
                  ? "flex items-center gap-0.5 text-emerald-400"
                  : "flex items-center gap-0.5 text-rose-400"
              }
            >
              {delta.direction === "up" ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {delta.text}
            </span>
          )}
          {sub && <span className="text-muted-foreground">{sub}</span>}
        </div>
      )}
    </div>
  );
}

function FunnelBar({ label, value, pct }: { label: string; value: number; pct: number }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-foreground">{label}</span>
        <span className="font-mono tabular-nums text-muted-foreground">
          {value.toLocaleString("pt-PT")} <span className="text-xs">({pct}%)</span>
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-[var(--chart-4)]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CostBar({
  label,
  value,
  maxValue,
  formatValue,
}: {
  label: string;
  value: number;
  maxValue: number;
  formatValue: (v: number) => string;
}) {
  const pct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-foreground">{label}</span>
        <span className="font-mono tabular-nums text-muted-foreground">{formatValue(value)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function AdminPage() {
  const fetchDashboard = useServerFn(getAdminDashboard);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar painel."))
      .finally(() => setLoading(false));
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="dark min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 py-12 text-center text-sm text-muted-foreground">
          A carregar…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="dark min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 py-12 text-center">
          <p className="text-sm text-destructive" role="alert">
            {error ?? "Erro ao carregar painel."}
          </p>
        </div>
      </div>
    );
  }

  const maxFeatureCount = Math.max(1, ...data.topFeatures.map((f) => f.count));
  const maxFeatureCost = Math.max(0.0001, ...data.costByFeature.map((f) => f.costUsd));

  return (
    <div className="dark min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy-mid">Admin</p>
            <h1 className="mt-2 font-serif text-3xl text-foreground sm:text-4xl">
              Painel de controlo
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              As secções de receita, funil e retenção usam dados de demonstração até a Fase 1.4
              (assinaturas) ser implementada. Utilizadores, custo de IA e uso de funcionalidades já
              são dados reais.
            </p>
          </div>
        </header>

        {/* ===== Secção demo: sinal de investimento ===== */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CircleCheck className="h-5 w-5 text-emerald-400" />
            <p className="font-serif text-lg text-foreground">Favorável para investir</p>
          </div>
          <DemoBadge />
        </div>
        <div className="mb-8 grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-5 shadow-card sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Crescimento</p>
            <p className="mt-1 flex items-center gap-1 text-sm text-emerald-400">
              <TrendingUp className="h-3.5 w-3.5" /> +{DEMO.mrrGrowthPct}%/mês MRR
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Retenção M1</p>
            <p className="mt-1 text-sm text-foreground">{DEMO.retentionM1Pct}% estável</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Margem contrib.
            </p>
            <p className="mt-1 text-sm text-foreground">{DEMO.marginContribPct}%</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Base atual</p>
            <p className="mt-1 text-sm text-foreground">
              {DEMO.baseAtual.toLocaleString("pt-PT")} users
            </p>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile
            label="MRR"
            value={`US$${DEMO.mrrUsd.toLocaleString("pt-PT")}`}
            delta={{ direction: "up", text: `+${DEMO.mrrGrowthPct}%` }}
          />
          <StatTile
            label="Conversão p/ Pro"
            value={`${DEMO.conversionPct}%`}
            sub={`${DEMO.conversionUpgrades} upgrades no período`}
          />
          <StatTile
            label="Retenção M1"
            value={`${DEMO.retentionM1Pct}%`}
            delta={{ direction: "down", text: `${DEMO.retentionM1DeltaPp}pp` }}
          />
          <StatTile label="LTV : CAC" value={`${DEMO.ltvCac}×`} sub="saudável" />
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <SectionHeading title="Receita recorrente (MRR) e projeção" action={<DemoBadge />} />
            <ChartContainer config={mrrChartConfig} className="aspect-auto h-56 w-full">
              <AreaChart data={DEMO.mrrSeries}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey="real"
                  type="monotone"
                  stroke="var(--color-real)"
                  fill="var(--color-real)"
                  fillOpacity={0.15}
                  connectNulls={false}
                />
                <Area
                  dataKey="projetado"
                  type="monotone"
                  stroke="var(--color-projetado)"
                  strokeDasharray="4 4"
                  fill="var(--color-projetado)"
                  fillOpacity={0.05}
                  connectNulls
                />
              </AreaChart>
            </ChartContainer>
            <p className="mt-3 text-xs text-muted-foreground">
              Se a tendência atual se mantiver, MRR passa de US$1,5k em ~2 meses.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <SectionHeading title="Funil de ativação" action={<DemoBadge />} />
            <div className="space-y-4">
              {DEMO.funil.map((stage) => (
                <FunnelBar key={stage.label} {...stage} />
              ))}
            </div>
          </div>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <SectionHeading title="Unit economics" action={<DemoBadge />} />
            <div className="grid grid-cols-2 gap-4">
              <StatTile label="LTV" value={`US$${DEMO.ltvUsd}`} sub="valor por cliente" />
              <StatTile label="CAC" value={`US$${DEMO.cacUsd}`} sub="custo de aquisição" />
              <StatTile label="Payback" value={`${DEMO.paybackMonths} mês`} sub="recupera o CAC" />
              <StatTile
                label="Margem contrib."
                value={`${DEMO.marginContribPct}%`}
                sub="após custo de IA"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <SectionHeading title="Retenção por semana" action={<DemoBadge />} />
            <ChartContainer config={retentionChartConfig} className="aspect-auto h-40 w-full">
              <LineChart data={DEMO.retentionSeries}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="week" tickLine={false} axisLine={false} />
                <YAxis hide domain={[0, 100]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  dataKey="pct"
                  type="monotone"
                  stroke="var(--color-pct)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
            <p className="mt-3 text-xs text-muted-foreground">
              Curva estabiliza em ~{DEMO.retentionSeries.at(-1)?.pct}% — indica um núcleo de
              utilizadores que ficam.
            </p>
          </div>
        </div>

        {/* ===== Secção real: dados já implementados ===== */}
        <div className="mb-4 flex items-center gap-2">
          <p className="font-serif text-lg text-foreground">Dados reais</p>
          <RealBadge />
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile label="Total de utilizadores" value={data.totalUsers} />
          <StatTile label="Novos (7 dias)" value={data.newThisWeek} />
          <StatTile label="Ativos (7 dias)" value={data.activeUsers7d} />
          <StatTile label="Custo IA (30d)" value={`$${data.costUsd30d.toFixed(2)}`} />
        </div>

        <div className="mb-8 rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-4 font-serif text-lg text-foreground">
            Chamadas de IA por dia (últimos 30 dias)
          </h2>
          <ChartContainer config={callsChartConfig} className="aspect-auto h-64 w-full">
            <BarChart data={data.callsByDay}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(v: string) => v.slice(5)}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="calls" fill="var(--color-calls)" radius={4} />
            </BarChart>
          </ChartContainer>
          <p className="mt-3 text-xs text-muted-foreground">
            Custo real (preço do google/gemini-3-flash-preview, pass-through do Google via Lovable
            AI Gateway) com base em {data.costTrackedCalls} de {data.totalCallsLast30d} chamadas com
            tokens registados.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-4 font-serif text-lg text-foreground">
              Custo de IA por feature (30d)
            </h2>
            {data.costByFeature.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem uso de IA registado ainda.</p>
            ) : (
              <div className="space-y-4">
                {data.costByFeature.map((f) => (
                  <CostBar
                    key={f.feature}
                    label={featureLabel(f.feature)}
                    value={f.costUsd}
                    maxValue={maxFeatureCost}
                    formatValue={(v) => `$${v.toFixed(2)}`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-4 font-serif text-lg text-foreground">
              Funcionalidades mais usadas (30 dias)
            </h2>
            {data.topFeatures.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem uso de IA registado ainda.</p>
            ) : (
              <div className="space-y-4">
                {data.topFeatures.map((f) => (
                  <CostBar
                    key={f.feature}
                    label={featureLabel(f.feature)}
                    value={f.count}
                    maxValue={maxFeatureCount}
                    formatValue={(v) => String(v)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-4 font-serif text-lg text-foreground">
            Top 10 utilizadores por custo de IA (30 dias)
          </h2>
          {data.topUsersByCost.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem uso de IA registado ainda.</p>
          ) : (
            <div className="space-y-4">
              {data.topUsersByCost.map((u) => (
                <CostBar
                  key={u.userId}
                  label={u.label}
                  value={u.costUsd}
                  maxValue={Math.max(0.0001, data.topUsersByCost[0]?.costUsd ?? 0)}
                  formatValue={(v) => `$${v.toFixed(2)}`}
                />
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Utilizadores anónimos (sem conta) não entram aqui — o custo deles já conta em "Custo de
            IA por feature" acima.
          </p>
        </div>
      </div>
    </div>
  );
}
