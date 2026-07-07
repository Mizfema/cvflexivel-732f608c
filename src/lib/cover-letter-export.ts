function filenameSafeTitle(s: string) {
  return s.replace(/[\\/:*?"<>|]/g, "").trim() || "Carta de motivação";
}

/**
 * Exportar PDF da carta via diálogo de impressão do navegador — mesma
 * abordagem do CV (ver cv-export.ts): print CSS sobre `.cv-print-page`.
 */
export async function exportCoverLetterPdf(title: string) {
  if (typeof window === "undefined") return;

  await document.fonts.ready;

  const previousTitle = document.title;
  document.title = filenameSafeTitle(title);

  const restoreTitle = () => {
    document.title = previousTitle;
    window.removeEventListener("afterprint", restoreTitle);
  };
  window.addEventListener("afterprint", restoreTitle);

  window.print();
}
