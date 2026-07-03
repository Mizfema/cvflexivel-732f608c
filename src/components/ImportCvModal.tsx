import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { Modal, ModalTitle } from "@/components/ui/modal";
import { FileTextInput } from "@/components/ui/file-text-input";

interface ImportCvModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportCvModal({ open, onOpenChange }: ImportCvModalProps) {
  const navigate = useNavigate();
  const [cvText, setCvText] = useState("");
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const canSubmit = cvText.trim().length >= 20 && !processing;

  function handleClose(v: boolean) {
    if (!v) {
      onOpenChange(false);
      setCvText("");
      setCvFileName(null);
      setFileError(null);
      setProcessing(false);
    } else {
      onOpenChange(v);
    }
  }

  function handleImport() {
    const guard = (s: string) => s.startsWith("PK") || s.includes("[Content_Types].xml");
    if (guard(cvText)) {
      setFileError(
        "O texto contém dados binários em vez de texto legível. Remove e carrega de novo como .txt ou .docx.",
      );
      return;
    }
    window.localStorage.setItem("cv-flexivel:raw-import", cvText);
    navigate({ to: "/editor", search: { modo: "cv" } });
    handleClose(false);
  }

  return (
    <Modal open={open} onOpenChange={handleClose}>
      <div className="space-y-6">
        <div>
          <ModalTitle className="font-serif text-[22px] font-semibold leading-snug text-[#2C2C2A] pr-8">
            Importar CV existente
          </ModalTitle>
          <p className="mt-1.5 text-[13px] leading-[1.55] text-[#5F5E5A]">
            Cola ou carrega o teu CV atual. Vais poder editar e refinar no editor antes de exportar.
          </p>
        </div>

        <FileTextInput
          label="O teu CV"
          value={cvText}
          onChange={(v) => {
            setCvText(v);
            setCvFileName(null);
            setFileError(null);
          }}
          placeholder="Cola aqui o conteúdo completo do teu CV: dados pessoais, resumo, experiência, formação, competências…"
          rows={8}
          fileName={cvFileName}
          onFileLoad={(text, name) => {
            setCvText(text);
            setCvFileName(name);
            setFileError(null);
          }}
          onFileClear={() => {
            setCvFileName(null);
            setCvText("");
          }}
          onError={setFileError}
          onLoadingChange={setProcessing}
        />

        {fileError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {fileError}
          </div>
        )}

        <div className="flex justify-end">
          <button
            disabled={!canSubmit}
            onClick={handleImport}
            className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-[10px] bg-[#1b1b19] px-5 py-2.5 text-sm font-medium text-[#F1EFE8] transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
          >
            Importar e editar
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Modal>
  );
}
