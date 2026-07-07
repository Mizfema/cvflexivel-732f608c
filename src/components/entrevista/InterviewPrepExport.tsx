// Botão de exportação/impressão da preparação de entrevista. O tema
// (mesmos temas do CV/carta) é escolhido só no momento da exportação — não
// fica guardado, e a UI de preparação em ecrã não muda. Reutiliza o mesmo
// mecanismo de impressão do CV/carta: portal para #cv-print-root só
// enquanto a impressão está activa (ver styles.css).

import { useEffect, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { Download } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ensureGoogleFont } from "@/lib/google-fonts";
import { TEMPLATE_THEMES, getTemplateTheme } from "@/lib/templates/themes";
import { InterviewPrepDocument } from "./InterviewPrepDocument";
import type { InterviewQuestion } from "@/lib/interview-types";

const DEFAULT_TEMPLATE = "classico";

export function InterviewPrepExport({
  questions,
  jobTdr,
}: {
  questions: InterviewQuestion[];
  jobTdr: string | null;
}) {
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [open, setOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    ensureGoogleFont(getTemplateTheme(template).fontFamily);
  }, [template]);

  useEffect(() => {
    const handleBeforePrint = () => flushSync(() => setIsPrinting(true));
    const handleAfterPrint = () => flushSync(() => setIsPrinting(false));
    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-[10px] border border-navy-rule bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-surface"
          >
            <Download className="h-4 w-4" />
            Exportar
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 border-[#E3DFD7] bg-[#FBFAF7] p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-navy-mid">Tema</p>
          <div className="flex flex-wrap gap-1.5">
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
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              window.print();
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#1b1b19] px-4 py-2 text-sm font-medium text-[#F1EFE8] transition-opacity hover:opacity-90"
          >
            <Download className="h-4 w-4" />
            Exportar PDF
          </button>
        </PopoverContent>
      </Popover>

      {isPrinting &&
        createPortal(
          <div id="cv-print-root">
            <InterviewPrepDocument draft={{ template, jobTdr, questions }} />
          </div>,
          document.body,
        )}
    </>
  );
}
