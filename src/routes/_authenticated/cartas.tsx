import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileSignature, Plus, Loader2 } from "lucide-react";
import { listCoverLetters, getCoverLetter, deleteCoverLetter } from "@/lib/cover_letters.functions";
import { Button } from "@/components/ui/button";

type LetterRow = {
  id: string;
  title: string;
  job_tdr: string | null;
  content: string;
  updated_at: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/cartas")({
  head: () => ({
    meta: [
      { title: "Cartas de Motivação — CV Flexível" },
      { name: "description", content: "As tuas cartas de motivação guardadas." },
    ],
  }),
  component: CartasPage,
});

function contentPreview(content: string): string {
  const firstLines = content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
  return firstLines.length > 140 ? firstLines.slice(0, 140) + "…" : firstLines;
}

function CartasPage() {
  const fetchList = useServerFn(listCoverLetters);
  const fetchOne = useServerFn(getCoverLetter);
  const removeFn = useServerFn(deleteCoverLetter);

  const [rows, setRows] = useState<LetterRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fullContent, setFullContent] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const reload = async () => {
    try {
      const res = await fetchList();
      setRows(res.letters as LetterRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro a carregar cartas");
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDelete = async (id: string) => {
    if (!confirm("Apagar esta carta? Esta ação não pode ser desfeita.")) return;
    setBusy(id);
    try {
      await removeFn({ data: { id } });
      await reload();
    } finally {
      setBusy(null);
    }
  };

  const onToggleOpen = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!fullContent[id]) {
      setLoadingId(id);
      try {
        const row = await fetchOne({ data: { id } });
        setFullContent((prev) => ({ ...prev, [id]: row.content }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro a carregar carta");
      } finally {
        setLoadingId(null);
      }
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
            Cartas de Motivação
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cartas geradas e guardadas na tua conta.
          </p>
        </div>
        <button
          type="button"
          onClick={() => alert("Geração de cartas em breve.")}
          className="inline-flex items-center gap-2 rounded-[10px] bg-[#1b1b19] px-4 py-2 text-sm font-medium text-[#F1EFE8] transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Nova carta
        </button>
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
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#E3DFD7] bg-[#FBFAF7] px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#1b1b19]/6">
            <FileSignature className="h-7 w-7 text-[#5F5E5A]" strokeWidth={1.5} />
          </div>
          <h2 className="mt-5 font-serif text-xl text-[#2C2C2A]">
            Ainda não tens cartas guardadas
          </h2>
          <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-[#5F5E5A]">
            As cartas de motivação geradas a partir dos teus CVs aparecerão aqui quando estiver
            disponível.
          </p>
          <Link
            to="/editor"
            className="mt-6 inline-flex items-center gap-2 rounded-[10px] bg-[#1b1b19] px-5 py-2.5 text-sm font-medium text-[#F1EFE8] transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Ir para o editor
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rows.map((letter) => (
            <div
              key={letter.id}
              className="flex flex-col rounded-lg border border-navy-rule bg-card p-4 sm:p-5"
            >
              <p className="truncate font-serif text-lg text-foreground">{letter.title}</p>
              {letter.job_tdr && (
                <p className="mt-0.5 truncate text-xs uppercase tracking-[0.18em] text-navy-mid">
                  {letter.job_tdr}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(letter.updated_at).toLocaleDateString("pt-PT", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
              <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                {contentPreview(letter.content)}
              </p>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleOpen(letter.id)}
                  className="inline-flex items-center justify-center rounded-[10px] border border-navy-rule bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface"
                >
                  {expandedId === letter.id ? "Fechar" : "Abrir"}
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy === letter.id}
                  onClick={() => onDelete(letter.id)}
                  className="text-destructive hover:text-destructive"
                >
                  Apagar
                </Button>
              </div>
              {expandedId === letter.id && (
                <div className="mt-4 border-t border-navy-rule pt-4">
                  {loadingId === letter.id ? (
                    <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />A carregar…
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm text-foreground">
                      {fullContent[letter.id]}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
