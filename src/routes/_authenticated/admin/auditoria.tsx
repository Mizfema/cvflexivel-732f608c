import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown } from "lucide-react";
import { listAdminActions, type AdminActionType } from "@/lib/admin-audit.functions";
import { AdminActionBadge } from "@/components/admin/AdminActionBadge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/auditoria")({
  head: () => ({
    meta: [{ title: "Auditoria — Admin — CV Flexível" }],
  }),
  component: AdminAuditoriaPage,
});

const PAGE_SIZE = 20;

const ACTION_FILTER_LABELS: Record<AdminActionType, string> = {
  grant_plan: "Plano concedido",
  revoke_plan: "Plano revogado",
  adjust_credits: "Créditos ajustados",
  suspend_user: "Conta suspensa",
  reactivate_user: "Conta reativada",
  create_plan: "Plano criado",
  update_plan: "Plano editado",
  archive_plan: "Plano arquivado",
};

const ACTION_FILTER_TYPES = Object.keys(ACTION_FILTER_LABELS) as AdminActionType[];

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-PT");
}

function PersonCell({ person }: { person: { id: string | null; name: string | null; email: string | null } }) {
  const label = person.name ?? person.email ?? "Conta apagada";
  if (!person.id) return <span className="text-muted-foreground">{label}</span>;
  return (
    <Link to="/admin/users/$id" params={{ id: person.id }} className="hover:underline">
      {label}
    </Link>
  );
}

function MetadataRow({ metadata }: { metadata: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(metadata);
  if (entries.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground">
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          Detalhes
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="mt-2 max-w-full overflow-x-auto rounded-md bg-muted p-3 text-xs text-foreground">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

function AdminAuditoriaPage() {
  const fetchActions = useServerFn(listAdminActions);
  const [actionType, setActionType] = useState<AdminActionType | "all">("all");
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<Awaited<ReturnType<typeof listAdminActions>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchActions({
      data: {
        page,
        pageSize: PAGE_SIZE,
        actionType: actionType === "all" ? undefined : actionType,
      },
    })
      .then(setResult)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar auditoria."))
      .finally(() => setLoading(false));
  }, [fetchActions, page, actionType]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Select
          value={actionType}
          onValueChange={(v) => {
            setPage(0);
            setActionType(v as AdminActionType | "all");
          }}
        >
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos de ação</SelectItem>
            {ACTION_FILTER_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {ACTION_FILTER_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {result && (
          <span className="text-sm text-muted-foreground">
            {result.total.toLocaleString("pt-PT")} ação{result.total === 1 ? "" : "ões"}
          </span>
        )}
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
              <TableHead>Data</TableHead>
              <TableHead>Ator</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Alvo</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  A carregar…
                </TableCell>
              </TableRow>
            ) : result && result.rows.length > 0 ? (
              result.rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {fmtDateTime(a.createdAt)}
                  </TableCell>
                  <TableCell>
                    <PersonCell person={a.actor} />
                  </TableCell>
                  <TableCell>
                    <AdminActionBadge actionType={a.actionType} />
                  </TableCell>
                  <TableCell>
                    <PersonCell person={a.target} />
                  </TableCell>
                  <TableCell className="max-w-xs">{a.reason}</TableCell>
                  <TableCell>
                    <MetadataRow metadata={a.metadata} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Nenhuma ação admin registada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0 || loading}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          Anterior
        </Button>
        <span className="text-sm text-muted-foreground">
          Página {page + 1} de {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page + 1 >= totalPages || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Seguinte
        </Button>
      </div>
    </div>
  );
}
