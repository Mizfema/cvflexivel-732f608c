// Preview do CV em páginas A4 reais (fase F10). Substitui a preview contínua.
// Mede os blocos fora do ecrã na escala 1, distribui-os por páginas e desenha N
// folhas A4 escaladas para caberem no painel.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import type { CSSProperties } from "react";
import { setRichTextPrintBypass } from "@/lib/rich-text";
import type { CvDraft } from "@/lib/cv-types";
import { designToCssVars, getTemplate, type FontId } from "@/lib/cv-design-presets";
import { ensureGoogleFont } from "@/lib/google-fonts";
import { useCvBlocks } from "@/lib/pagination/useCvBlocks";
import { usePagination } from "@/lib/pagination/usePagination";
import type { CvBlock } from "@/lib/pagination/types";
import { PAGE_GAP, PAGE_H, PAGE_W, SIDEBAR_W, pageMetrics } from "@/lib/pagination/metrics";
import { CVDocument } from "@/components/cv/CVDocument";

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

export function CvPagedPreview({
  draft,
  printable = true,
}: {
  draft: CvDraft;
  /** Marca este container como fonte do PDF (@media print). Só uma instância deve ter isto ativo de cada vez. */
  printable?: boolean;
}) {
  useEffect(() => {
    ensureGoogleFont(draft.design.fontFamily as FontId);
  }, [draft.design.fontFamily]);

  const template = getTemplate(draft.template);
  const isSidebar = template.layout === "sidebar";
  const metrics = pageMetrics(draft.design, template.layout);
  const cssVars = designToCssVars(draft.design) as CSSProperties;

  const cvStyle: CSSProperties = {
    ...cssVars,
    fontFamily: "var(--cv-font)",
    fontSize: "var(--cv-base-size)",
    lineHeight: "var(--cv-line-height)",
    color: "var(--cv-text)",
  };

  const { mainBlocks, sidebarHeader, sidebarBlocks, sidebar } = useCvBlocks(
    draft,
    template,
    metrics,
  );

  // Decisão de produto (Fase P4): por agora, só os templates com o nome na
  // sidebar (nameInSidebar) usam a paginação de duas colunas — é o único
  // caso onde o cabeçalho fixo da sidebar é mais alto do que o topo da
  // coluna principal, exigindo o realinhamento. Os restantes templates de
  // sidebar (accentSurface "sidebar"/"sidebar-block" sem nameInSidebar)
  // continuam a usar o `sidebar` (compat) tal como hoje — só a página 1 o
  // mostra, sem paginação — para não lhes alterar o comportamento nesta fase.
  const useTwoColumn = isSidebar && !!template.nameInSidebar;

  const signature = useMemo(
    () =>
      JSON.stringify({
        s: draft.sections,
        d: draft.design,
        t: draft.template,
      }),
    [draft.sections, draft.design, draft.template],
  );

  const { pages, overflowIds, measureRef, twoColumnPages } = usePagination(mainBlocks, {
    contentWidth: metrics.mainWidth,
    contentHeight: metrics.contentHeight,
    signature,
    sidebarBlocks: useTwoColumn ? sidebarBlocks : undefined,
    sidebarContentHeight: metrics.contentHeight,
  });

  // Normaliza os dois casos (coluna dupla vs. coluna única) numa única forma
  // de iterar no render: cada página tem sempre `main` + `sidebarContent`
  // (null quando não há paginação de sidebar nesta página/template).
  const renderPages: Array<{ main: CvBlock[]; sidebarContent: CvBlock[] | null }> | null =
    useTwoColumn && twoColumnPages
      ? twoColumnPages.map((p) => ({ main: p.main, sidebarContent: p.sidebar }))
      : pages
        ? pages.map((blocks) => ({ main: blocks, sidebarContent: null }))
        : null;

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

  // Árvore dedicada para impressão (ver @media print em styles.css): monta um
  // portal sem escala/transform directamente no <body> só enquanto a
  // impressão está activa, e desmonta logo a seguir — nunca fica DOM extra.
  // flushSync garante que o portal já está no DOM quando o browser captura o
  // layout para imprimir (beforeprint/afterprint disparam à volta de
  // window.print(), incluindo o Ctrl+P nativo do utilizador). O bypass do
  // bypass da sanitização tem de estar activo ANTES do flushSync, porque é esse render
  // síncrono que volta a chamar sanitizeCvHtml em cada RichText.
  const [isPrinting, setIsPrinting] = useState(false);
  useEffect(() => {
    if (!printable) return;
    const handleBeforePrint = () => {
      setRichTextPrintBypass(true);
      flushSync(() => setIsPrinting(true));
    };
    const handleAfterPrint = () => {
      flushSync(() => setIsPrinting(false));
      setRichTextPrintBypass(false);
    };
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
      {/* Camada de medição — fora do ecrã, MESMA largura e estilos da coluna. */}
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
          {mainBlocks.map((b) => (
            <div key={b.id} data-block-id={b.id}>
              {b.node}
            </div>
          ))}
        </div>
        {useTwoColumn && (
          // Largura REAL do conteúdo dentro da <aside> — não SIDEBAR_W inteiro.
          // A <aside> (CVDocument.tsx, accentSurface "sidebar"/"sidebar-hero",
          // as únicas usadas pelos templates nameInSidebar) tem padding próprio
          // de 20px à direita e metrics.padX à esquerda; medir a SIDEBAR_W
          // cheio faz o texto quebrar em menos linhas do que no render real,
          // subestimando a altura e deixando conteúdo real ultrapassar a
          // página (cortado pelo overflow:hidden). Mantém isto sincronizado
          // com o padding da aside em CVDocument.tsx.
          <div style={{ width: SIDEBAR_W - 20 - metrics.padX }}>
            {sidebarHeader && (
              <div data-sidebar-header-id="sidebar-header">{sidebarHeader}</div>
            )}
            {sidebarBlocks.map((b) => (
              <div key={b.id} data-block-id={b.id}>
                {b.node}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Área escalada: altura conhecida (N folhas A4 + intervalos) × escala. */}
      <div style={{ height: innerHeight * scale }}>
        {renderPages ? (
          <div
            style={{
              width: PAGE_W,
              transformOrigin: "top left",
              transform: `scale(${scale})`,
            }}
          >
            {renderPages.map((page, i) => (
              <div
                key={i}
                style={{ marginBottom: i < renderPages.length - 1 ? PAGE_GAP : 0 }}
              >
                <CVDocument
                  blocks={page.main}
                  sidebarHeader={i === 0 ? (useTwoColumn ? sidebarHeader : sidebar) : null}
                  sidebarContent={page.sidebarContent}
                  isSidebar={isSidebar}
                  metrics={metrics}
                  cvStyle={cvStyle}
                  pageLabel={`${i + 1} / ${renderPages.length}`}
                  overflow={
                    page.main.some((b) => overflowIds.has(b.id)) ||
                    (page.sidebarContent?.some((b) => overflowIds.has(b.id)) ?? false)
                  }
                  accentSurface={template.accentSurface}
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
        renderPages &&
        createPortal(
          <div id="cv-print-root">
            {renderPages.map((page, i) => (
              <div
                key={i}
                style={{ marginBottom: i < renderPages.length - 1 ? PAGE_GAP : 0 }}
              >
                <CVDocument
                  blocks={page.main}
                  sidebarHeader={i === 0 ? (useTwoColumn ? sidebarHeader : sidebar) : null}
                  sidebarContent={page.sidebarContent}
                  isSidebar={isSidebar}
                  metrics={metrics}
                  cvStyle={cvStyle}
                  pageLabel={`${i + 1} / ${renderPages.length}`}
                  overflow={
                    page.main.some((b) => overflowIds.has(b.id)) ||
                    (page.sidebarContent?.some((b) => overflowIds.has(b.id)) ?? false)
                  }
                  accentSurface={template.accentSurface}
                />
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
