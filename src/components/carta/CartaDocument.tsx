// Layout de UMA carta de motivação: cabeçalho (nome + contactos + foto), data
// e corpo em parágrafos — sempre uma coluna, uma página. Ao contrário do CV,
// a carta não tem layouts alternativos (sidebar/competências não fazem
// sentido numa carta); o que muda por template é só o estilo do cabeçalho
// (`headerBorderStyle`, herdado de `getTemplateTheme`). Fonte, cor de acento
// e espaçamento vêm de `draft.design` — independentes do template, tal como
// no CV (ver cv-design-presets.ts `designToCssVars`).

import type { CSSProperties } from "react";
import { User, type LucideIcon } from "lucide-react";
import { toSafeHtml } from "@/lib/rich-text";
import { designToCssVars } from "@/lib/cv-design-presets";
import type { CvDesign, CvPhoto } from "@/lib/cv-types";
import { CONTACT_ICONS, type ContactItem } from "@/lib/contact-items";
import { getTemplateTheme, headerBorderStyle } from "@/lib/templates/themes";
import {
  pageMetrics,
  PAGE_H,
  PAGE_W,
  PHOTO_SIZE_HEADER_PX,
  PHOTO_SIZE_SIDEBAR_PX,
  SIDEBAR_GAP,
  SIDEBAR_W,
} from "@/lib/pagination/metrics";
import { photoFrameStyle, photoImgStyle } from "@/lib/photo-style";

const PAGE_SHADOW = "0 1px 2px rgba(15,23,42,0.06), 0 10px 30px rgba(15,23,42,0.10)";

export type CartaHeaderInfo = {
  nome: string;
  items: ContactItem[];
  /** Só usados pelo template "Detalhado" (sidebar), ver bloco abaixo. */
  dataNascimento?: string;
  genero?: string;
  estadoCivil?: string;
};

export type CartaDraft = {
  template: string;
  header: CartaHeaderInfo;
  date: string;
  content: string;
  design: CvDesign;
  photo: CvPhoto | null;
};

function BodyContent({
  date,
  content,
  topMargin,
}: {
  date: string;
  content: string;
  topMargin: string;
}) {
  return (
    <>
      {date && (
        <p style={{ margin: `${topMargin} 0 0`, fontSize: 11, color: "var(--cv-muted)" }}>{date}</p>
      )}
      <div
        className="prose-cv carta-body"
        style={{ marginTop: date ? "var(--cv-section-gap)" : topMargin }}
        dangerouslySetInnerHTML={{ __html: toSafeHtml(content) }}
      />
    </>
  );
}

export function CartaDocument({ draft }: { draft: CartaDraft }) {
  const theme = getTemplateTheme(draft.template);
  const isSidebar = theme.layout === "sidebar";
  const metrics = pageMetrics(draft.design, theme.layout);
  const cssVars = designToCssVars(draft.design) as CSSProperties;

  const pageStyle: CSSProperties = {
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
  };

  if (isSidebar) {
    // "Detalhado": sidebar navy (foto + nome + "Informações pessoais") à
    // esquerda, corpo da carta à direita — mesmo bloco de cor sólida com
    // bleed até à borda usado pelo CV (ver useCvBlocks.tsx, accentSurface
    // "sidebar-block").
    const personalInfoItems: Array<{ field: string; icon: LucideIcon; text: string }> = [
      ...draft.header.items,
      ...(draft.header.dataNascimento
        ? [
            {
              field: "dataNascimento",
              icon: CONTACT_ICONS.dataNascimento,
              text: draft.header.dataNascimento,
            },
          ]
        : []),
      ...(draft.header.genero
        ? [{ field: "genero", icon: CONTACT_ICONS.genero, text: draft.header.genero }]
        : []),
      ...(draft.header.estadoCivil
        ? [
            {
              field: "estadoCivil",
              icon: CONTACT_ICONS.estadoCivil,
              text: draft.header.estadoCivil,
            },
          ]
        : []),
    ];

    return (
      <div className="cv-print-page" style={pageStyle}>
        <div style={{ display: "flex", gap: SIDEBAR_GAP, height: "100%" }}>
          <aside style={{ width: SIDEBAR_W, flexShrink: 0 }}>
            <div
              style={{
                background: "var(--cv-accent)",
                color: "#fff",
                margin: `-${metrics.padY}px -20px 0 -${metrics.padX}px`,
                padding: `${metrics.padY}px 20px 20px ${metrics.padX}px`,
              }}
            >
              {draft.photo && (
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <div style={photoFrameStyle(PHOTO_SIZE_SIDEBAR_PX)}>
                    <img src={draft.photo.url} alt="" style={photoImgStyle(draft.photo)} />
                  </div>
                </div>
              )}
              {draft.header.nome && (
                <p
                  style={{
                    margin: draft.photo ? "10px 0 0" : 0,
                    fontSize: 14,
                    fontWeight: 700,
                    textAlign: "center",
                  }}
                >
                  {draft.header.nome}
                </p>
              )}
              {(draft.header.nome || personalInfoItems.length > 0) && (
                <div style={{ marginTop: 14 }}>
                  <h2
                    className="flex items-center gap-1.5"
                    style={{
                      margin: 0,
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                    }}
                  >
                    <User className="h-[1em] w-[1em] shrink-0" />
                    Informações pessoais
                  </h2>
                  <div className="flex flex-col gap-1.5" style={{ marginTop: 8 }}>
                    {draft.header.nome && (
                      <span className="flex items-center gap-1.5" style={{ fontSize: 11 }}>
                        <User className="h-[1em] w-[1em] shrink-0" />
                        {draft.header.nome}
                      </span>
                    )}
                    {personalInfoItems.map((it) => {
                      const Icon = it.icon;
                      return (
                        <span
                          key={it.field}
                          className="flex items-center gap-1.5"
                          style={{ fontSize: 11 }}
                        >
                          <Icon className="h-[1em] w-[1em] shrink-0" />
                          {it.text}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </aside>
          <div style={{ flex: 1, minWidth: 0 }}>
            <BodyContent date={draft.date} content={draft.content} topMargin="0" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cv-print-page" style={pageStyle}>
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

      <BodyContent date={draft.date} content={draft.content} topMargin="var(--cv-section-gap)" />
    </div>
  );
}
