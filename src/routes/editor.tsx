import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ArrowRight, X, PenLine, Shuffle } from "lucide-react";
import { CvPagedPreview } from "@/components/editor/CvPagedPreview";
import { EditorForm } from "@/components/editor/EditorForm";
import { InterviewMode } from "@/components/editor/InterviewMode";
import { CvPreviewToolbar } from "@/components/editor/preview-toolbar/CvPreviewToolbar";
import { FullscreenPreviewOverlay } from "@/components/editor/preview-toolbar/FullscreenPreviewOverlay";
import { ExportMenu } from "@/components/editor/ExportMenu";
import { useDraftCv } from "@/hooks/use-draft-cv";
import { useAuth } from "@/hooks/use-auth";
import { useCvAutosave } from "@/hooks/use-cv-autosave";
import { exportCvDocx, exportCvPdf } from "@/lib/cv-export";
import { getCv } from "@/lib/cvs.functions";
import { normalizeCvDesign } from "@/lib/cv-design-presets";
import { useServerFn } from "@tanstack/react-start";
import type { CvSections, AlignmentChange } from "@/lib/cv-types";

const editorSearchSchema = z.object({
  modo: z.enum(["cv-vaga", "cv", "entrevista-vaga", "entrevista-zero"]).optional(),
  jobId: z.string().optional(),
  id: z.string().uuid().optional(),
  export: z.enum(["pdf", "docx"]).optional(),
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
      { title: "Editor — CVelite" },
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
  const { modo, id, export: autoExport } = Route.useSearch();
  const navigate = useNavigate();
  const { draft, update, hydrated } = useDraftCv();
  const { session } = useAuth();
  const fetchCv = useServerFn(getCv);
  const [tab, setTab] = useState<"editar" | "preview">("editar");
  const [interviewDone, setInterviewDone] = useState(false);
  const [cvId, setCvId] = useState<string | undefined>(id);
  const [alignChanges, setAlignChanges] = useState<AlignmentChange[] | null>(null);
  const [loadingCv, setLoadingCv] = useState(!!id);
  const [fullscreen, setFullscreen] = useState(false);

  const autosaveStatus = useCvAutosave({
    draft,
    cvId,
    onSaved: setCvId,
    enabled: hydrated && !!session,
    skip: loadingCv,
  });

  useEffect(() => {
    if (modo !== "cv-vaga") return;
    try {
      const raw = window.localStorage.getItem("cv-flexivel:align-changes");
      if (raw) {
        setAlignChanges(JSON.parse(raw));
        window.localStorage.removeItem("cv-flexivel:align-changes");
      }
    } catch {
      /* ignore */
    }
  }, [modo]);

  // Carregar CV existente quando ?id= e sessão presentes
  useEffect(() => {
    if (!hydrated || !session || !id) {
      setLoadingCv(false);
      return;
    }
    let cancelled = false;
    setLoadingCv(true);
    fetchCv({ data: { id } })
      .then((row) => {
        if (cancelled || !row) return;
        setCvId(row.id);
        update(() => ({
          title: row.title,
          template: row.template,
          sections: row.sections as CvSections,
          design: normalizeCvDesign(row.design),
          updatedAt: row.updated_at,
        }));
      })
      .catch(() => {
        /* silencioso: mantém rascunho local */
      })
      .finally(() => {
        if (!cancelled) setLoadingCv(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, session, id]);

  // Auto-export depois do login (gate único): /editor?export=pdf|docx
  useEffect(() => {
    if (!hydrated || !session || !autoExport) return;
    if (autoExport === "docx") exportCvDocx(draft);
    else exportCvPdf(draft);
    navigate({ to: "/editor", search: { modo: "cv" }, replace: true });
  }, [hydrated, session, autoExport, draft, navigate]);

  const isInterview = (modo === "entrevista-vaga" || modo === "entrevista-zero") && !interviewDone;

  if (hydrated && isInterview) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <InterviewMode
          modo={modo}
          onComplete={(sections) => {
            update((prev) => ({ ...prev, sections }));
            setInterviewDone(true);
          }}
          onCancel={() => {
            setInterviewDone(true);
            navigate({ to: "/editor", search: { modo: "cv" } });
          }}
        />
      </div>
    );
  }

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
            Edita à esquerda, vê a pré-visualização à direita. Guardado automaticamente neste
            dispositivo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {session && (
            <span className="text-xs text-muted-foreground">
              {autosaveStatus === "saving"
                ? "A guardar…"
                : autosaveStatus === "saved"
                  ? "Guardado"
                  : autosaveStatus === "error"
                    ? "Falha ao guardar"
                    : ""}
            </span>
          )}
          <CvPreviewToolbar
            draft={draft}
            update={update}
            fullscreen={false}
            onToggleFullscreen={() => setFullscreen(true)}
            className="shadow-none"
          />
          <ExportMenu draft={draft} cvId={cvId} onSaved={setCvId} />
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

      {alignChanges && alignChanges.length > 0 && (
        <AlignChangesPanel changes={alignChanges} onDismiss={() => setAlignChanges(null)} />
      )}

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
            <EditorForm
              draft={draft}
              update={update}
              userId={session?.user.id}
              onGatedPhotoClick={() =>
                navigate({ to: "/auth", search: { next: "/editor?modo=cv" } })
              }
            />
          </section>
          <section
            className={`${tab === "preview" ? "block" : "hidden"} lg:block lg:sticky lg:top-20`}
            aria-label="Pré-visualização"
          >
            <div className="relative lg:h-[calc(100vh_-_6rem)] lg:overflow-y-auto">
              <CvPagedPreview draft={draft} />
            </div>
          </section>
        </div>
      )}

      {fullscreen && (
        <FullscreenPreviewOverlay
          draft={draft}
          update={update}
          onClose={() => setFullscreen(false)}
        />
      )}
    </div>
  );
}

/* ── Painel "O que foi ajustado" ── */

function AlignChangesPanel({
  changes,
  onDismiss,
}: {
  changes: AlignmentChange[];
  onDismiss: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const reformulados = changes.filter((c) => c.tipo === "reformulado");
  const recontextualizados = changes.filter((c) => c.tipo === "recontextualizado");

  return (
    <div className="mb-6 rounded-xl border border-[#1a5454]/25 bg-gradient-to-br from-[#1a5454]/5 to-transparent animate-result-fade-up">
      <div className="flex items-center justify-between px-5 py-3.5">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2.5 text-left"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1a5454]/10">
            <Shuffle className="h-4 w-4 text-[#1a5454]" />
          </div>
          <div>
            <h3 className="font-serif text-base text-foreground">O que foi ajustado</h3>
            <p className="text-xs text-muted-foreground">
              {changes.length} alteraç{changes.length === 1 ? "ão" : "ões"} — revê antes de exportar
            </p>
          </div>
        </button>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {collapsed ? "Expandir" : "Recolher"}
          </button>
          <button
            onClick={onDismiss}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            title="Fechar painel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="px-5 pb-5 space-y-4">
          {reformulados.length > 0 && (
            <ChangeGroup
              title="Reformulado"
              subtitle="Texto reescrito para usar a terminologia da vaga"
              icon={<PenLine className="h-4 w-4 text-blue-600" />}
              borderColor="border-blue-200"
              bgColor="bg-blue-50"
              textColor="text-blue-700"
              items={reformulados}
            />
          )}
          {recontextualizados.length > 0 && (
            <ChangeGroup
              title="Recontextualizado"
              subtitle="Experiência adjacente reposicionada para o TdR"
              icon={<ArrowRight className="h-4 w-4 text-amber-600" />}
              borderColor="border-amber-200"
              bgColor="bg-amber-50"
              textColor="text-amber-700"
              items={recontextualizados}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ChangeGroup({
  title,
  subtitle,
  icon,
  borderColor,
  bgColor,
  textColor,
  items,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  borderColor: string;
  bgColor: string;
  textColor: string;
  items: AlignmentChange[];
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <div>
          <p className={`text-sm font-medium ${textColor}`}>{title}</p>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-2">
        {items.map((change, i) => (
          <div key={i} className={`rounded-lg border ${borderColor} ${bgColor}/60 p-3`}>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">{change.campo}</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <div className="rounded-md bg-white/80 border border-gray-200 px-2.5 py-1.5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">
                  Antes
                </p>
                <p className="text-xs text-ink-soft line-through decoration-red-300">{change.de}</p>
              </div>
              <div className={`rounded-md bg-white/80 border ${borderColor} px-2.5 py-1.5`}>
                <p
                  className={`text-[10px] font-medium uppercase tracking-wider ${textColor} mb-0.5`}
                >
                  Depois
                </p>
                <p className="text-xs text-foreground">{change.para}</p>
              </div>
            </div>
            <p className="mt-1.5 text-[11px] text-ink-soft italic">{change.justificacao}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
