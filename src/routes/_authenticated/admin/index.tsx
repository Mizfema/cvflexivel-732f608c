import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";
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

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan",
  "02": "Fev",
  "03": "Mar",
  "04": "Abr",
  "05": "Mai",
  "06": "Jun",
  "07": "Jul",
  "08": "Ago",
  "09": "Set",
  "10": "Out",
  "11": "Nov",
  "12": "Dez",
};

function featureLabel(feature: string): string {
  return FEATURE_LABELS[feature] ?? feature;
}

/** "YYYY-MM" → "Jul/26" (janelas de receita são sempre agrupadas em UTC). */
function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  return `${MONTH_LABELS[month] ?? month}/${year.slice(2)}`;
}

function fmtUsdOrDash(value: number | null): string {
  return value === null ? "—" : `US$${value.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}`;
}

function fmtPctOrDash(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

const callsChartConfig = {
  calls: { label: "Chamadas de IA", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

const revenueChartConfig = {
  amountUsd: { label: "Receita confirmada", color: "var(--chart-4)" },
} satisfies ChartConfig;

const retentionChartConfig = {
  pct: { label: "Retenção", color: "var(--chart-4)" },
} satisfies ChartConfig;

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [{ title: "Painel admin — CVelite" }],
  }),
  component: AdminPage,
});

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

function FunnelBar({
  label,
  value,
  pct,
  unavailable,
}: {
  label: string;
  value: number;
  pct: number;
  unavailable?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-foreground">{label}</span>
        <span className="font-mono tabular-nums text-muted-foreground">
          {unavailable ? (
            "indisponível"
          ) : (
            <>
              {value.toLocaleString("pt-PT")} <span className="text-xs">({pct}%)</span>
            </>
          )}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${unavailable ? "bg-muted-foreground/20" : "bg-[var(--chart-4)]"}`}
          style={{ width: unavailable ? "100%" : `${pct}%` }}
        />
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
      <div className="mx-auto max-w-6xl px-4 py-12 text-center text-sm text-muted-foreground">
        A carregar…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 text-center">
        <p className="text-sm text-destructive" role="alert">
          {error ?? "Erro ao carregar painel."}
        </p>
      </div>
    );
  }

  const maxFeatureCount = Math.max(1, ...data.topFeatures.map((f) => f.count));
  const maxFeatureCost = Math.max(0.0001, ...data.costByFeature.map((f) => f.costUsd));

  const revenueChartData = data.revenue.series.map((p) => ({
    monthLabel: monthLabel(p.month),
    amountUsd: p.amountUsd,
  }));

  const pctOf = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0);
  const funnelStages: { label: string; value: number; pct: number; unavailable?: boolean }[] = [
    { label: "Registo", value: data.funnel.registrations, pct: 100 },
    {
      label: "CV criado",
      value: data.funnel.cvsCreated,
      pct: pctOf(data.funnel.cvsCreated, data.funnel.registrations),
    },
    {
      label: "CV descarregado",
      value: data.funnel.cvsDownloaded,
      pct: pctOf(data.funnel.cvsDownloaded, data.funnel.registrations),
    },
    { label: "Bateu no limite", value: 0, pct: 0, unavailable: true },
    {
      label: "Upgrade p/ Pro (30d)",
      value: data.funnel.upgrades,
      pct: pctOf(data.funnel.upgrades, data.funnel.registrations),
    },
  ];

  const retentionChartData = data.retention.weeklySeries
    .filter((w) => w.pct !== null)
    .map((w) => ({ week: `S${w.week}`, pct: w.pct as number }));

  return (
    <div className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 lg:pb-12">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy-mid">Admin</p>
          <h1 className="mt-2 font-serif text-3xl text-foreground sm:text-4xl">
            Painel de controlo
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Todas as métricas abaixo vêm diretamente do banco, sem nenhum número inventado. Uma
            tile sem fonte real mostra "—" ou "indisponível".
          </p>
        </div>
      </header>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile
          label="Receita confirmada (30d)"
          value={fmtUsdOrDash(data.revenue.confirmed30dUsd)}
          sub="run-rate mensal equivalente"
          delta={
            data.revenue.deltaPct !== null
              ? {
                  direction: data.revenue.deltaPct >= 0 ? "up" : "down",
                  text: `${data.revenue.deltaPct >= 0 ? "+" : ""}${data.revenue.deltaPct}%`,
                }
              : undefined
          }
        />
        <StatTile
          label="Conversão p/ Pro"
          value={fmtPctOrDash(data.conversion.pct)}
          sub={`${data.conversion.upgrades30d} upgrades (30d)`}
        />
        <StatTile
          label="Retenção M1"
          value={fmtPctOrDash(data.retention.m1Pct)}
          sub={`${data.retention.m1CohortSize} elegíveis`}
        />
        <StatTile
          label="Margem contrib."
          value={fmtPctOrDash(data.contributionMarginPct)}
          sub="após custo de IA"
        />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <SectionHeading title="Receita confirmada por mês" action={<RealBadge />} />
          {revenueChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem pagamentos confirmados ainda.</p>
          ) : (
            <ChartContainer config={revenueChartConfig} className="aspect-auto h-56 w-full">
              <AreaChart data={revenueChartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey="amountUsd"
                  type="monotone"
                  stroke="var(--color-amountUsd)"
                  fill="var(--color-amountUsd)"
                  fillOpacity={0.15}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <SectionHeading title="Funil de ativação" action={<RealBadge />} />
          <div className="space-y-4">
            {funnelStages.map((stage) => (
              <FunnelBar key={stage.label} {...stage} />
            ))}
          </div>
        </div>
      </div>

      <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <SectionHeading title="LTV simples" action={<RealBadge />} />
          <StatTile
            label="Receita média por pagante"
            value={fmtUsdOrDash(data.ltv.avgRevenuePerPayingUserUsd)}
            sub="estimativa preliminar, histórico curto"
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <SectionHeading title="Retenção por semana" action={<RealBadge />} />
          {retentionChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ainda sem utilizadores com conta velha o suficiente para medir retenção semanal.
            </p>
          ) : (
            <ChartContainer config={retentionChartConfig} className="aspect-auto h-40 w-full">
              <LineChart data={retentionChartData}>
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
          )}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <p className="font-serif text-lg text-foreground">Utilizadores e uso de IA</p>
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
  );
}
