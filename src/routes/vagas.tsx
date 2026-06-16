import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/vagas")({
  head: () => ({
    meta: [
      { title: "Vagas — CV Flexível" },
      {
        name: "description",
        content:
          "Vagas do setor de desenvolvimento em Moçambique, via ReliefWeb e inserções locais. Data de fecho sempre visível.",
      },
    ],
  }),
  component: VagasPage,
});

function VagasPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy-mid">
        Vagas
      </p>
      <h1 className="mt-4 font-serif text-4xl text-foreground">
        Vagas do setor — Moçambique
      </h1>
      <p className="mt-4 max-w-2xl text-base text-ink-soft">
        Vagas de ONGs, agências de desenvolvimento e administração pública.
        Fonte: ReliefWeb + inserções locais. Cada vaga mostra organização,
        localização e data de fecho.
      </p>
      <div className="mt-12 rounded-lg border border-dashed border-navy-rule bg-surface/40 p-12 text-center text-sm text-muted-foreground">
        Etapa 10 — em construção
      </div>
    </div>
  );
}
