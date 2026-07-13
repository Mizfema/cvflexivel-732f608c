import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { getAdminUserDetail } from "@/lib/admin-users.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/users/$id")({
  head: () => ({
    meta: [{ title: "Utilizador — Admin — CV Flexível" }],
  }),
  component: AdminUserDetailPage,
});

type Detail = Awaited<ReturnType<typeof getAdminUserDetail>>;

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("pt-PT") : "—";
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function planLabel(plan: Detail["plan"]): string {
  if (plan.status === "free") return "Grátis";
  return plan.isAdminGrant ? "Pro (admin)" : "Pro";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h3 className="mb-4 font-serif text-lg text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value ?? "—"}</p>
    </div>
  );
}

function AdminUserDetailPage() {
  const { id } = Route.useParams();
  const fetchDetail = useServerFn(getAdminUserDetail);
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchDetail({ data: { userId: id } })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar utilizador."))
      .finally(() => setLoading(false));
  }, [fetchDetail, id]);

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
          {error ?? "Erro ao carregar utilizador."}
        </p>
      </div>
    );
  }

  const { profile } = data;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
      <Link
        to="/admin/users"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar à lista
      </Link>

      <header className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-2xl text-foreground">
          {profile.full_name ?? profile.email ?? id}
        </h1>
        <Badge variant={data.plan.status === "active" ? "default" : "outline"}>
          {planLabel(data.plan)}
        </Badge>
        {data.suspension && <Badge variant="destructive">Suspenso</Badge>}
        {data.roles.includes("admin") && <Badge variant="secondary">Admin</Badge>}
      </header>

      <Tabs defaultValue="perfil" className="mb-8">
        <TabsList>
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="plano">Plano & Pagamentos</TabsTrigger>
          <TabsTrigger value="creditos">Créditos</TabsTrigger>
          <TabsTrigger value="ia">Uso de IA</TabsTrigger>
          <TabsTrigger value="historico">Histórico admin</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil">
          <Section title="Perfil">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Nome" value={profile.full_name} />
              <Field label="Email" value={profile.email} />
              <Field label="Telefone" value={profile.phone} />
              <Field label="Cidade" value={profile.city} />
              <Field label="País" value={profile.country} />
              <Field label="LinkedIn" value={profile.linkedin} />
              <Field label="Website" value={profile.website} />
              <Field label="Registo" value={fmtDate(profile.created_at)} />
              <Field
                label="Suspenso desde"
                value={data.suspension ? fmtDate(data.suspension.suspended_at) : "—"}
              />
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="plano" className="space-y-6">
          <Section title="Histórico de subscriptions">
            {data.subscriptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nunca teve um plano.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plano</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Termina em</TableHead>
                    <TableHead>Criado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.subscriptions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.plan}</TableCell>
                      <TableCell>{s.status}</TableCell>
                      <TableCell>{s.provider}</TableCell>
                      <TableCell>{fmtDate(s.current_period_end)}</TableCell>
                      <TableCell>{fmtDate(s.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>

          <Section title="Pagamentos">
            {data.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pagamento registado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Valor</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Pago em</TableHead>
                    <TableHead>Criado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        {p.amount} {p.currency}
                      </TableCell>
                      <TableCell>{p.status}</TableCell>
                      <TableCell>{p.method ?? "—"}</TableCell>
                      <TableCell>{fmtDate(p.paid_at)}</TableCell>
                      <TableCell>{fmtDate(p.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="creditos" className="space-y-6">
          <Section title="Saldo atual">
            {data.creditBalance ? (
              <div className="grid grid-cols-3 gap-4">
                <Field label="Saldo" value={data.creditBalance.balance} />
                <Field label="Expira em" value={fmtDate(data.creditBalance.expires_at)} />
                <Field label="Pacote" value={data.creditBalance.package_id} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nunca comprou créditos avulsos.</p>
            )}
          </Section>

          <Section title="Movimentos">
            {data.creditTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem movimentos registados.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Delta</TableHead>
                    <TableHead>Saldo após</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Feature</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.creditTransactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className={t.delta >= 0 ? "text-emerald-400" : "text-rose-400"}>
                        {t.delta >= 0 ? `+${t.delta}` : t.delta}
                      </TableCell>
                      <TableCell>{t.balance_after}</TableCell>
                      <TableCell>{t.reason}</TableCell>
                      <TableCell>{t.feature ?? "—"}</TableCell>
                      <TableCell>{fmtDate(t.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="ia">
          <Section title="Uso de IA (30 dias)">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Chamadas" value={data.aiUsage30d.calls} />
              <Field label="Custo" value={fmtUsd(data.aiUsage30d.costUsd)} />
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="historico">
          <Section title="Ações admin sobre esta conta">
            {data.adminActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma ação admin registada ainda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ação</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.adminActions.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.action_type}</TableCell>
                      <TableCell>{a.reason}</TableCell>
                      <TableCell>{fmtDate(a.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>
        </TabsContent>
      </Tabs>

      <Section title="Ações">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="text-foreground" disabled title="Disponível na Fase A3">
            Conceder plano
          </Button>
          <Button variant="outline" className="text-foreground" disabled title="Disponível na Fase A3">
            Revogar plano
          </Button>
          <Button variant="outline" className="text-foreground" disabled title="Disponível na Fase A3">
            Ajustar créditos
          </Button>
          <Button variant="outline" className="text-foreground" disabled title="Disponível na Fase A4">
            Suspender conta
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Estas ações ficam disponíveis nas próximas fases (A3 e A4).
        </p>
      </Section>
    </div>
  );
}
