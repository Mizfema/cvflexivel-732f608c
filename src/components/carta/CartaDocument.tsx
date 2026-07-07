// Layout de UMA carta de motivação: cabeçalho (nome + contactos), data e
// corpo em parágrafos — sempre uma coluna, uma página. Ao contrário do CV,
// a carta não tem layouts alternativos (sidebar/competências não fazem
// sentido numa carta); o que muda por template é só o TEMA visual herdado de
// `getTemplateTheme` (cor de acento, tipografia, estilo do cabeçalho), para
// combinar com o CV do mesmo template.

import type { CSSProperties } from "react";
import { toSafeHtml } from "@/lib/rich-text";
import { FONT_OPTIONS } from "@/lib/cv-design-presets";
import { getTemplateTheme, headerBorderStyle } from "@/lib/templates/themes";
import { PAGE_H, PAGE_W } from "@/lib/pagination/metrics";

const PAGE_SHADOW = "0 1px 2px rgba(15,23,42,0.06), 0 10px 30px rgba(15,23,42,0.10)";

/** Margens fixas (px @96dpi) — equivalem a ~28mm/30mm, sem depender de `design.spacing` (a carta não tem um). */
const PAD_X = 106;
const PAD_Y = 114;

export type CartaHeaderInfo = {
  nome: string;
  linhas: string[];
};

export type CartaDraft = {
  template: string;
  header: CartaHeaderInfo;
  date: string;
  content: string;
};

export function CartaDocument({ draft }: { draft: CartaDraft }) {
  const theme = getTemplateTheme(draft.template);
  const font = FONT_OPTIONS[theme.fontFamily];

  const themeStyle = {
    "--cv-accent": theme.accentColor,
    "--cv-muted": "#6b675f",
  } as CSSProperties;

  return (
    <div
      className="cv-print-page"
      style={{
        ...themeStyle,
        position: "relative",
        width: PAGE_W,
        height: PAGE_H,
        background: "white",
        boxShadow: PAGE_SHADOW,
        borderRadius: 2,
        padding: `${PAD_Y}px ${PAD_X}px`,
        overflow: "hidden",
        fontFamily: font.family,
        fontSize: 13,
        lineHeight: 1.7,
        color: "#1a1a17",
      }}
    >
      <header style={headerBorderStyle(theme.headerStyle)}>
        {draft.header.nome && (
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--cv-accent)" }}>
            {draft.header.nome}
          </p>
        )}
        {draft.header.linhas.length > 0 && (
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--cv-muted)" }}>
            {draft.header.linhas.join(" · ")}
          </p>
        )}
      </header>

      {draft.date && (
        <p style={{ margin: "28px 0 0", fontSize: 11, color: "var(--cv-muted)" }}>{draft.date}</p>
      )}

      <div
        className="prose-cv"
        style={{ marginTop: 28 }}
        dangerouslySetInnerHTML={{ __html: toSafeHtml(draft.content) }}
      />
    </div>
  );
}
