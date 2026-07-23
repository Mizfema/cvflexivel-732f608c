// Pré-visualização paginada da preparação de entrevista — mesmo motor do CV
// (usePagination, SEMPRE coluna única: a entrevista não tem sidebar), pintado
// com o tema partilhado do CV/carta. Reaproveita CVDocument como "moldura" da
// página A4 (isSidebar=false, sidebarHeader=null, sidebarContent=null) em vez
// de duplicar a marcação de página/badge de overflow/rótulo de página.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import type { CSSProperties } from "react";
import { designToCssVars, FONT_OPTIONS } from "@/lib/cv-design-presets";
import type { CvDesign } from "@/lib/cv-types";
import { getTemplateTheme } from "@/lib/templates/themes";
import { ensureGoogleFont } from "@/lib/google-fonts";
import { useInterviewBlocks } from "@/lib/pagination/useInterviewBlocks";
import { usePagination } from "@/lib/pagination/usePagination";
import { PAGE_GAP, PAGE_H, PAGE_W, pageMetrics } from "@/lib/pagination/metrics";
import { CVDocument } from "@/components/cv/CVDocument";
import type { InterviewPrepDraft } from "@/lib/interview-types";

const PAGE_SHADOW = "0 1px 2px rgba(15,23,42,0.06), 0 10px 30px rgba(15,23,42,0.10)";

function SkeletonPage({ scale }: { scale: number }) {
  return (
    <div
      style={{
        width: PAGE_W,
        height: PAGE_H,
        background: "white",
        boxShadow: PAGE_SHADOW,
        borderRadius: 2,
        transformOrigin: "top left",
        transform: `scale(${scale})`,
      }}
    />
  );
}

export function InterviewPrepPagedPreview({
  draft,
  printable = true,
}: {
  draft: InterviewPrepDraft;
  /** Marca este container como fonte do PDF (@media print). Só uma instância deve ter isto ativo de cada vez. */
  printable?: boolean;
}) {
  const theme = getTemplateTheme(draft.template);

  // A entrevista não tem `design` próprio guardado — herda cor/fonte do tema
  // escolhido, tal como InterviewPrepDocument já fazia (espaçamento fixo,
  // não editável, ao contrário do CV/carta).
  const design: CvDesign = useMemo(
    () => ({
      fontFamily: theme.fontFamily,
      accentColor: theme.accentColor,
      spacing: { lineHeight: 1.6, itemGap: "M", sectionGap: "M", pageMargin: "M" },
      fontSize: "M",
    }),
    [theme],
  );

  useEffect(() => {
    ensureGoogleFont(theme.fontFamily);
  }, [theme.fontFamily]);

  // Sempre "single" — a entrevista nunca tem sidebar.
  const metrics = pageMetrics(design, "single");
  const cssVars = designToCssVars(design) as CSSProperties;
  const font = FONT_OPTIONS[theme.fontFamily];

  const cvStyle: CSSProperties = {
    ...cssVars,
    fontFamily: font.family,
    fontSize: "var(--cv-base-size)",
    lineHeight: "var(--cv-line-height)",
    color: "var(--cv-text)",
  };

  const blocks = useInterviewBlocks(draft, theme, metrics);

  const signature = useMemo(
    () => JSON.stringify({ q: draft.questions, tdr: draft.jobTdr, t: draft.template }),
    [draft.questions, draft.jobTdr, draft.template],
  );

  // paginate() de coluna única — NÃO passar sidebarBlocks (paginateTwoColumns
  // só corre quando sidebarBlocks está presente e não-vazio, ver
  // usePagination.ts:60).
  const { pages, overflowIds, measureRef } = usePagination(blocks, {
    contentWidth: metrics.contentWidth,
    contentHeight: metrics.contentHeight,
    signature,
  });

  // Escala para caber na largura do painel (nunca amplia acima da escala 1).
  const panelRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setScale(Math.min(1, el.clientWidth / PAGE_W));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Árvore dedicada para impressão, montada via portal directamente no
  // <body> só enquanto a impressão está activa — mesmo mecanismo do
  // CV/carta (ver CvPagedPreview.tsx). Esta é a ÚNICA dona do portal para
  // #cv-print-root da preparação de entrevista (o InterviewPrepExport já
  // não tem isPrinting/portal próprios).
  const [isPrinting, setIsPrinting] = useState(false);
  useEffect(() => {
    if (!printable) return;
    const handleBeforePrint = () => flushSync(() => setIsPrinting(true));
    const handleAfterPrint = () => flushSync(() => setIsPrinting(false));
    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [printable]);

  const pageCount = pages ? Math.max(pages.length, 1) : 1;
  const innerHeight = pageCount * PAGE_H + (pageCount - 1) * PAGE_GAP;

  return (
    <div ref={panelRef} className="w-full">
      {/* Camada de medição — fora do ecrã, MESMA largura da página.
          Importante: este componente tem de estar sempre montado com
          dimensões reais (nunca dentro de um antepassado com display:none),
          mesmo quando o separador "Ver como vai ficar" não está visível —
          ver InterviewPrepView.tsx, que usa visibility:hidden em vez de
          display:none para o separador inactivo, exactamente por causa
          disto: display:none zeraria offsetHeight de tudo aqui dentro e a
          paginação ficaria congelada com todas as alturas a 0. */}
      <div
        ref={measureRef}
        aria-hidden
        style={{
          ...cvStyle,
          position: "fixed",
          top: 0,
          left: 0,
          visibility: "hidden",
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        <div style={{ width: metrics.mainWidth }}>
          {blocks.map((b) => (
            <div key={b.id} data-block-id={b.id}>
              {b.node}
            </div>
          ))}
        </div>
      </div>

      {/* Área escalada: altura conhecida (N folhas A4 + intervalos) × escala. */}
      <div style={{ height: innerHeight * scale }}>
        {pages ? (
          <div
            style={{
              width: PAGE_W,
              transformOrigin: "top left",
              transform: `scale(${scale})`,
            }}
          >
            {pages.map((pageBlocks, i) => (
              <div key={i} style={{ marginBottom: i < pages.length - 1 ? PAGE_GAP : 0 }}>
                <CVDocument
                  blocks={pageBlocks}
                  sidebarHeader={null}
                  sidebarContent={null}
                  isSidebar={false}
                  metrics={metrics}
                  cvStyle={cvStyle}
                  pageLabel={`${i + 1} / ${pages.length}`}
                  overflow={pageBlocks.some((b) => overflowIds.has(b.id))}
                />
              </div>
            ))}
          </div>
        ) : (
          <SkeletonPage scale={scale} />
        )}
      </div>

      {printable &&
        isPrinting &&
        pages &&
        createPortal(
          <div id="cv-print-root">
            {pages.map((pageBlocks, i) => (
              <div key={i} style={{ marginBottom: i < pages.length - 1 ? PAGE_GAP : 0 }}>
                <CVDocument
                  blocks={pageBlocks}
                  sidebarHeader={null}
                  sidebarContent={null}
                  isSidebar={false}
                  metrics={metrics}
                  cvStyle={cvStyle}
                  pageLabel={`${i + 1} / ${pages.length}`}
                  overflow={pageBlocks.some((b) => overflowIds.has(b.id))}
                />
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
