// Tokens de tema visual partilhados entre o CV e a Carta de Apresentação.
// Cada template (Clássico, Moderno, Compacto, Sidebar) representa um TEMA
// (tipografia + estilo de cabeçalho), não um layout: o CV usa o layout do seu
// template (coluna única ou sidebar); a carta usa sempre o seu próprio layout
// de carta (cabeçalho, data, corpo), só pintado com o tema escolhido.
//
// `headerStyle` já existia por template em cv-design-presets.ts (usado no
// render do CV) — aqui é só reexposto para não duplicar a fonte da verdade.
// `accentColor`/`fontFamily` são novos: no CV essas propriedades continuam
// livres via `design` (não mudam); na carta, que não tem um `design`
// próprio, o template escolhido define-as por omissão.

import {
  DEFAULT_FONT_SIZE,
  DEFAULT_SPACING,
  TEMPLATE_REDIRECTS,
  TEMPLATES,
  type FontId,
  type TemplateId,
} from "@/lib/cv-design-presets";
import type { CvDesign } from "@/lib/cv-types";

export type HeaderStyle = "underline" | "accent" | "minimal" | "banner";

export type TemplateTheme = {
  id: TemplateId;
  nome: string;
  headerStyle: HeaderStyle;
  accentColor: string;
  fontFamily: FontId;
  layout: "single" | "sidebar";
  accentSurface?: "sidebar" | "header" | "sidebar-block" | "sidebar-hero";
  personalInfoTitle?: boolean;
  isPremium: boolean;
};

const THEME_DEFAULTS: Record<TemplateId, { accentColor: string; fontFamily: FontId }> = {
  classico: { accentColor: "#1e3a5f", fontFamily: "pt-serif" },
  contraste: { accentColor: "#1D9E75", fontFamily: "poppins" },
  retrato: { accentColor: "#7f1d1d", fontFamily: "ibm-plex-sans" },
  destaque: { accentColor: "#6b21a8", fontFamily: "inter" },
  institucional: { accentColor: "#24425f", fontFamily: "inter" },
  arco: { accentColor: "#24425f", fontFamily: "inter" },
};

export const TEMPLATE_THEMES: TemplateTheme[] = TEMPLATES.map((t) => ({
  id: t.id,
  nome: t.nome,
  headerStyle: t.headerStyle,
  layout: t.layout,
  accentSurface: t.accentSurface,
  personalInfoTitle: t.personalInfoTitle,
  isPremium: t.isPremium,
  ...THEME_DEFAULTS[t.id],
}));

export function getTemplateTheme(id: string): TemplateTheme {
  const direct = TEMPLATE_THEMES.find((t) => t.id === id);
  if (direct) return direct;
  const redirected = TEMPLATE_REDIRECTS[id];
  return TEMPLATE_THEMES.find((t) => t.id === redirected) ?? TEMPLATE_THEMES[0];
}

/**
 * Design por omissão para uma carta nova (ou uma carta antiga sem `design`
 * guardado): herda a cor/fonte do tema do template. Depois de escolhido,
 * o design fica independente do template, tal como no CV.
 */
export function defaultDesignForTemplate(id: string): CvDesign {
  const theme = getTemplateTheme(id);
  return {
    fontFamily: theme.fontFamily,
    accentColor: theme.accentColor,
    spacing: DEFAULT_SPACING,
    fontSize: DEFAULT_FONT_SIZE,
  };
}

/** Classe do rótulo de secção (ex.: "Experiência"), conforme o tema. */
export function sectionLabelClass(headerStyle: HeaderStyle): string {
  return headerStyle === "underline"
    ? "border-b pb-1 text-[10px] font-semibold uppercase tracking-[0.2em]"
    : headerStyle === "accent" || headerStyle === "banner"
      ? "text-[10px] font-semibold uppercase tracking-[0.22em]"
      : "text-[10px] font-medium uppercase tracking-[0.18em]";
}

/** Estilo do cabeçalho principal (borda sob o nome), conforme o tema. */
export function headerBorderStyle(headerStyle: HeaderStyle): {
  borderBottom: string;
  paddingBottom: string;
} {
  return {
    borderBottom: headerStyle === "underline" ? "2px solid var(--cv-accent)" : "none",
    paddingBottom: headerStyle === "underline" ? "10px" : "0",
  };
}
