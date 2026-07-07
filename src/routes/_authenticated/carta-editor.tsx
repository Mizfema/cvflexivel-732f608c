import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Download, Loader2, AlertTriangle } from "lucide-react";
import { RichTextField } from "@/components/ui/RichTextField";
import { CoverLetterPrintPortal } from "@/components/cartas/CoverLetterPrintPortal";
import { getCoverLetter, saveCoverLetter } from "@/lib/cover_letters.functions";
import { exportCoverLetterPdf } from "@/lib/cover-letter-export";
import {
  readPendingCoverLetterDraft,
  clearPendingCoverLetterDraft,
} from "@/lib/cover-letter-draft";
import { TEMPLATE_THEMES } from "@/lib/templates/themes";

const DEFAULT_TEMPLATE = "classico";

const searchSchema = z.object({
  id: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/carta-editor")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Editor de Carta — CV Flexível" },
      { name: "description", content: "Edita, guarda e exporta a tua carta de motivação." },
    ],
  }),
  component: CartaEditorPage,
});

function CartaEditorPage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const fetchOne = useServerFn(getCoverLetter);
  const saveFn = useServerFn(saveCoverLetter);

  const [loading, setLoading] = useState(!!id);
  const [notFound, setNotFound] = useState(false);
  const [letterId, setLetterId] = useState<string | undefined>(id);
  const [title, setTitle] = useState("Carta sem título");
  const [content, setContent] = useState("");
  const [cvId, setCvId] = useState<string | null>(null);
  const [jobTdr, setJobTdr] = useState<string | null>(null);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);

  useEffect(() => {
    if (id) {
      let cancelled = false;
      setLoading(true);
      fetchOne({ data: { id } })
        .then((row) => {
          if (cancelled) return;
          setLetterId(row.id);
          setTitle(row.title);
          setContent(row.content);
          setCvId(row.cv_id);
          setJobTdr(row.job_tdr);
          setTemplate(row.template);
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
      setTitle(pending.title);
      setContent(pending.content);
      setJobTdr(pending.jobTdr);
      setCvId(pending.cvId);
      clearPendingCoverLetterDraft();
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const save = useMutation<{ id: string }, Error, void>({
    mutationFn: () =>
      saveFn({
        data: {
          id: letterId,
          title: title.trim() || "Carta sem título",
          cvId,
          jobTdr,
          content,
          template,
        },
      }) as Promise<{ id: string }>,
    onSuccess: (res) => {
      setLetterId(res.id);
      if (!id) {
        navigate({ to: "/carta-editor", search: { id: res.id }, replace: true });
      }
    },
  });

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
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      <Link
        to="/cartas"
        className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-navy-mid hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Cartas de Motivação
      </Link>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título da carta"
        className="mt-4 w-full border-none bg-transparent font-serif text-3xl text-foreground outline-none placeholder:text-muted-foreground/50 sm:text-4xl"
      />

      {jobTdr && (
        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-navy-mid">
          Vaga:{" "}
          {jobTdr
            .split("\n")
            .find((l) => l.trim())
            ?.slice(0, 100)}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-navy-mid">Tema</span>
        {TEMPLATE_THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTemplate(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              template === t.id
                ? "border-transparent text-white"
                : "border-navy-rule bg-background text-foreground hover:bg-surface"
            }`}
            style={template === t.id ? { backgroundColor: t.accentColor } : undefined}
          >
            {t.nome}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <RichTextField
          value={content}
          onChange={setContent}
          placeholder="Escreve a tua carta de motivação…"
          minHeight={360}
        />
      </div>

      {save.isError && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {save.error.message}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-navy-rule pt-5">
        {save.isSuccess && !save.isPending && (
          <span className="mr-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Guardado
          </span>
        )}
        <button
          type="button"
          onClick={() => exportCoverLetterPdf(title)}
          className="inline-flex items-center gap-2 rounded-[10px] border border-navy-rule bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-surface"
        >
          <Download className="h-4 w-4" />
          Exportar PDF
        </button>
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate()}
          className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#1b1b19] px-5 py-2.5 text-sm font-medium text-[#F1EFE8] transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
        >
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar
        </button>
      </div>

      <CoverLetterPrintPortal content={content} cvId={cvId} template={template} />
    </div>
  );
}
