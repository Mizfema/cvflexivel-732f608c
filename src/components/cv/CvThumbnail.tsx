// Miniatura de um CV para a grelha "Os meus CVs": renderiza o CVDocument real
// (página 1, sem paginação) numa folha A4 de tamanho fixo, reduzida por
// transform: scale + transform-origin: top left, dentro de um contentor com
// overflow:hidden que define o tamanho final da miniatura. Não usa o motor de
// paginação (usePagination/ResizeObserver) — é um snapshot estático, por isso
// não recalcula layout, o que importa quando há muitos cartões na grelha.

import { useEffect } from "react";
import type { CSSProperties } from "react";
import type { CvDraft } from "@/lib/cv-types";
import { designToCssVars, getTemplate, type FontId } from "@/lib/cv-design-presets";
import { ensureGoogleFont } from "@/lib/google-fonts";
import { useCvBlocks } from "@/lib/pagination/useCvBlocks";
import { PAGE_H, PAGE_W, pageMetrics } from "@/lib/pagination/metrics";
import { CVDocument } from "@/components/cv/CVDocument";

export const THUMB_W = 220;
const THUMB_SCALE = THUMB_W / PAGE_W;
export const THUMB_H = Math.round(PAGE_H * THUMB_SCALE);

export function CvThumbnail({ draft }: { draft: CvDraft }) {
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

  const { mainBlocks, sidebarHeader, sidebarBlocks } = useCvBlocks(draft, template, metrics);

  return (
    <div
      aria-hidden
      style={{
        width: THUMB_W,
        height: THUMB_H,
        overflow: "hidden",
        position: "relative",
        background: "white",
      }}
    >
      <div
        style={{
          width: PAGE_W,
          height: PAGE_H,
          transform: `scale(${THUMB_SCALE})`,
          transformOrigin: "top left",
        }}
      >
        <CVDocument
          blocks={mainBlocks}
          sidebarHeader={sidebarHeader}
          sidebarContent={sidebarBlocks}
          isSidebar={isSidebar}
          metrics={metrics}
          cvStyle={cvStyle}
          accentSurface={template.accentSurface}
        />
      </div>
    </div>
  );
}
