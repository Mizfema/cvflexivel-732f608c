// Botão de exportação da preparação de entrevista. Já não tem isPrinting nem
// portal próprios — quem possui o portal para #cv-print-root é
// InterviewPrepPagedPreview (ver InterviewPrepView.tsx), que já está sempre
// montada com a MESMA `draft` (mesmo `template`, fonte única — ver
// InterviewPrepThemeToolbar.tsx). Este botão só dispara `window.print()`
// através de exportInterviewPrepPdf.

import { Download } from "lucide-react";
import { exportInterviewPrepPdf } from "@/lib/interview-prep-export";
import type { InterviewPrepDraft } from "@/lib/interview-types";

export function InterviewPrepExport({ draft }: { draft: InterviewPrepDraft }) {
  return (
    <button
      type="button"
      onClick={() => exportInterviewPrepPdf(draft)}
      className="inline-flex items-center gap-2 rounded-[10px] border border-navy-rule bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-surface"
    >
      <Download className="h-4 w-4" />
      Exportar PDF
    </button>
  );
}
