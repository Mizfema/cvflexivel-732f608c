import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { getAdminUserDetail } from "@/lib/admin-users.functions";
import { listAdminPlans } from "@/lib/admin-plans.functions";
import {
  adminGrantPlanFn,
  adminRevokePlanFn,
  adminAdjustCreditsFn,
  adminSuspendUserFn,
  adminReactivateUserFn,
} from "@/lib/admin-actions.functions";
import { Badge } from "@/components/ui/badge";
import { AdminActionBadge } from "@/components/admin/AdminActionBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

/** Duração pré-preenchida a partir do próprio plano (arredondada para cima em
 * dias inteiros — este diálogo mantém o campo em dias por simplicidade; um
 * plano sub-diário como "ilimitado 12h" pré-preenche "1" e o admin ajusta à
 * mão se precisar de exatidão, mesma flexibilidade de override que já existia). */
function daysFromPeriodMinutes(periodMinutes: number | null | undefined): string {
  return String(Math.max(1, Math.round((periodMinutes ?? 43200) / 1440)));
}

function GrantPlanDialog({ userId, onSuccess }: { userId: string; onSuccess: () => void }) {
  const grantPlan = useServerFn(adminGrantPlanFn);
  const fetchPlans = useServerFn(listAdminPlans);
  const [open, setOpen] = useState(false);
  const [plans, setPlans] = useState<Awaited<ReturnType<typeof listAdminPlans>>>([]);
  const [plan, setPlan] = useState("");
  const [periodDays, setPeriodDays] = useState("30");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPlans()
      .then((rows) => {
        const grantable = rows.filter((r) => r.kind === "subscription_unlimited" && r.enabled);
        setPlans(grantable);
        if (grantable.length > 0) {
          setPlan(grantable[0].plan);
          setPeriodDays(daysFromPeriodMinutes(grantable[0].period_minutes));
        }
      })
      .catch(() => setPlans([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPlans]);

  function reset() {
    if (plans.length > 0) {
      setPlan(plans[0].plan);
      setPeriodDays(daysFromPeriodMinutes(plans[0].period_minutes));
    }
    setReason("");
    setError(null);
  }

  function handlePlanChange(newPlan: string) {
    setPlan(newPlan);
    const planRow = plans.find((p) => p.plan === newPlan);
    setPeriodDays(daysFromPeriodMinutes(planRow?.period_minutes));
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await grantPlan({
        data: { userId, plan, periodDays: Number(periodDays), reason },
      });
      toast.success("Plano concedido.");
      setOpen(false);
      reset();
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao conceder plano.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="text-foreground" disabled={plans.length === 0}>
          Conceder plano
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Conceder plano</AlertDialogTitle>
          <AlertDialogDescription>
            Concede ou estende manualmente um plano. Nunca gera um pagamento — expira exatamente
            como um plano pago, a partir de agora ou do fim do período atual, o que for mais tarde.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Plano</Label>
            <Select value={plan} onValueChange={handlePlanChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {plans.map((opt) => (
                  <SelectItem key={opt.plan} value={opt.plan}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="grant-plan-days">Duração (dias)</Label>
            <Input
              id="grant-plan-days"
              type="number"
              min={1}
              max={3650}
              value={periodDays}
              onChange={(e) => setPeriodDays(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="grant-plan-reason">Motivo (obrigatório)</Label>
            <Textarea
              id="grant-plan-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: promoção de lançamento, compensação por incidente…"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <Button
            onClick={handleConfirm}
            disabled={submitting || reason.trim().length < 3 || !Number(periodDays)}
          >
            {submitting ? "A processar…" : "Conceder"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RevokePlanDialog({
  userId,
  disabled,
  onSuccess,
}: {
  userId: string;
  disabled: boolean;
  onSuccess: () => void;
}) {
  const revokePlan = useServerFn(adminRevokePlanFn);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await revokePlan({ data: { userId, reason } });
      toast.success("Plano revogado.");
      setOpen(false);
      setReason("");
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao revogar plano.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setReason("");
          setError(null);
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="text-foreground" disabled={disabled}>
          Revogar plano
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revogar plano</AlertDialogTitle>
          <AlertDialogDescription>
            Termina o plano ativo imediatamente. O utilizador volta a "Grátis" já. Não apaga
            histórico nem dados.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="revoke-plan-reason">Motivo (obrigatório)</Label>
            <Textarea
              id="revoke-plan-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: reembolso, abuso, suspeita de fraude…"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting || reason.trim().length < 3}
          >
            {submitting ? "A processar…" : "Revogar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AdjustCreditsDialog({
  userId,
  currentBalance,
  onSuccess,
}: {
  userId: string;
  currentBalance: number;
  onSuccess: () => void;
}) {
  const adjustCredits = useServerFn(adminAdjustCreditsFn);
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState("");
  const [periodDays, setPeriodDays] = useState("30");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setDelta("");
    setPeriodDays("30");
    setReason("");
    setError(null);
  }

  const deltaNumber = Number(delta);
  const isPositive = Number.isFinite(deltaNumber) && deltaNumber > 0;
  const isValidDelta = Number.isInteger(deltaNumber) && deltaNumber !== 0;
  const preview = isValidDelta ? currentBalance + deltaNumber : currentBalance;

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await adjustCredits({
        data: {
          userId,
          delta: deltaNumber,
          periodDays: isPositive ? Number(periodDays) : undefined,
          reason,
        },
      });
      toast.success(`Saldo ajustado para ${result.newBalance} créditos.`);
      setOpen(false);
      reset();
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao ajustar créditos.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="text-foreground">
          Ajustar créditos
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ajustar créditos</AlertDialogTitle>
          <AlertDialogDescription>
            Positivo concede créditos (cria ou estende o pacote avulso); negativo debita do saldo
            atual — nunca fica abaixo de zero.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="adjust-credits-delta">Ajuste (+/-)</Label>
            <Input
              id="adjust-credits-delta"
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="Ex.: 10 ou -5"
            />
            <p className="text-xs text-muted-foreground">
              Saldo atual: {currentBalance} · Saldo resultante: {preview}
            </p>
          </div>

          {isPositive && (
            <div className="space-y-1.5">
              <Label htmlFor="adjust-credits-days">Válido por (dias)</Label>
              <Input
                id="adjust-credits-days"
                type="number"
                min={1}
                max={3650}
                value={periodDays}
                onChange={(e) => setPeriodDays(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="adjust-credits-reason">Motivo (obrigatório)</Label>
            <Textarea
              id="adjust-credits-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: compensação por bug, promoção pontual…"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <Button
            onClick={handleConfirm}
            disabled={submitting || !isValidDelta || reason.trim().length < 3}
          >
            {submitting ? "A processar…" : "Ajustar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SuspendUserDialog({ userId, onSuccess }: { userId: string; onSuccess: () => void }) {
  const suspendUserFn = useServerFn(adminSuspendUserFn);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await suspendUserFn({ data: { userId, reason } });
      toast.success("Conta suspensa.");
      setOpen(false);
      setReason("");
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao suspender conta.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setReason("");
          setError(null);
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Suspender conta</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Suspender conta</AlertDialogTitle>
          <AlertDialogDescription>
            Bloqueia novo login e todas as ações de IA/download imediatamente. Não apaga nem altera
            nenhum dado — totalmente reversível. Uma sessão já iniciada continua válida até expirar
            (normalmente até 1h), mas qualquer pedido de IA/download nesse período falha com uma
            mensagem própria de suspensão.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="suspend-user-reason">Motivo (obrigatório)</Label>
            <Textarea
              id="suspend-user-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: abuso de recursos, suspeita de fraude, incidente de segurança…"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting || reason.trim().length < 3}
          >
            {submitting ? "A processar…" : "Suspender"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ReactivateUserDialog({ userId, onSuccess }: { userId: string; onSuccess: () => void }) {
  const reactivateUserFn = useServerFn(adminReactivateUserFn);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await reactivateUserFn({ data: { userId, reason } });
      toast.success("Conta reativada.");
      setOpen(false);
      setReason("");
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao reativar conta.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setReason("");
          setError(null);
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="text-foreground">
          Reativar conta
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reativar conta</AlertDialogTitle>
          <AlertDialogDescription>
            Restaura login e ações de IA/download imediatamente. Nenhum dado foi alterado durante a
            suspensão.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reactivate-user-reason">Motivo (obrigatório)</Label>
            <Textarea
              id="reactivate-user-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: engano confirmado, apelo aceite…"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <Button
            onClick={handleConfirm}
            disabled={submitting || reason.trim().length < 3}
          >
            {submitting ? "A processar…" : "Reativar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AdminUserDetailPage() {
  const { id } = Route.useParams();
  const fetchDetail = useServerFn(getAdminUserDetail);
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function loadDetail() {
    setLoading(true);
    fetchDetail({ data: { userId: id } })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar utilizador."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                    <TableHead>Ator</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.adminActions.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <AdminActionBadge actionType={a.actionType} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {a.actor.name ?? a.actor.email ?? "Conta apagada"}
                      </TableCell>
                      <TableCell>{a.reason}</TableCell>
                      <TableCell>{fmtDate(a.createdAt)}</TableCell>
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
          <GrantPlanDialog userId={id} onSuccess={loadDetail} />
          <RevokePlanDialog
            userId={id}
            disabled={data.plan.status !== "active"}
            onSuccess={loadDetail}
          />
          <AdjustCreditsDialog
            userId={id}
            currentBalance={data.creditBalance?.balance ?? 0}
            onSuccess={loadDetail}
          />
          {data.suspension ? (
            <ReactivateUserDialog userId={id} onSuccess={loadDetail} />
          ) : (
            <SuspendUserDialog userId={id} onSuccess={loadDetail} />
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Cada ação exige um motivo e fica registada no histórico admin.
        </p>
      </Section>
    </div>
  );
}
