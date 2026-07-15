import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { listAdminUsers } from "@/lib/admin-users.functions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/users/")({
  head: () => ({
    meta: [{ title: "Utilizadores — Admin — CVelite" }],
  }),
  component: AdminUsersPage,
});

const PAGE_SIZE = 20;

function planLabel(plan: { status: "free" | "active"; isAdminGrant: boolean }): string {
  if (plan.status === "free") return "Grátis";
  return plan.isAdminGrant ? "Pro (admin)" : "Pro";
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-PT");
}

function AdminUsersPage() {
  const fetchUsers = useServerFn(listAdminUsers);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<Awaited<ReturnType<typeof listAdminUsers>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchUsers({ data: { q, page, pageSize: PAGE_SIZE } })
      .then(setResult)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar utilizadores."))
      .finally(() => setLoading(false));
  }, [fetchUsers, q, page]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setPage(0);
              setQ(e.target.value);
            }}
            placeholder="Procurar por nome ou email…"
            className="pl-9"
          />
        </div>
        {result && (
          <span className="text-sm text-muted-foreground">
            {result.total.toLocaleString("pt-PT")} utilizador
            {result.total === 1 ? "" : "es"}
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
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Créditos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Registo</TableHead>
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
              result.rows.map((u) => (
                <TableRow key={u.id} className="cursor-pointer">
                  <TableCell>
                    <Link
                      to="/admin/users/$id"
                      params={{ id: u.id }}
                      className="block font-medium text-foreground hover:underline"
                    >
                      {u.fullName ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={u.plan.status === "active" ? "default" : "outline"}>
                      {planLabel(u.plan)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono tabular-nums text-foreground">
                    {u.creditsBalance ?? "—"}
                  </TableCell>
                  <TableCell>
                    {u.suspended ? (
                      <Badge variant="destructive">Suspenso</Badge>
                    ) : (
                      <Badge variant="outline" className="border-emerald-400/30 text-emerald-300">
                        Ativo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(u.createdAt)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Nenhum utilizador encontrado.
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
