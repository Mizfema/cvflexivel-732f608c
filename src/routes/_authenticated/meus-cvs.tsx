import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Plus } from "lucide-react";
import { listCvs, deleteCv, duplicateCv } from "@/lib/cvs.functions";
import { Button } from "@/components/ui/button";
import { CvThumbnail, THUMB_W } from "@/components/cv/CvThumbnail";
import { DocumentCard, DocumentCardGrid } from "@/components/library/DocumentCardGrid";
import { normalizeCvDesign } from "@/lib/cv-design-presets";
import { EMPTY_CV, type CvDraft, type CvSections } from "@/lib/cv-types";

type CvRow = {
  id: string;
  title: string;
  template: string;
  sections: unknown;
  design: unknown;
  updated_at: string;
  created_at: string;
};

function toThumbnailDraft(cv: CvRow): CvDraft {
  return {
    title: cv.title,
    template: cv.template,
    sections: { ...EMPTY_CV.sections, ...(cv.sections as Partial<CvSections>) },
    design: normalizeCvDesign(cv.design),
    updatedAt: cv.updated_at,
  };
}

export const Route = createFileRoute("/_authenticated/meus-cvs")({
  head: () => ({
    meta: [
      { title: "Os meus CVs — CVelite" },
      { name: "description", content: "Lista de CVs guardados na tua conta." },
    ],
  }),
  component: MeusCvsPage,
});

function MeusCvsPage() {
  const navigate = useNavigate();
  const fetchList = useServerFn(listCvs);
  const removeFn = useServerFn(deleteCv);
  const dupFn = useServerFn(duplicateCv);

  const [rows, setRows] = useState<CvRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = async () => {
    try {
      const res = await fetchList();
      setRows(res.cvs as CvRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro a carregar CVs");
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDelete = async (id: string) => {
    if (!confirm("Apagar este CV? Esta ação não pode ser desfeita.")) return;
    setBusy(id);
    try {
      await removeFn({ data: { id } });
      await reload();
    } finally {
      setBusy(null);
    }
  };

  const onDuplicate = async (id: string) => {
    setBusy(id);
    try {
      const res = await dupFn({ data: { id } });
      navigate({ to: "/editor", search: { id: res.id } });
    } finally {
      setBusy(null);
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
            Os meus CVs
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Retoma, duplica ou apaga CVs guardados na tua conta.
          </p>
        </div>
        <Link
          to="/editor"
          className="inline-flex items-center gap-2 rounded-[10px] bg-[#1b1b19] px-4 py-2 text-sm font-medium text-[#F1EFE8] transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Novo CV
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
            <FileText className="h-7 w-7 text-[#5F5E5A]" strokeWidth={1.5} />
          </div>
          <h2 className="mt-5 font-serif text-xl text-[#2C2C2A]">
            Ainda não tens CVs guardados
          </h2>
          <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-[#5F5E5A]">
            Cria o teu primeiro CV e guarda-o na tua conta para poderes retomar a qualquer momento.
          </p>
          <Link
            to="/editor"
            className="mt-6 inline-flex items-center gap-2 rounded-[10px] bg-[#1b1b19] px-5 py-2.5 text-sm font-medium text-[#F1EFE8] transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Criar o primeiro CV
          </Link>
        </div>
      ) : (
        <DocumentCardGrid>
          {rows.map((cv) => (
            <DocumentCard
              key={cv.id}
              thumbnail={<CvThumbnail draft={toThumbnailDraft(cv)} />}
              thumbnailWidth={THUMB_W}
              title={cv.title || "CV sem título"}
              badge={cv.template}
              date={new Date(cv.updated_at).toLocaleDateString("pt-PT", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
              actions={
                <>
                  <Link
                    to="/editor"
                    search={{ id: cv.id }}
                    className="inline-flex items-center justify-center rounded-[10px] border border-navy-rule bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface"
                  >
                    Abrir
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy === cv.id}
                    onClick={() => onDuplicate(cv.id)}
                  >
                    Duplicar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy === cv.id}
                    onClick={() => onDelete(cv.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    Apagar
                  </Button>
                </>
              }
            />
          ))}
        </DocumentCardGrid>
      )}
    </div>
  );
}
