// Render puro de UMA página A4 do CV: layout single/sidebar, blocos com o
// espaçamento definido em `metrics`. Componente de apresentação, sem estado
// nem medição — extraído da preview paginada do editor (F10) para poder ser
// reutilizado também nas miniaturas da grelha "Os meus CVs".

import type { CSSProperties, ReactNode } from "react";
import type { CvBlock } from "@/lib/pagination/types";
import type { PageMetrics } from "@/lib/pagination/metrics";
import { PAGE_H, PAGE_W, SIDEBAR_GAP, SIDEBAR_W } from "@/lib/pagination/metrics";

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

export function CVDocument({
  blocks,
  sidebarHeader,
  sidebarContent,
  isSidebar,
  metrics,
  cvStyle,
  pageLabel = null,
  overflow = false,
  accentSurface,
}: {
  blocks: CvBlock[];
  /** Cabeçalho fixo da sidebar (foto + nome + Informações pessoais) — só
   *  desenhado quando presente, normalmente só na página 1. */
  sidebarHeader: ReactNode | null;
  /** Blocos pagináveis da sidebar para ESTA página; null/vazio quando não há
   *  conteúdo paginável nesta página. */
  sidebarContent: CvBlock[] | null;
  isSidebar: boolean;
  metrics: PageMetrics;
  cvStyle: CSSProperties;
  /** Texto do badge "N / total" no canto inferior; omitido quando null. */
  pageLabel?: string | null;
  overflow?: boolean;
  /** Onde a cor de acento vira fundo sólido (ver TemplateInfo.accentSurface). */
  accentSurface?: "sidebar" | "header" | "sidebar-block" | "sidebar-hero";
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
        overflow: "hidden",
      }}
    >
      {isSidebar ? (
        <div style={{ display: "flex", gap: SIDEBAR_GAP, height: "100%" }}>
          <aside
            style={
              accentSurface === "sidebar"
                ? {
                    width: SIDEBAR_W,
                    flexShrink: 0,
                    background: "var(--cv-accent)",
                    color: "#fff",
                    WebkitPrintColorAdjust: "exact",
                    printColorAdjust: "exact",
                    margin: `-${metrics.padY}px 0 -${metrics.padY}px -${metrics.padX}px`,
                    padding: `${metrics.padY}px 20px ${metrics.padY}px ${metrics.padX}px`,
                  }
                : accentSurface === "sidebar-hero"
                  ? {
                      width: SIDEBAR_W,
                      flexShrink: 0,
                      background: "color-mix(in srgb, var(--cv-accent) 8%, #ffffff)",
                      WebkitPrintColorAdjust: "exact",
                      printColorAdjust: "exact",
                      margin: `-${metrics.padY}px 0 -${metrics.padY}px -${metrics.padX}px`,
                      padding: `${metrics.padY}px 20px ${metrics.padY}px ${metrics.padX}px`,
                    }
                  : {
                      width: SIDEBAR_W,
                      flexShrink: 0,
                      paddingRight: 20,
                      borderRight:
                        accentSurface === "sidebar-block" ? "none" : "1px solid var(--cv-rule)",
                    }
            }
          >
            {sidebarHeader}
            {sidebarContent && sidebarContent.length > 0 && (
              <div style={{ marginTop: sidebarHeader ? metrics.sectionGap : 0 }}>
                <BlockList blocks={sidebarContent} />
              </div>
            )}
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

      {pageLabel && (
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
          {pageLabel}
        </span>
      )}
    </div>
  );
}
