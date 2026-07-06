// Preview do CV em páginas A4 reais (fase F10). Substitui a preview contínua.
// Mede os blocos fora do ecrã na escala 1, distribui-os por páginas e desenha N
// folhas A4 escaladas para caberem no painel.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import type { CSSProperties, ReactNode } from "react";
import { setRichTextPrintBypass } from "@/lib/rich-text";
import type { CvDraft } from "@/lib/cv-types";
import { designToCssVars, getTemplate, type FontId } from "@/lib/cv-design-presets";
import { ensureGoogleFont } from "@/lib/google-fonts";
import { useCvBlocks } from "@/lib/pagination/useCvBlocks";
import { usePagination } from "@/lib/pagination/usePagination";
import {
  PAGE_GAP,
  PAGE_H,
  PAGE_W,
  SIDEBAR_GAP,
  SIDEBAR_W,
  pageMetrics,
} from "@/lib/pagination/metrics";
import type { CvBlock } from "@/lib/pagination/types";
import type { PageMetrics } from "@/lib/pagination/metrics";

const PAGE_SHADOW = "0 1px 2px rgba(15,23,42,0.06), 0 10px 30px rgba(15,23,42,0.10)";

function BlockList({ blocks }: { blocks: CvBlock[] }) {
  return (
    <>
      {blocks.map((b, i) => (
        <div key={b.id} style={{ marginTop: i === 0 ? 0 : b.marginBefore }}>
          {b.node}
        </div>
      ))}
    </>
  );
}

function Page({
  index,
  total,
  blocks,
  sidebar,
  isSidebar,
  metrics,
  cvStyle,
  overflow,
}: {
  index: number;
  total: number;
  blocks: CvBlock[];
  sidebar: ReactNode | null;
  isSidebar: boolean;
  metrics: PageMetrics;
  cvStyle: CSSProperties;
  overflow: boolean;
}) {
  return (
    <div
      className="cv-print-page"
      style={{
        ...cvStyle,
        position: "relative",
        width: PAGE_W,
        height: PAGE_H,
        background: "white",
        boxShadow: PAGE_SHADOW,
        borderRadius: 2,
        padding: `${metrics.padY}px ${metrics.padX}px`,
        marginBottom: index < total - 1 ? PAGE_GAP : 0,
        overflow: "hidden",
      }}
    >
      {isSidebar ? (
        <div style={{ display: "flex", gap: SIDEBAR_GAP, height: "100%" }}>
          <aside
            style={{
              width: SIDEBAR_W,
              flexShrink: 0,
              paddingRight: 20,
              borderRight: "1px solid var(--cv-rule)",
            }}
          >
            {index === 0 ? sidebar : null}
          </aside>
          <div style={{ flex: 1, minWidth: 0 }}>
            <BlockList blocks={blocks} />
          </div>
        </div>
      ) : (
        <BlockList blocks={blocks} />
      )}

      {overflow && (
        <span
          data-cv-overflow-badge
          style={{
            position: "absolute",
            top: 8,
            right: 10,
            fontSize: 9,
            padding: "2px 6px",
            borderRadius: 4,
            background: "rgba(180,83,9,0.10)",
            color: "#9a3412",
          }}
        >
          Conteúdo excede a página
        </span>
      )}

      <span
        data-cv-page-badge
        style={{
          position: "absolute",
          bottom: 10,
          right: 12,
          fontSize: 9,
          letterSpacing: "0.06em",
          color: "var(--cv-muted)",
          opacity: 0.7,
        }}
      >
        {index + 1} / {total}
      </span>
    </div>
  );
}

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

  const { mainBlocks, sidebar } = useCvBlocks(draft, template, metrics);

  const signature = useMemo(
    () =>
      JSON.stringify({
        s: draft.sections,
        d: draft.design,
        t: draft.template,
      }),
    [draft.sections, draft.design, draft.template],
  );

  const { pages, overflowIds, measureRef } = usePagination(mainBlocks, {
    contentWidth: metrics.mainWidth,
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

  // Árvore dedicada para impressão (ver @media print em styles.css): monta um
  // portal sem escala/transform directamente no <body> só enquanto a
  // impressão está activa, e desmonta logo a seguir — nunca fica DOM extra.
  // flushSync garante que o portal já está no DOM quando o browser captura o
  // layout para imprimir (beforeprint/afterprint disparam à volta de
  // window.print(), incluindo o Ctrl+P nativo do utilizador). O bypass do
  // DOMPurify tem de estar activo ANTES do flushSync, porque é esse render
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
          width: metrics.mainWidth,
          visibility: "hidden",
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        {mainBlocks.map((b) => (
          <div key={b.id} data-block-id={b.id}>
            {b.node}
          </div>
        ))}
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
            {pages.map((blocks, i) => (
              <Page
                key={i}
                index={i}
                total={pages.length}
                blocks={blocks}
                sidebar={sidebar}
                isSidebar={isSidebar}
                metrics={metrics}
                cvStyle={cvStyle}
                overflow={blocks.some((b) => overflowIds.has(b.id))}
              />
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
            {pages.map((blocks, i) => (
              <Page
                key={i}
                index={i}
                total={pages.length}
                blocks={blocks}
                sidebar={sidebar}
                isSidebar={isSidebar}
                metrics={metrics}
                cvStyle={cvStyle}
                overflow={blocks.some((b) => overflowIds.has(b.id))}
              />
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
