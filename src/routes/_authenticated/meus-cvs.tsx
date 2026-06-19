import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listCvs, deleteCv, duplicateCv } from "@/lib/cvs.functions";
import { Button } from "@/components/ui/button";

type CvRow = {
  id: string;
  title: string;
  template: string;
  updated_at: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/meus-cvs")({
  head: () => ({
    meta: [
      { title: "Os meus CVs — CV Flexível" },
      { name: "description", content: "Lista de CVs guardados na tua conta." },
    ],
  }),
  component: MeusCvsPage,
});

function MeusCvsPage() {
  const navigate = useNavigate();
  const fetchList = useServerFn(listCvs);
  const removeFn = useServerFn(deleteCv);
  const dupFn = useServerFn(duplicateCv);

  const [rows, setRows] = useState<CvRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = async () => {
    try {
      const res = await fetchList();
      setRows(res.cvs as CvRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro a carregar CVs");
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDelete = async (id: string) => {
    if (!confirm("Apagar este CV? Esta ação não pode ser desfeita.")) return;
    setBusy(id);
    try {
      await removeFn({ data: { id } });
      await reload();
    } finally {
      setBusy(null);
    }
  };

  const onDuplicate = async (id: string) => {
    setBusy(id);
    try {
      const res = await dupFn({ data: { id } });
      navigate({ to: "/editor", search: { id: res.id } });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy-mid">
            A tua conta
          </p>
          <h1 className="mt-2 font-serif text-3xl text-foreground sm:text-4xl">
            Os meus CVs
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Retoma, duplica ou apaga CVs guardados na tua conta.
          </p>
        </div>
        <Link
          to="/editor"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-navy-deep"
        >
          Novo CV
        </Link>
      </header>

      {error && (
        <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {rows === null ? (
        <div className="rounded-lg border border-dashed border-navy-rule p-12 text-center text-sm text-muted-foreground">
          A carregar…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-navy-rule p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Ainda não tens CVs guardados.
          </p>
          <Link
            to="/editor"
            className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-navy-deep"
          >
            Criar o primeiro
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-navy-rule rounded-lg border border-navy-rule bg-card">
          {rows.map((cv) => (
            <li
              key={cv.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6"
            >
              <div className="min-w-0">
                <p className="truncate font-serif text-lg text-foreground">
                  {cv.title}
                </p>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {cv.template} ·{" "}
                  {new Date(cv.updated_at).toLocaleDateString("pt-PT", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/editor"
                  search={{ id: cv.id }}
                  className="inline-flex items-center justify-center rounded-md border border-navy-rule bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface"
                >
                  Abrir
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy === cv.id}
                  onClick={() => onDuplicate(cv.id)}
                >
                  Duplicar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy === cv.id}
                  onClick={() => onDelete(cv.id)}
                  className="text-destructive hover:text-destructive"
                >
                  Apagar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
