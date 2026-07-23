// Miniatura de uma preparação de entrevista para a grelha "Preparar
// Entrevista" — mesma técnica das miniaturas de CV/carta (CvThumbnail.tsx,
// CartaThumbnail.tsx): folha A4 reduzida por transform: scale, dentro de um
// contentor com overflow:hidden.
//
// Diferença deliberada em relação às outras duas: a entrevista PODE ter mais
// perguntas do que cabem numa página (ao contrário do CV/carta, que a
// miniatura assume sempre página única e nunca pagina). Por isso esta usa
// mesmo o motor de paginação real (useInterviewBlocks + usePagination, coluna
// única — ver InterviewPrepPagedPreview.tsx) para saber o que realmente cabe
// na página 1, em vez de desenhar todos os blocos de uma vez (o que
// desalinharia a miniatura de uma preparação com muitas perguntas face ao
// que sai no PDF/pré-visualização real).

import { useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import { designToCssVars, FONT_OPTIONS } from "@/lib/cv-design-presets";
import type { CvDesign } from "@/lib/cv-types";
import { getTemplateTheme } from "@/lib/templates/themes";
import { ensureGoogleFont } from "@/lib/google-fonts";
import { useInterviewBlocks } from "@/lib/pagination/useInterviewBlocks";
import { usePagination } from "@/lib/pagination/usePagination";
import { PAGE_H, PAGE_W, pageMetrics } from "@/lib/pagination/metrics";
import { CVDocument } from "@/components/cv/CVDocument";
import type { InterviewPrepDraft } from "@/lib/interview-types";

export const INTERVIEW_THUMB_W = 220;
const THUMB_SCALE = INTERVIEW_THUMB_W / PAGE_W;
export const INTERVIEW_THUMB_H = Math.round(PAGE_H * THUMB_SCALE);

export function InterviewPrepThumbnail({ draft }: { draft: InterviewPrepDraft }) {
  const theme = getTemplateTheme(draft.template);

  useEffect(() => {
    ensureGoogleFont(theme.fontFamily);
  }, [theme.fontFamily]);

  // Mesmo design derivado do tema que InterviewPrepPagedPreview usa — a
  // entrevista não tem `design` próprio guardado.
  const design: CvDesign = useMemo(
    () => ({
      fontFamily: theme.fontFamily,
      accentColor: theme.accentColor,
      spacing: { lineHeight: 1.6, itemGap: "M", sectionGap: "M", pageMargin: "M" },
      fontSize: "M",
    }),
    [theme],
  );

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

  // paginate() de coluna única — a entrevista nunca tem sidebar, por isso
  // nunca passamos sidebarBlocks aqui (ver comentário em usePagination.ts).
  const { pages, measureRef } = usePagination(blocks, {
    contentWidth: metrics.contentWidth,
    contentHeight: metrics.contentHeight,
    signature,
  });

  const firstPageBlocks = pages?.[0] ?? null;

  return (
    <div
      aria-hidden
      style={{
        width: INTERVIEW_THUMB_W,
        height: INTERVIEW_THUMB_H,
        overflow: "hidden",
        position: "relative",
        background: "white",
      }}
    >
      {/* Camada de medição — fora do ecrã, mesma técnica de
          InterviewPrepPagedPreview (sempre montada com dimensões reais). */}
      <div
        ref={measureRef}
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

      {firstPageBlocks && (
        <div
          style={{
            width: PAGE_W,
            height: PAGE_H,
            transform: `scale(${THUMB_SCALE})`,
            transformOrigin: "top left",
          }}
        >
          <CVDocument
            blocks={firstPageBlocks}
            sidebarHeader={null}
            sidebarContent={null}
            isSidebar={false}
            metrics={metrics}
            cvStyle={cvStyle}
          />
        </div>
      )}
    </div>
  );
}
