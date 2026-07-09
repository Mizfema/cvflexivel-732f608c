// Layout de UMA carta de motivação: cabeçalho (nome + contactos + foto), data
// e corpo em parágrafos — sempre uma coluna, uma página. Ao contrário do CV,
// a carta não tem layouts alternativos (sidebar/competências não fazem
// sentido numa carta); o que muda por template é só o estilo do cabeçalho
// (`headerBorderStyle`, herdado de `getTemplateTheme`). Fonte, cor de acento
// e espaçamento vêm de `draft.design` — independentes do template, tal como
// no CV (ver cv-design-presets.ts `designToCssVars`).

import type { CSSProperties } from "react";
import { toSafeHtml } from "@/lib/rich-text";
import { designToCssVars } from "@/lib/cv-design-presets";
import type { CvDesign, CvPhoto } from "@/lib/cv-types";
import type { ContactItem } from "@/lib/contact-items";
import { getTemplateTheme, headerBorderStyle } from "@/lib/templates/themes";
import { pageMetrics, PAGE_H, PAGE_W, PHOTO_SIZE_HEADER_PX } from "@/lib/pagination/metrics";
import { photoFrameStyle, photoImgStyle } from "@/lib/photo-style";

const PAGE_SHADOW = "0 1px 2px rgba(15,23,42,0.06), 0 10px 30px rgba(15,23,42,0.10)";

export type CartaHeaderInfo = {
  nome: string;
  items: ContactItem[];
};

export type CartaDraft = {
  template: string;
  header: CartaHeaderInfo;
  date: string;
  content: string;
  design: CvDesign;
  photo: CvPhoto | null;
};

export function CartaDocument({ draft }: { draft: CartaDraft }) {
  const theme = getTemplateTheme(draft.template);
  const metrics = pageMetrics(draft.design, "single");
  const cssVars = designToCssVars(draft.design) as CSSProperties;

  return (
    <div
      className="cv-print-page"
      style={{
        ...cssVars,
        position: "relative",
        width: PAGE_W,
        height: PAGE_H,
        background: "white",
        boxShadow: PAGE_SHADOW,
        borderRadius: 2,
        padding: `${metrics.padY}px ${metrics.padX}px`,
        overflow: "hidden",
        fontFamily: "var(--cv-font)",
        fontSize: "var(--cv-base-size)",
        lineHeight: "var(--cv-line-height)",
        color: "var(--cv-text)",
      }}
    >
      <header
        style={{
          ...headerBorderStyle(theme.headerStyle),
          display: "flex",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          {draft.header.nome && (
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--cv-accent)" }}>
              {draft.header.nome}
            </p>
          )}
          {draft.header.items.length > 0 && (
            <p
              className="flex flex-wrap items-center gap-x-3 gap-y-1"
              style={{ margin: "4px 0 0", fontSize: 11, color: "var(--cv-muted)" }}
            >
              {draft.header.items.map((it) => {
                const Icon = it.icon;
                return (
                  <span key={it.field} className="inline-flex items-center gap-1">
                    <Icon
                      className="h-[1em] w-[1em] shrink-0"
                      style={{ color: "var(--cv-accent-soft)" }}
                    />
                    {it.text}
                  </span>
                );
              })}
            </p>
          )}
        </div>
        {draft.photo && (
          <div style={photoFrameStyle(PHOTO_SIZE_HEADER_PX)}>
            <img src={draft.photo.url} alt="" style={photoImgStyle(draft.photo)} />
          </div>
        )}
      </header>

      {draft.date && (
        <p style={{ margin: "var(--cv-section-gap) 0 0", fontSize: 11, color: "var(--cv-muted)" }}>
          {draft.date}
        </p>
      )}

      <div
        className="prose-cv carta-body"
        style={{ marginTop: "var(--cv-section-gap)" }}
        dangerouslySetInnerHTML={{ __html: toSafeHtml(draft.content) }}
      />
    </div>
  );
}
