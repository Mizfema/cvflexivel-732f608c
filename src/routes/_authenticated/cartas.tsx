import { createFileRoute, Link } from "@tanstack/react-router";
import { FileSignature, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cartas")({
  head: () => ({
    meta: [
      { title: "Cartas de Motivação — CV Flexível" },
      { name: "description", content: "As tuas cartas de motivação guardadas." },
    ],
  }),
  component: CartasPage,
});

function CartasPage() {
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
      </header>

      <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#E3DFD7] bg-[#FBFAF7] px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#1b1b19]/6">
          <FileSignature className="h-7 w-7 text-[#5F5E5A]" strokeWidth={1.5} />
        </div>
        <h2 className="mt-5 font-serif text-xl text-[#2C2C2A]">
          Ainda não tens cartas guardadas
        </h2>
        <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-[#5F5E5A]">
          As cartas de motivação geradas a partir dos teus CVs aparecerão aqui quando estiver disponível.
        </p>
        <Link
          to="/editor"
          className="mt-6 inline-flex items-center gap-2 rounded-[10px] bg-[#1b1b19] px-5 py-2.5 text-sm font-medium text-[#F1EFE8] transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Ir para o editor
        </Link>
      </div>
    </div>
  );
}
