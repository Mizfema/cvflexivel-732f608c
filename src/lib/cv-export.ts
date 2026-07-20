import type { CvDraft } from "./cv-types";

function filenameSafeTitle(s: string) {
  return s.replace(/[\\/:*?"<>|]/g, "").trim() || "CV";
}

/**
 * Exportar PDF via diálogo de impressão do navegador (print CSS sobre as
 * páginas reais em `.cv-print-page`, ver @media print em styles.css).
 * Funciona bem para CVs ATS porque o texto é seleccionável. Client-side only.
 */
export async function exportCvPdf(draft: CvDraft) {
  if (typeof window === "undefined") return;

  await document.fonts.ready;

  const previousTitle = document.title;
  document.title = filenameSafeTitle(draft.sections.perfil.nome || draft.title);

  const restoreTitle = () => {
    document.title = previousTitle;
    window.removeEventListener("afterprint", restoreTitle);
  };
  window.addEventListener("afterprint", restoreTitle);

  window.print();
}
