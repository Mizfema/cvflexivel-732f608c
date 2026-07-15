import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Download } from "lucide-react";
import { RichTextField } from "@/components/ui/RichTextField";
import { PhotoField } from "@/components/PhotoField";
import { useAuth } from "@/hooks/use-auth";
import { CartaPagedPreview } from "@/components/carta/CartaPagedPreview";
import { CartaPreviewToolbar } from "@/components/cartas/preview-toolbar/CartaPreviewToolbar";
import { CartaFullscreenPreviewOverlay } from "@/components/cartas/preview-toolbar/CartaFullscreenPreviewOverlay";
import { useCoverLetterHeader } from "@/hooks/use-cover-letter-header";
import { useCoverLetterAutosave } from "@/hooks/use-cover-letter-autosave";
import { getCoverLetter } from "@/lib/cover_letters.functions";
import { exportCoverLetterPdf } from "@/lib/cover-letter-export";
import {
  readPendingCoverLetterDraft,
  clearPendingCoverLetterDraft,
} from "@/lib/cover-letter-draft";
import { normalizeCvDesign } from "@/lib/cv-design-presets";
import { defaultDesignForTemplate } from "@/lib/templates/themes";
import type { CoverLetterEditorState } from "@/lib/cover-letter-types";

const DEFAULT_TEMPLATE = "classico";

const searchSchema = z.object({
  id: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/carta-editor")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Editor de Carta — CVelite" },
      { name: "description", content: "Edita, guarda e exporta a tua carta de motivação." },
    ],
  }),
  component: CartaEditorPage,
});

function emptyDraft(): CoverLetterEditorState {
  return {
    title: "Carta sem título",
    content: "",
    cvId: null,
    jobTdr: null,
    template: DEFAULT_TEMPLATE,
    design: defaultDesignForTemplate(DEFAULT_TEMPLATE),
    photo: null,
  };
}

function CartaEditorPage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const fetchOne = useServerFn(getCoverLetter);

  const [loading, setLoading] = useState(!!id);
  const [notFound, setNotFound] = useState(false);
  const [letterId, setLetterId] = useState<string | undefined>(id);
  const [draft, setDraft] = useState<CoverLetterEditorState>(emptyDraft);
  /** Evita reler do servidor quando `onSaved` atualiza o `?id=` na URL — o
   * conteúdo já está em memória, um refetch aqui apagaria o que se está a
   * escrever (a gravação é assíncrona e pode terminar depois de mais edições). */
  const loadedIdRef = useRef<string | undefined>(undefined);
  const [tab, setTab] = useState<"editar" | "preview">("editar");
  const [fullscreen, setFullscreen] = useState(false);

  const update = useCallback(
    (updater: (prev: CoverLetterEditorState) => CoverLetterEditorState) => {
      setDraft(updater);
    },
    [],
  );

  useEffect(() => {
    if (id) {
      if (loadedIdRef.current === id) return;
      let cancelled = false;
      setLoading(true);
      fetchOne({ data: { id } })
        .then((row) => {
          if (cancelled) return;
          loadedIdRef.current = id;
          setLetterId(row.id);
          setDraft({
            title: row.title,
            content: row.content,
            cvId: row.cv_id,
            jobTdr: row.job_tdr,
            template: row.template,
            design: row.design
              ? normalizeCvDesign(row.design)
              : defaultDesignForTemplate(row.template),
            photo: (row.photo as CoverLetterEditorState["photo"]) ?? null,
          });
        })
        .catch(() => setNotFound(true))
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    const pending = readPendingCoverLetterDraft();
    if (pending) {
      setDraft((prev) => ({
        ...prev,
        title: pending.title,
        content: pending.content,
        jobTdr: pending.jobTdr,
        cvId: pending.cvId,
      }));
      clearPendingCoverLetterDraft();
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const autosaveStatus = useCoverLetterAutosave({
    draft,
    letterId,
    onSaved: (newId) => {
      setLetterId(newId);
      if (!id) {
        loadedIdRef.current = newId;
        navigate({ to: "/carta-editor", search: { id: newId }, replace: true });
      }
    },
    enabled: !loading,
    skip: loading,
  });

  const header = useCoverLetterHeader(draft.cvId);
  const today = new Date().toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const previewDraft = {
    template: draft.template,
    header,
    date: today,
    content: draft.content,
    design: draft.design,
    photo: draft.photo,
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-muted-foreground">
        A carregar…
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">Não foi possível encontrar esta carta.</p>
        <Link
          to="/cartas"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-foreground underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar às cartas
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
      <Link
        to="/cartas"
        className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-navy-mid hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Cartas de Motivação
      </Link>

      <header className="mt-4 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <input
            value={draft.title}
            onChange={(e) => update((p) => ({ ...p, title: e.target.value }))}
            placeholder="Título da carta"
            className="w-full border-none bg-transparent font-serif text-3xl text-foreground outline-none placeholder:text-muted-foreground/50 sm:text-4xl"
          />
          {draft.jobTdr && (
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-navy-mid">
              Vaga:{" "}
              {draft.jobTdr
                .split("\n")
                .find((l) => l.trim())
                ?.slice(0, 100)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {autosaveStatus === "saving"
              ? "A guardar…"
              : autosaveStatus === "saved"
                ? "Guardado"
                : autosaveStatus === "error"
                  ? "Falha ao guardar"
                  : ""}
          </span>
          <CartaPreviewToolbar
            previewDraft={previewDraft}
            onTemplateChange={(templateId) => update((p) => ({ ...p, template: templateId }))}
            onDesignChange={(designUpdater) =>
              update((p) => ({ ...p, design: designUpdater(p.design) }))
            }
            fullscreen={false}
            onToggleFullscreen={() => setFullscreen(true)}
            className="shadow-none"
          />
          <button
            type="button"
            onClick={() => exportCoverLetterPdf(draft.title)}
            className="inline-flex items-center gap-2 rounded-[10px] border border-navy-rule bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-surface"
          >
            <Download className="h-4 w-4" />
            Exportar PDF
          </button>
        </div>
      </header>

      {/* Mobile tabs */}
      <div className="mb-4 flex rounded-md border border-navy-rule bg-card p-1 lg:hidden">
        <button
          onClick={() => setTab("editar")}
          className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "editar" ? "bg-navy text-paper" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Editar
        </button>
        <button
          onClick={() => setTab("preview")}
          className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "preview" ? "bg-navy text-paper" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Pré-visualizar
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section
          className={`${tab === "editar" ? "block" : "hidden"} lg:block`}
          aria-label="Formulário"
        >
          <div className="mb-4 rounded-lg border border-navy-rule bg-card p-4">
            <PhotoField
              photo={draft.photo}
              onChange={(photo) => update((p) => ({ ...p, photo }))}
              userId={user?.id}
            />
          </div>
          <RichTextField
            value={draft.content}
            onChange={(content) => update((p) => ({ ...p, content }))}
            placeholder="Escreve a tua carta de motivação…"
            minHeight={520}
          />
        </section>
        <section
          className={`${tab === "preview" ? "block" : "hidden"} lg:block lg:sticky lg:top-20`}
          aria-label="Pré-visualização"
        >
          <div className="relative lg:h-[calc(100vh_-_6rem)] lg:overflow-y-auto">
            <CartaPagedPreview draft={previewDraft} />
          </div>
        </section>
      </div>

      {fullscreen && (
        <CartaFullscreenPreviewOverlay
          draft={previewDraft}
          onTemplateChange={(templateId) => update((p) => ({ ...p, template: templateId }))}
          onDesignChange={(designUpdater) =>
            update((p) => ({ ...p, design: designUpdater(p.design) }))
          }
          onClose={() => setFullscreen(false)}
        />
      )}
    </div>
  );
}
