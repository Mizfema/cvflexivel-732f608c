import { FilePlus, PenLine, ArrowRight } from "lucide-react";
import { Modal, ModalTitle } from "@/components/ui/modal";
import { track } from "@/lib/analytics";

interface CriarCvModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEscolherZero: () => void;
  onEscolherMelhorar: () => void;
}

export function CriarCvModal({
  open,
  onOpenChange,
  onEscolherZero,
  onEscolherMelhorar,
}: CriarCvModalProps) {
  function handleZero() {
    track("cta_click", { cta: "criar_modal_zero" });
    onOpenChange(false);
    onEscolherZero();
  }

  function handleMelhorar() {
    track("cta_click", { cta: "criar_modal_melhorar" });
    onOpenChange(false);
    onEscolherMelhorar();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <div className="space-y-6">
        <div>
          <ModalTitle className="font-serif text-[22px] font-semibold leading-snug text-[#2C2C2A] pr-8">
            Criar o teu CV
          </ModalTitle>
          <p className="mt-1.5 text-[13px] leading-[1.55] text-[#5F5E5A]">Como preferes começar?</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleZero}
            className="group flex flex-col items-start gap-3 rounded-xl border border-[#E3DFD7] bg-white p-5 text-left transition-all duration-200 hover:border-[#1D9E75]/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D9E75]/40"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1D9E75]/10">
              <FilePlus className="h-5 w-5 text-[#1D9E75]" strokeWidth={1.75} />
            </div>
            <div>
              <p className="font-medium text-[#2C2C2A]">Criar do zero</p>
              <p className="mt-1 text-[13px] leading-[1.5] text-[#5F5E5A]">
                Editor vazio, constrói passo a passo.
              </p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-[13px] font-medium text-[#1D9E75] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              Começar <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>

          <button
            type="button"
            onClick={handleMelhorar}
            className="group flex flex-col items-start gap-3 rounded-xl border border-[#E3DFD7] bg-white p-5 text-left transition-all duration-200 hover:border-[#1D9E75]/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D9E75]/40"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1D9E75]/10">
              <PenLine className="h-5 w-5 text-[#1D9E75]" strokeWidth={1.75} />
            </div>
            <div>
              <p className="font-medium text-[#2C2C2A]">Tenho CV, quero apenas melhorar</p>
              <p className="mt-1 text-[13px] leading-[1.5] text-[#5F5E5A]">
                Importa o que já tens e refina.
              </p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-[13px] font-medium text-[#1D9E75] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              Importar <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
