import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileSignature, Plus } from "lucide-react";
import { listCoverLetters, deleteCoverLetter } from "@/lib/cover_letters.functions";
import { NovaCartaStepper } from "@/components/cartas/NovaCartaStepper";
import { Button } from "@/components/ui/button";
import { CartaThumbnail, CARTA_THUMB_W } from "@/components/carta/CartaThumbnail";
import type { CartaDraft } from "@/components/carta/CartaDocument";
import { normalizeCvDesign } from "@/lib/cv-design-presets";
import { defaultDesignForTemplate } from "@/lib/templates/themes";
import { DocumentCard, DocumentCardGrid } from "@/components/library/DocumentCardGrid";

type LetterRow = {
  id: string;
  title: string;
  job_tdr: string | null;
  content: string;
  template: string;
  design: unknown;
  photo: unknown;
  updated_at: string;
  created_at: string;
};

function toThumbnailDraft(letter: LetterRow): CartaDraft {
  return {
    template: letter.template,
    header: { nome: "", items: [] },
    date: "",
    content: letter.content,
    design: letter.design
      ? normalizeCvDesign(letter.design)
      : defaultDesignForTemplate(letter.template),
    photo: (letter.photo as CartaDraft["photo"]) ?? null,
  };
}

export const Route = createFileRoute("/_authenticated/cartas")({
  head: () => ({
    meta: [
      { title: "Cartas de Motivação — CVelite" },
      { name: "description", content: "As tuas cartas de motivação guardadas." },
    ],
  }),
  component: CartasPage,
});

function CartasPage() {
  const navigate = useNavigate();
  const fetchList = useServerFn(listCoverLetters);
  const removeFn = useServerFn(deleteCoverLetter);

  const [rows, setRows] = useState<LetterRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [novaCartaOpen, setNovaCartaOpen] = useState(false);

  const reload = async () => {
    try {
      const res = await fetchList();
      setRows(res.letters as LetterRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro a carregar cartas");
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDelete = async (id: string) => {
    if (!confirm("Apagar esta carta? Esta ação não pode ser desfeita.")) return;
    setBusy(id);
    try {
      await removeFn({ data: { id } });
      await reload();
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
            Cartas de Motivação
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cartas geradas e guardadas na tua conta.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNovaCartaOpen(true)}
          className="inline-flex items-center gap-2 rounded-[10px] bg-[#1b1b19] px-4 py-2 text-sm font-medium text-[#F1EFE8] transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Nova carta
        </button>
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
            <FileSignature className="h-7 w-7 text-[#5F5E5A]" strokeWidth={1.5} />
          </div>
          <h2 className="mt-5 font-serif text-xl text-[#2C2C2A]">
            Ainda não tens cartas guardadas
          </h2>
          <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-[#5F5E5A]">
            Cria a tua primeira carta de motivação a partir de uma vaga, de forma genérica ou do
            zero.
          </p>
          <button
            type="button"
            onClick={() => setNovaCartaOpen(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-[10px] bg-[#1b1b19] px-5 py-2.5 text-sm font-medium text-[#F1EFE8] transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Nova carta
          </button>
        </div>
      ) : (
        <DocumentCardGrid>
          {rows.map((letter) => (
            <DocumentCard
              key={letter.id}
              thumbnail={<CartaThumbnail draft={toThumbnailDraft(letter)} />}
              thumbnailWidth={CARTA_THUMB_W}
              title={letter.title || "Carta sem título"}
              badge={letter.template}
              date={new Date(letter.updated_at).toLocaleDateString("pt-PT", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
              actions={
                <>
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/carta-editor", search: { id: letter.id } })}
                    className="inline-flex items-center justify-center rounded-[10px] border border-navy-rule bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface"
                  >
                    Abrir
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy === letter.id}
                    onClick={() => onDelete(letter.id)}
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

      <NovaCartaStepper
        open={novaCartaOpen}
        onOpenChange={(v) => {
          setNovaCartaOpen(v);
          if (!v) reload();
        }}
      />
    </div>
  );
}
