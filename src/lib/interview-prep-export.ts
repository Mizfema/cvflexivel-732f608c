import type { InterviewPrepDraft } from "@/lib/interview-types";

function filenameSafeTitle(s: string) {
  return s.replace(/[\\/:*?"<>|]/g, "").trim() || "Preparação de entrevista";
}

function draftTitle(draft: InterviewPrepDraft): string {
  const firstLine = draft.jobTdr
    ?.split("\n")
    .find((l) => l.trim())
    ?.trim();
  return filenameSafeTitle(firstLine || "Preparação de entrevista");
}

/**
 * Exportar PDF da preparação de entrevista via diálogo de impressão do
 * navegador — mesma abordagem do CV/carta (ver cv-export.ts).
 */
export async function exportInterviewPrepPdf(draft: InterviewPrepDraft) {
  if (typeof window === "undefined") return;

  await document.fonts.ready;

  const previousTitle = document.title;
  document.title = draftTitle(draft);

  const restoreTitle = () => {
    document.title = previousTitle;
    window.removeEventListener("afterprint", restoreTitle);
  };
  window.addEventListener("afterprint", restoreTitle);

  window.print();
}
