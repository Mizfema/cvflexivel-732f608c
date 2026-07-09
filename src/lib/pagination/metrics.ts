// Geometria da página A4 e métricas derivadas do design (espaçamento/margem).
// Toda a medição de conteúdo é feita na escala 1 (px reais); o escalonamento
// para caber no painel é puramente visual (transform: scale).

import { ITEM_GAP_PX, PAGE_MARGIN_PX, SECTION_GAP_PX } from "@/lib/cv-design-presets";
import type { CvDesign } from "@/lib/cv-types";

/** A4 a 96dpi: 210mm × 297mm. */
export const PAGE_W = 794;
export const PAGE_H = 1123;

/** Espaço visual entre páginas (na escala 1). */
export const PAGE_GAP = 24;

/** Largura da coluna lateral e do intervalo até à coluna principal. */
export const SIDEBAR_W = 200;
export const SIDEBAR_GAP = 24;

/** Espaço entre o título de secção e o seu 1.º item (equivale a `mt-2`). */
export const FIRST_ITEM_GAP = 8;

/** Tamanho (px, escala 1) do círculo de foto no cabeçalho (layout single) e na sidebar. */
export const PHOTO_SIZE_HEADER_PX = 72;
export const PHOTO_SIZE_SIDEBAR_PX = 92;

export type PageMetrics = {
  padY: number;
  padX: number;
  contentHeight: number;
  contentWidth: number;
  /** Largura útil da coluna principal (estreita em layouts de sidebar). */
  mainWidth: number;
  sectionGap: number;
  itemGap: number;
};

export function pageMetrics(design: CvDesign, layout: "single" | "sidebar"): PageMetrics {
  const pad = PAGE_MARGIN_PX[design.spacing.pageMargin];
  const contentHeight = PAGE_H - pad * 2;
  const contentWidth = PAGE_W - pad * 2;
  const mainWidth = layout === "sidebar" ? contentWidth - SIDEBAR_W - SIDEBAR_GAP : contentWidth;
  return {
    padY: pad,
    padX: pad,
    contentHeight,
    contentWidth,
    mainWidth,
    sectionGap: SECTION_GAP_PX[design.spacing.sectionGap],
    itemGap: ITEM_GAP_PX[design.spacing.itemGap],
  };
}
