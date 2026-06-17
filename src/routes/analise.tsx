import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDraftCv } from "@/hooks/use-draft-cv";
import { analyzeCoverage } from "@/lib/llm.functions";
import type { CoverageAnalysis, SectionCoverage } from "@/lib/coverage-types";

export const Route = createFileRoute("/analise")({
  head: () => ({
    meta: [
      { title: "Análise de cobertura — CV Flexível" },
      {
        name: "description",
        content:
          "Cole os termos de referência da vaga e vê a cobertura por secção, palavras-chave em falta e requisitos eliminatórios.",
      },
    ],
  }),
  component: AnalisePage,
});

function AnalisePage() {
  const { draft, hydrated } = useDraftCv();
  const [tdr, setTdr] = useState("");
  const analyze = useServerFn(analyzeCoverage);

  const mutation = useMutation<CoverageAnalysis, Error, { cv: typeof draft; jobTdr: string }>({
    mutationFn: (vars) => analyze({ data: vars }) as Promise<CoverageAnalysis>,
  });

  const cvVazio =
    hydrated &&
    !draft.sections.perfil.nome &&
    draft.sections.experiencia.length === 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy-mid">
        Análise
      </p>
      <h1 className="mt-3 font-serif text-3xl text-foreground sm:text-4xl">
        Cobertura de requisitos da vaga
      </h1>
      <p className="mt-3 max-w-2xl text-base text-ink-soft">
        Cola os Termos de Referência (TdR). A análise compara contra o teu CV
        actual e mostra o que está coberto e o que falta — sem inventar
        probabilidades.
      </p>

      {cvVazio && (
        <div className="mt-6 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">O teu CV está vazio.</p>
            <p className="mt-1 text-amber-800">
              Preenche o editor primeiro para uma análise útil.{" "}
              <Link
                to="/editor"
                search={{ modo: "cv" }}
                className="font-medium underline"
              >
                Abrir editor
              </Link>
            </p>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Termos de Referência (TdR)
          </label>
          <Textarea
            value={tdr}
            onChange={(e) => setTdr(e.target.value)}
            rows={18}
            placeholder="Cola aqui o anúncio completo da vaga: contexto, responsabilidades, qualificações exigidas, requisitos eliminatórios, competências desejadas…"
            className="mt-2 font-mono text-[13px]"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {tdr.length} caracteres
            </p>
            <Button
              disabled={mutation.isPending || tdr.trim().length < 20}
              onClick={() => mutation.mutate({ cv: draft, jobTdr: tdr })}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> A analisar…
                </>
              ) : mutation.data ? (
                "Voltar a analisar"
              ) : (
                <>
                  Analisar <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </section>

        <section>
          {mutation.isError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {(mutation.error as Error).message}
            </div>
          )}
          {!mutation.data && !mutation.isPending && !mutation.isError && (
            <div className="flex h-full min-h-[300px] items-center justify-center rounded-lg border border-dashed border-navy-rule bg-surface/40 p-8 text-center text-sm text-muted-foreground">
              A análise aparece aqui depois de carregares em <em className="mx-1">Analisar</em>.
            </div>
          )}
          {mutation.data && <Resultado data={mutation.data} />}
        </section>
      </div>
    </div>
  );
}

function Resultado({ data }: { data: CoverageAnalysis }) {
  const pct = data.totalRequisitos
    ? Math.round((data.requisitosCobertos / data.totalRequisitos) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-navy-rule bg-card p-5">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy-mid">
            Cobertura
          </p>
          <p className="font-mono text-sm text-muted-foreground">
            {data.requisitosCobertos} / {data.totalRequisitos} requisitos
          </p>
        </div>
        <p className="mt-3 font-serif text-3xl text-foreground">
          {pct}% cobertos
        </p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-paper-deep">
          <div
            className="h-full bg-navy"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-4 text-sm text-ink-soft">{data.resumo}</p>
      </div>

      {data.requisitosEliminatoriosNaoCumpridos.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h2 className="font-serif text-lg text-foreground">
              Requisitos eliminatórios não cumpridos
            </h2>
          </div>
          <ul className="mt-3 space-y-3">
            {data.requisitosEliminatoriosNaoCumpridos.map((r, i) => (
              <li key={i} className="text-sm">
                <p className="font-medium text-foreground">{r.requisito}</p>
                <p className="mt-1 text-ink-soft">
                  <span className="font-medium text-navy">Mitigação:</span>{" "}
                  {r.mitigacao}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-navy-rule bg-card p-5">
        <h2 className="font-serif text-lg text-foreground">Cobertura por secção</h2>
        <div className="mt-3 space-y-3">
          {data.cobertura.map((c, i) => (
            <SectionRow key={i} c={c} />
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <KeywordBlock
          titulo="Palavras-chave presentes"
          items={data.keywords.presentes}
          tone="ok"
        />
        <KeywordBlock
          titulo="Palavras-chave em falta"
          items={data.keywords.emFalta}
          tone="missing"
        />
      </div>
    </div>
  );
}

function SectionRow({ c }: { c: SectionCoverage }) {
  const scoreLabel = ["Ausente", "Fraco", "Parcial", "Totalmente coberto"][c.score];
  const scoreColor = ["bg-destructive", "bg-amber-500", "bg-amber-400", "bg-emerald-600"][
    c.score
  ];
  return (
    <div className="border-b border-navy-rule/60 pb-3 last:border-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-foreground">{c.secao}</p>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-16 rounded-full ${scoreColor}`} />
          <span className="font-mono text-xs text-muted-foreground">
            {scoreLabel}
          </span>
        </div>
      </div>
      {c.presentes.length > 0 && (
        <p className="mt-2 text-xs text-ink-soft">
          <CheckCircle2 className="mr-1 inline h-3 w-3 text-emerald-600" />
          {c.presentes.join(" · ")}
        </p>
      )}
      {c.emFalta.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          Em falta: {c.emFalta.join(" · ")}
        </p>
      )}
    </div>
  );
}

function KeywordBlock({
  titulo,
  items,
  tone,
}: {
  titulo: string;
  items: string[];
  tone: "ok" | "missing";
}) {
  return (
    <div className="rounded-lg border border-navy-rule bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {titulo}
      </p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">—</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((k, i) => (
            <span
              key={i}
              className={`rounded-full px-2.5 py-1 text-xs ${
                tone === "ok"
                  ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                  : "bg-amber-50 text-amber-900 border border-amber-200"
              }`}
            >
              {k}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
