import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  listAdminPlans,
  createAdminPlanFn,
  updateAdminPlanFn,
  archiveAdminPlanFn,
  reactivateAdminPlanFn,
} from "@/lib/admin-plans.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
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

export const Route = createFileRoute("/_authenticated/admin/planos/")({
  head: () => ({
    meta: [{ title: "Planos — Admin — CVelite" }],
  }),
  component: AdminPlanosPage,
});

type PlanRow = Awaited<ReturnType<typeof listAdminPlans>>[number];
type PlanKind = "subscription_unlimited" | "credit_pack";

const DURATION_UNITS = [
  { value: "hours", label: "Horas", minutes: 60 },
  { value: "days", label: "Dias", minutes: 1440 },
  { value: "weeks", label: "Semanas", minutes: 10080 },
  { value: "months", label: "Meses (30 dias)", minutes: 43200 },
] as const;
type DurationUnit = (typeof DURATION_UNITS)[number]["value"];

function unitMinutes(unit: DurationUnit): number {
  return DURATION_UNITS.find((u) => u.value === unit)!.minutes;
}

/** Escolhe a unidade "mais redonda" para mostrar um period_minutes existente
 * no formulário (maior unidade que divide o valor exatamente), preferindo
 * meses > semanas > dias > horas — evita mostrar "12960 minutos" quando o
 * admin pensa em "3 meses". */
function bestFitDuration(periodMinutes: number | null): { unit: DurationUnit; value: string } {
  if (!periodMinutes) return { unit: "days", value: "" };
  for (const u of [...DURATION_UNITS].reverse()) {
    if (periodMinutes % u.minutes === 0) {
      return { unit: u.value, value: String(periodMinutes / u.minutes) };
    }
  }
  return { unit: "hours", value: String(Math.round(periodMinutes / 60)) };
}

function formatDuration(periodMinutes: number | null): string {
  if (periodMinutes == null) return "—";
  if (periodMinutes % 43200 === 0) {
    const n = periodMinutes / 43200;
    return `${n} ${n === 1 ? "mês" : "meses"}`;
  }
  if (periodMinutes % 10080 === 0) {
    const n = periodMinutes / 10080;
    return `${n} ${n === 1 ? "semana" : "semanas"}`;
  }
  if (periodMinutes % 1440 === 0) {
    const n = periodMinutes / 1440;
    return `${n} ${n === 1 ? "dia" : "dias"}`;
  }
  if (periodMinutes % 60 === 0) return `${periodMinutes / 60}h`;
  return `${periodMinutes} min`;
}

function isPromoActive(row: PlanRow): boolean {
  return !!(row.is_promotional && row.promo_ends_at && new Date(row.promo_ends_at).getTime() > Date.now());
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-PT");
}

/** Formulário partilhado de criar/editar (Fase B2) — `plan` (slug) e `kind` só
 * são editáveis na criação, imutáveis depois (N5 do Guia B0-B5). Não gere o
 * próprio Sheet/open — quem chama controla isso (o botão "Novo plano" tem um
 * Sheet próprio; cada linha da tabela tem o seu, aberto pelo clique na linha). */
function PlanFormFields({
  mode,
  initial,
  onSuccess,
}: {
  mode: "create" | "edit";
  initial?: PlanRow;
  onSuccess: () => void;
}) {
  const createPlan = useServerFn(createAdminPlanFn);
  const updatePlan = useServerFn(updateAdminPlanFn);

  const [plan, setPlan] = useState(initial?.plan ?? "");
  const [kind, setKind] = useState<PlanKind>((initial?.kind as PlanKind) ?? "subscription_unlimited");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [priceMzn, setPriceMzn] = useState(initial ? String(initial.price_mzn) : "");
  const initialDuration = bestFitDuration(initial?.period_minutes ?? null);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>(initialDuration.unit);
  const [durationValue, setDurationValue] = useState(initialDuration.value);
  const [credits, setCredits] = useState(initial?.credits != null ? String(initial.credits) : "");
  const [features, setFeatures] = useState((initial?.features as string[] | null)?.join("\n") ?? "");
  const [displayOrder, setDisplayOrder] = useState(String(initial?.display_order ?? 0));
  const [visibleOnPricingPage, setVisibleOnPricingPage] = useState(initial?.visible_on_pricing_page ?? true);
  const [isPromotional, setIsPromotional] = useState(initial?.is_promotional ?? false);
  const [promoBadgeText, setPromoBadgeText] = useState(initial?.promo_badge_text ?? "");
  const [promoEndsAt, setPromoEndsAt] = useState(toDatetimeLocalValue(initial?.promo_ends_at ?? null));
  const [promoPriceMzn, setPromoPriceMzn] = useState(
    initial?.promo_price_mzn != null ? String(initial.promo_price_mzn) : "",
  );
  const [bypassesFairUse, setBypassesFairUse] = useState(initial?.bypasses_fair_use ?? false);
  const [fairUseHourlyCap, setFairUseHourlyCap] = useState(
    initial?.fair_use_hourly_cap != null ? String(initial.fair_use_hourly_cap) : "",
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const slugValid = /^[a-z0-9_]+$/.test(plan);
  const canSubmit =
    reason.trim().length >= 3 &&
    label.trim().length > 0 &&
    Number(priceMzn) > 0 &&
    (mode === "edit" || slugValid) &&
    (kind === "credit_pack" ? Number(credits) > 0 : Number(durationValue) > 0) &&
    (!isPromotional || (Number(promoPriceMzn) > 0 && Number(promoPriceMzn) < Number(priceMzn) && !!promoEndsAt)) &&
    (!bypassesFairUse || Number(fairUseHourlyCap) > 0);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const periodMinutesValue = durationValue ? Number(durationValue) * unitMinutes(durationUnit) : null;
      const fields = {
        label: label.trim(),
        price_mzn: Number(priceMzn),
        period_minutes: periodMinutesValue,
        credits: credits ? Number(credits) : null,
        features: features
          .split("\n")
          .map((f) => f.trim())
          .filter(Boolean),
        display_order: Number(displayOrder) || 0,
        visible_on_pricing_page: visibleOnPricingPage,
        is_promotional: isPromotional,
        promo_badge_text: isPromotional ? promoBadgeText.trim() || null : null,
        promo_ends_at: isPromotional && promoEndsAt ? new Date(promoEndsAt).toISOString() : null,
        promo_price_mzn: isPromotional ? Number(promoPriceMzn) : null,
        bypasses_fair_use: bypassesFairUse,
        fair_use_hourly_cap: bypassesFairUse ? Number(fairUseHourlyCap) : null,
        reason: reason.trim(),
      };

      if (mode === "create") {
        await createPlan({ data: { plan: plan.trim(), kind, ...fields } });
        toast.success("Plano criado.");
      } else {
        await updatePlan({ data: { id: initial!.id, ...fields } });
        toast.success("Plano atualizado.");
      }
      setReason("");
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao guardar plano.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{mode === "create" ? "Novo plano" : `Editar plano — ${initial?.label}`}</SheetTitle>
        <SheetDescription>
          {mode === "create"
            ? "O identificador e o tipo não podem ser alterados depois de criados."
            : "O identificador e o tipo são imutáveis — cria um plano novo se precisares de mudar a natureza deste."}
        </SheetDescription>
      </SheetHeader>

      <div className="mt-6 space-y-4">
          {mode === "create" ? (
            <div className="space-y-1.5">
              <Label htmlFor="plan-slug">Identificador (slug)</Label>
              <Input
                id="plan-slug"
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                placeholder="ex.: ilimitado_12h"
              />
              {plan.length > 0 && !slugValid && (
                <p className="text-xs text-destructive">
                  Só letras minúsculas, números e underscore.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Identificador</Label>
              <p className="text-sm text-muted-foreground">{initial?.plan}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="plan-label">Nome</Label>
            <Input id="plan-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>

          {mode === "create" ? (
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as PlanKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="subscription_unlimited">Assinatura ilimitada</SelectItem>
                  <SelectItem value="credit_pack">Pacote de créditos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <p className="text-sm text-muted-foreground">
                {initial?.kind === "credit_pack" ? "Pacote de créditos" : "Assinatura ilimitada"}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="plan-price">Preço (MZN)</Label>
            <Input
              id="plan-price"
              type="number"
              min={0}
              value={priceMzn}
              onChange={(e) => setPriceMzn(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="plan-duration-value">
                {kind === "credit_pack" ? "Validade dos créditos (opcional)" : "Duração"}
              </Label>
              <Input
                id="plan-duration-value"
                type="number"
                min={0}
                value={durationValue}
                onChange={(e) => setDurationValue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Select value={durationUnit} onValueChange={(v) => setDurationUnit(v as DurationUnit)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_UNITS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {kind === "credit_pack" && (
            <div className="space-y-1.5">
              <Label htmlFor="plan-credits">Créditos incluídos</Label>
              <Input
                id="plan-credits"
                type="number"
                min={0}
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="plan-features">Funcionalidades (uma por linha)</Label>
            <Textarea
              id="plan-features"
              rows={4}
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              placeholder={"Tudo ilimitado\nDownloads sem marca d'água"}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plan-order">Ordem de exibição</Label>
            <Input
              id="plan-order"
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="plan-visible" className="cursor-pointer">
              Visível em /planos
            </Label>
            <Switch id="plan-visible" checked={visibleOnPricingPage} onCheckedChange={setVisibleOnPricingPage} />
          </div>

          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="plan-promo" className="cursor-pointer">
                Plano promocional
              </Label>
              <Switch id="plan-promo" checked={isPromotional} onCheckedChange={setIsPromotional} />
            </div>
            {isPromotional && (
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="plan-promo-badge">Texto do selo</Label>
                  <Input
                    id="plan-promo-badge"
                    value={promoBadgeText}
                    onChange={(e) => setPromoBadgeText(e.target.value)}
                    placeholder="Ex.: Lançamento -30%"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="plan-promo-price">Preço promocional (MZN)</Label>
                  <Input
                    id="plan-promo-price"
                    type="number"
                    min={0}
                    value={promoPriceMzn}
                    onChange={(e) => setPromoPriceMzn(e.target.value)}
                  />
                  {Number(promoPriceMzn) >= Number(priceMzn) && promoPriceMzn !== "" && (
                    <p className="text-xs text-destructive">Tem de ser menor que o preço base.</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="plan-promo-ends">Termina em</Label>
                  <Input
                    id="plan-promo-ends"
                    type="datetime-local"
                    value={promoEndsAt}
                    onChange={(e) => setPromoEndsAt(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {kind === "subscription_unlimited" && (
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="plan-bypass" className="cursor-pointer">
                  Bypassa fair-use (uso ilimitado real)
                </Label>
                <Switch id="plan-bypass" checked={bypassesFairUse} onCheckedChange={setBypassesFairUse} />
              </div>
              {bypassesFairUse && (
                <div className="mt-3 space-y-1.5">
                  <Label htmlFor="plan-fair-use-cap">Teto por hora (obrigatório)</Label>
                  <Input
                    id="plan-fair-use-cap"
                    type="number"
                    min={1}
                    value={fairUseHourlyCap}
                    onChange={(e) => setFairUseHourlyCap(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Só para promoções de curta duração — o teto é obrigatório e nunca aparece ao
                    utilizador. Calibra um valor alto o suficiente para nunca ser sentido por uso
                    legítimo.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="plan-reason">Motivo (obrigatório)</Label>
            <Textarea
              id="plan-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: novo plano promocional de lançamento…"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

      <SheetFooter className="mt-6">
        <Button onClick={handleConfirm} disabled={submitting || !canSubmit}>
          {submitting ? "A guardar…" : mode === "create" ? "Criar plano" : "Guardar alterações"}
        </Button>
      </SheetFooter>
    </>
  );
}

function ArchiveReactivateDialog({
  row,
  onSuccess,
}: {
  row: PlanRow;
  onSuccess: () => void;
}) {
  const archivePlan = useServerFn(archiveAdminPlanFn);
  const reactivatePlan = useServerFn(reactivateAdminPlanFn);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      if (row.enabled) {
        await archivePlan({ data: { id: row.id, reason } });
        toast.success("Plano arquivado.");
      } else {
        await reactivatePlan({ data: { id: row.id, reason } });
        toast.success("Plano reativado.");
      }
      setOpen(false);
      setReason("");
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar plano.");
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
        <Button variant={row.enabled ? "destructive" : "outline"} size="sm">
          {row.enabled ? "Arquivar" : "Reativar"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{row.enabled ? "Arquivar plano" : "Reativar plano"}</AlertDialogTitle>
          <AlertDialogDescription>
            {row.enabled
              ? "Desativa o plano — deixa de poder ser comprado ou concedido, mas o histórico continua legível. Nunca apaga dados."
              : "Volta a ativar o plano para concessão/compra. A visibilidade em /planos não é restaurada automaticamente."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="archive-reason">Motivo (obrigatório)</Label>
            <Textarea id="archive-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
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
            variant={row.enabled ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={submitting || reason.trim().length < 3}
          >
            {submitting ? "A processar…" : row.enabled ? "Arquivar" : "Reativar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function EditableRow({ row, onSuccess }: { row: PlanRow; onSuccess: () => void }) {
  const [editOpen, setEditOpen] = useState(false);
  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setEditOpen(true)}>
        <TableCell className="font-medium text-foreground">{row.label}</TableCell>
        <TableCell>
          <Badge variant="outline">
            {row.kind === "credit_pack" ? "Créditos" : "Assinatura"}
          </Badge>
        </TableCell>
        <TableCell>
          {isPromoActive(row) ? (
            <span className="space-x-1.5">
              <s className="text-muted-foreground">{row.price_mzn}</s>
              <span className="font-medium text-emerald-400">{row.promo_price_mzn}</span>
            </span>
          ) : (
            row.price_mzn
          )}{" "}
          MZN
        </TableCell>
        <TableCell>{formatDuration(row.period_minutes)}</TableCell>
        <TableCell>{row.credits ?? "—"}</TableCell>
        <TableCell>
          {isPromoActive(row) ? (
            <Badge className="border-amber-400/30 text-amber-300" variant="outline">
              {row.promo_badge_text || "Promoção"} · até {fmtDateTime(row.promo_ends_at as string)}
            </Badge>
          ) : row.is_promotional ? (
            <span className="text-xs text-muted-foreground">Expirada</span>
          ) : (
            "—"
          )}
        </TableCell>
        <TableCell>{row.visible_on_pricing_page ? "Sim" : "Não"}</TableCell>
        <TableCell>
          <Badge variant={row.enabled ? "default" : "outline"}>{row.enabled ? "Ativo" : "Arquivado"}</Badge>
        </TableCell>
        <TableCell>{row.display_order}</TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <ArchiveReactivateDialog row={row} onSuccess={onSuccess} />
        </TableCell>
      </TableRow>
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <PlanFormFields
            mode="edit"
            initial={row}
            onSuccess={() => {
              onSuccess();
              setEditOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

function CreatePlanSheet({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Plus className="mr-1 h-4 w-4" /> Novo plano
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <PlanFormFields
          mode="create"
          onSuccess={() => {
            onSuccess();
            setOpen(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

function AdminPlanosPage() {
  const fetchPlans = useServerFn(listAdminPlans);
  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetchPlans()
      .then(setPlans)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar planos."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPlans]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl text-foreground">Planos</h1>
        <CreatePlanSheet onSuccess={load} />
      </div>

      {error && (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead>Créditos</TableHead>
              <TableHead>Promoção</TableHead>
              <TableHead>Visível</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Ordem</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-sm text-muted-foreground">
                  A carregar…
                </TableCell>
              </TableRow>
            ) : plans && plans.length > 0 ? (
              plans.map((row) => <EditableRow key={row.id} row={row} onSuccess={load} />)
            ) : (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-sm text-muted-foreground">
                  Nenhum plano encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
