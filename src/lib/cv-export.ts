import { Packer } from "docx";
import FileSaver from "file-saver";
const { saveAs } = FileSaver;
import type { CvDraft } from "./cv-types";
import { buildCvDocx } from "./export/docx-builder";

function slugify(s: string) {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "cv"
  );
}

export async function exportCvDocx(draft: CvDraft) {
  const doc = await buildCvDocx(draft.sections, draft.design);
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${slugify(draft.sections.perfil.nome || draft.title)}.docx`);
}

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
