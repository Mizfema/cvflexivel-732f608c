import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquare, Plus, ChevronDown, Loader2 } from "lucide-react";
import { listInterviewPreps, getInterviewPrep } from "@/lib/interview-preps.functions";
import { InterviewPrepResult } from "@/components/InterviewPrepResult";
import { InterviewPrepExport } from "@/components/entrevista/InterviewPrepExport";
import type { InterviewQuestion } from "@/lib/interview-types";

type PrepRow = {
  id: string;
  cv_id: string | null;
  job_tdr: string | null;
  created_at: string;
  updated_at: string;
};

export const Route = createFileRoute("/_authenticated/entrevistas")({
  head: () => ({
    meta: [
      { title: "Preparar Entrevista — CV Flexível" },
      { name: "description", content: "Os teus planos de preparação de entrevista." },
    ],
  }),
  component: EntrevistasPage,
});

function tdrPreview(tdr: string | null): string {
  if (!tdr) return "Vaga sem descrição";
  const firstLine =
    tdr
      .split("\n")
      .find((l) => l.trim())
      ?.trim() ?? tdr;
  return firstLine.length > 90 ? firstLine.slice(0, 90) + "…" : firstLine;
}

function EntrevistasPage() {
  const fetchList = useServerFn(listInterviewPreps);
  const fetchOne = useServerFn(getInterviewPrep);

  const [rows, setRows] = useState<PrepRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, InterviewQuestion[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchList()
      .then((res) => setRows(res.preps as PrepRow[]))
      .catch((e) => setError(e instanceof Error ? e.message : "Erro a carregar preparações"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!detail[id]) {
      setLoadingId(id);
      try {
        const row = await fetchOne({ data: { id } });
        setDetail((prev) => ({
          ...prev,
          [id]: (row.questions ?? []) as unknown as InterviewQuestion[],
        }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro a carregar preparação");
      } finally {
        setLoadingId(null);
      }
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy-mid">
            A tua conta
          </p>
          <h1 className="mt-2 font-serif text-3xl text-foreground sm:text-4xl">
            Preparar Entrevista
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Planos de preparação de entrevista gerados para as tuas candidaturas.
          </p>
        </div>
        <Link
          to="/preparar-entrevista"
          className="inline-flex items-center gap-2 rounded-[10px] bg-[#1b1b19] px-4 py-2 text-sm font-medium text-[#F1EFE8] transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Nova preparação
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
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#E3DFD7] bg-[#FBFAF7] px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#1b1b19]/6">
            <MessageSquare className="h-7 w-7 text-[#5F5E5A]" strokeWidth={1.5} />
          </div>
          <h2 className="mt-5 font-serif text-xl text-[#2C2C2A]">
            Ainda não tens preparações guardadas
          </h2>
          <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-[#5F5E5A]">
            Gera a tua primeira simulação de entrevista a partir de uma vaga, carta e CV.
          </p>
          <Link
            to="/preparar-entrevista"
            className="mt-6 inline-flex items-center gap-2 rounded-[10px] bg-[#1b1b19] px-5 py-2.5 text-sm font-medium text-[#F1EFE8] transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Preparar entrevista
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const isOpen = expandedId === row.id;
            return (
              <li key={row.id} className="rounded-lg border border-navy-rule bg-card">
                <button
                  type="button"
                  onClick={() => toggle(row.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="truncate font-serif text-lg text-foreground">
                      {tdrPreview(row.job_tdr)}
                    </p>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {new Date(row.created_at).toLocaleDateString("pt-PT", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="border-t border-navy-rule px-4 py-5 sm:px-6">
                    {loadingId === row.id ? (
                      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />A carregar perguntas…
                      </div>
                    ) : detail[row.id] ? (
                      <div className="space-y-4">
                        <div className="flex justify-end">
                          <InterviewPrepExport questions={detail[row.id]} jobTdr={row.job_tdr} />
                        </div>
                        <InterviewPrepResult questions={detail[row.id]} />
                      </div>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
