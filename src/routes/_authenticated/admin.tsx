import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { getAdminDashboard } from "@/lib/admin.functions";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type Dashboard = Awaited<ReturnType<typeof getAdminDashboard>>;

const chartConfig = {
  calls: { label: "Chamadas de IA", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [{ title: "Painel admin — CV Flexível" }],
  }),
  component: AdminPage,
});

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-navy-rule bg-card p-5 shadow-card">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-serif text-3xl text-foreground">{value}</p>
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
      <div className="mx-auto max-w-5xl px-4 py-12 text-center text-sm text-muted-foreground">
        A carregar…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-center">
        <p className="text-sm text-destructive" role="alert">
          {error ?? "Erro ao carregar painel."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy-mid">Admin</p>
        <h1 className="mt-2 font-serif text-3xl text-foreground sm:text-4xl">Painel de controlo</h1>
      </header>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Total de utilizadores" value={data.totalUsers} />
        <StatTile label="Novos (7 dias)" value={data.newThisWeek} />
        <StatTile label="Ativos (7 dias)" value={data.activeUsers7d} />
        <StatTile label="Custo IA (30d)" value={`$${data.costUsd30d.toFixed(2)}`} />
      </div>

      <div className="mb-8 rounded-xl border border-navy-rule bg-card p-5 shadow-card">
        <h2 className="mb-4 font-serif text-lg text-foreground">
          Chamadas de IA por dia (últimos 30 dias)
        </h2>
        <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
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
          Custo real (preço do google/gemini-3-flash-preview, pass-through do Google via Lovable AI
          Gateway) com base em {data.costTrackedCalls} de {data.totalCallsLast30d} chamadas com
          tokens registados.
        </p>
      </div>

      <div className="rounded-xl border border-navy-rule bg-card p-5 shadow-card">
        <h2 className="mb-4 font-serif text-lg text-foreground">Features mais usadas (30 dias)</h2>
        {data.topFeatures.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem uso de IA registado ainda.</p>
        ) : (
          <ul className="space-y-2">
            {data.topFeatures.map((f) => (
              <li
                key={f.feature}
                className="flex items-center justify-between border-b border-navy-rule/60 pb-2 text-sm last:border-0"
              >
                <span className="text-foreground">{f.feature}</span>
                <span className="font-mono tabular-nums text-muted-foreground">{f.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
