import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const editorSearchSchema = z.object({
  modo: z
    .enum(["cv-vaga", "cv", "entrevista-vaga", "entrevista-zero"])
    .optional(),
  jobId: z.string().optional(),
});

const labelModo: Record<string, string> = {
  "cv-vaga": "Tens CV e uma vaga em mente",
  cv: "Tens CV, sem vaga",
  "entrevista-vaga": "Tens vaga, sem CV — entrevista guiada",
  "entrevista-zero": "Começa do zero — entrevista guiada",
};

export const Route = createFileRoute("/editor")({
  validateSearch: editorSearchSchema,
  head: () => ({
    meta: [
      { title: "Editor — CV Flexível" },
      {
        name: "description",
        content:
          "Edita o teu CV com pré-visualização ao vivo, escolhe template ATS ou visual e exporta em PDF/DOCX.",
      },
    ],
  }),
  component: EditorPage,
});

function EditorPage() {
  const { modo } = Route.useSearch();
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy-mid">
        Editor
      </p>
      <h1 className="mt-4 font-serif text-4xl text-foreground">
        {modo ? labelModo[modo] : "Editor de CV"}
      </h1>
      <p className="mt-4 max-w-2xl text-base text-ink-soft">
        Esta é a tela do editor. Em breve: secções editáveis à esquerda,
        pré-visualização ao vivo à direita.
      </p>
      <div className="mt-12 rounded-lg border border-dashed border-navy-rule bg-surface/40 p-12 text-center text-sm text-muted-foreground">
        Etapa 3 — em construção
      </div>
    </div>
  );
}
