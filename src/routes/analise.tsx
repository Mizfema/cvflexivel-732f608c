import { createFileRoute } from "@tanstack/react-router";

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
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy-mid">
        Análise
      </p>
      <h1 className="mt-4 font-serif text-4xl text-foreground">
        Cobertura de requisitos da vaga
      </h1>
      <p className="mt-4 max-w-2xl text-base text-ink-soft">
        Cola os termos de referência (TdR) e recebe uma análise honesta:
        cobertura por secção, palavras-chave presentes e em falta, requisitos
        eliminatórios não cumpridos e como mitigá-los.
      </p>
      <div className="mt-12 rounded-lg border border-dashed border-navy-rule bg-surface/40 p-12 text-center text-sm text-muted-foreground">
        Etapa 4 — em construção
      </div>
    </div>
  );
}
