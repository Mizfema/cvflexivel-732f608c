import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { CvPreview } from "@/components/editor/CvPreview";
import { EditorForm } from "@/components/editor/EditorForm";
import { useDraftCv } from "@/hooks/use-draft-cv";
import { Button } from "@/components/ui/button";

const editorSearchSchema = z.object({
  modo: z
    .enum(["cv-vaga", "cv", "entrevista-vaga", "entrevista-zero"])
    .optional(),
  jobId: z.string().optional(),
});

const labelModo: Record<string, string> = {
  "cv-vaga": "CV + vaga",
  cv: "Tens CV",
  "entrevista-vaga": "Entrevista guiada com vaga",
  "entrevista-zero": "Entrevista guiada do zero",
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
  const { draft, update, hydrated, reset } = useDraftCv();
  const [tab, setTab] = useState<"editar" | "preview">("editar");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy-mid">
            Editor {modo ? `· ${labelModo[modo]}` : ""}
          </p>
          <h1 className="mt-2 font-serif text-3xl text-foreground sm:text-4xl">
            {draft.sections.perfil.nome || "O teu CV"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Edita à esquerda, vê a pré-visualização à direita. Guardado
            automaticamente neste dispositivo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm("Limpar tudo? O rascunho neste dispositivo será apagado.")) {
                reset();
              }
            }}
          >
            Limpar
          </Button>
        </div>
      </header>

      {/* Mobile tabs */}
      <div className="mb-4 flex rounded-md border border-navy-rule bg-card p-1 lg:hidden">
        <button
          onClick={() => setTab("editar")}
          className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "editar"
              ? "bg-navy text-paper"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Editar
        </button>
        <button
          onClick={() => setTab("preview")}
          className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "preview"
              ? "bg-navy text-paper"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Pré-visualizar
        </button>
      </div>

      {!hydrated ? (
        <div className="rounded-lg border border-dashed border-navy-rule p-12 text-center text-sm text-muted-foreground">
          A carregar rascunho…
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section
            className={`${tab === "editar" ? "block" : "hidden"} lg:block`}
            aria-label="Formulário"
          >
            <EditorForm draft={draft} update={update} />
          </section>
          <section
            className={`${tab === "preview" ? "block" : "hidden"} lg:block lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto`}
            aria-label="Pré-visualização"
          >
            <CvPreview draft={draft} />
          </section>
        </div>
      )}
    </div>
  );
}
