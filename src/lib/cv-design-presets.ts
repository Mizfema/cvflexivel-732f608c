// Presets visuais do CV. Aplicados via CSS variables na preview.

import type { CvDesign, CvFontSize, CvSpacing, SpacingSize } from "./cv-types";

export type TemplateId =
  | "classico"
  | "moderno"
  | "compacto"
  | "visual-sidebar"
  | "executivo"
  | "editorial"
  | "contraste"
  | "retrato"
  | "destaque"
  | "direto"
  | "detalhado"
  | "institucional"
  | "arco";

export type TemplateInfo = {
  id: TemplateId;
  nome: string;
  tipo: "ats" | "visual";
  descricao: string;
  layout: "single" | "sidebar";
  headerStyle: "underline" | "accent" | "minimal" | "banner";
  /**
   * Onde a cor de acento vira fundo sólido (em vez de só texto/borda).
   * "sidebar-block" difere de "sidebar": só a foto + informações pessoais
   * ficam num bloco de cor sólida com bleed até à borda da página — o resto
   * da sidebar (competências, secções extra) fica no fundo branco normal.
   */
  accentSurface?: "sidebar" | "header" | "sidebar-block" | "sidebar-hero";
  /** Tamanho (px) do círculo de foto na sidebar; substitui PHOTO_SIZE_SIDEBAR_PX. */
  photoSizeSidebar?: number;
  /** Envolve o bloco de contactos da sidebar num título "Informações pessoais". */
  personalInfoTitle?: boolean;
  /** Renderiza as secções extra (ex. Cursos) na sidebar em vez da coluna principal. */
  sidebarExtras?: boolean;
  isPremium: boolean;
  /** Nome vai para o topo da sidebar (suprime cabeçalho principal). */
  nameInSidebar?: boolean;
};

export const TEMPLATES: TemplateInfo[] = [
  {
    id: "classico",
    nome: "Clássico",
    tipo: "ats",
    descricao: "Uma coluna, títulos sublinhados. Legibilidade máxima.",
    layout: "single",
    headerStyle: "underline",
    isPremium: false,
  },
  {
    id: "moderno",
    nome: "Moderno",
    tipo: "ats",
    descricao: "Uma coluna, títulos com cor de acento e ícones discretos.",
    layout: "single",
    headerStyle: "accent",
    isPremium: false,
  },
  {
    id: "compacto",
    nome: "Compacto",
    tipo: "ats",
    descricao: "Uma coluna mais densa. Bom para CVs longos.",
    layout: "single",
    headerStyle: "minimal",
    isPremium: false,
  },
  {
    id: "visual-sidebar",
    nome: "Sidebar",
    tipo: "visual",
    descricao: "Sidebar com contactos e competências. Não recomendado para ATS.",
    layout: "sidebar",
    headerStyle: "accent",
    isPremium: false,
  },
  {
    id: "executivo",
    nome: "Executivo",
    tipo: "ats",
    descricao: "Sóbrio e formal, uma coluna. Indicado para cargos seniores.",
    layout: "single",
    headerStyle: "underline",
    isPremium: false,
  },
  {
    id: "editorial",
    nome: "Editorial",
    tipo: "ats",
    descricao: "Minimalista tipográfico, foco total no texto, sem elementos gráficos.",
    layout: "single",
    headerStyle: "minimal",
    isPremium: false,
  },
  {
    id: "contraste",
    nome: "Contraste",
    tipo: "visual",
    descricao: "Sidebar em bloco de cor sólida. Moderno e com impacto visual.",
    layout: "sidebar",
    headerStyle: "accent",
    accentSurface: "sidebar",
    isPremium: true,
  },
  {
    id: "retrato",
    nome: "Retrato",
    tipo: "visual",
    descricao: "Sidebar com foto em destaque. Ideal para áreas criativas e atendimento.",
    layout: "sidebar",
    headerStyle: "minimal",
    photoSizeSidebar: 132,
    isPremium: true,
  },
  {
    id: "destaque",
    nome: "Destaque",
    tipo: "visual",
    descricao: "Cabeçalho em cartão de cor cheia. Chama atenção logo no topo.",
    layout: "single",
    headerStyle: "banner",
    accentSurface: "header",
    isPremium: true,
  },
  {
    id: "direto",
    nome: "Direto",
    tipo: "ats",
    descricao: "Uma coluna direta ao ponto, com toques de cor discretos.",
    layout: "single",
    headerStyle: "accent",
    isPremium: true,
  },
  {
    id: "detalhado",
    nome: "Detalhado",
    tipo: "visual",
    descricao:
      "Sidebar em bloco de cor sólida com foto e dados pessoais completos. Ideal para vagas que pedem informação detalhada.",
    layout: "sidebar",
    headerStyle: "minimal",
    accentSurface: "sidebar-block",
    photoSizeSidebar: 110,
    personalInfoTitle: true,
    sidebarExtras: true,
    isPremium: true,
  },
  {
    id: "institucional",
    nome: "Institucional",
    tipo: "visual",
    descricao: "Barra lateral navy com nome em destaque, foto e informação pessoal.",
    layout: "sidebar",
    headerStyle: "banner",
    accentSurface: "sidebar",
    photoSizeSidebar: 112,
    personalInfoTitle: true,
    sidebarExtras: true,
    isPremium: true,
    nameInSidebar: true,
  },
  {
    id: "arco",
    nome: "Arco",
    tipo: "visual",
    descricao: "Cabeçalho navy arredondado com foto sobreposta e barra lateral azul suave.",
    layout: "sidebar",
    headerStyle: "banner",
    accentSurface: "sidebar-hero",
    photoSizeSidebar: 112,
    personalInfoTitle: true,
    sidebarExtras: true,
    isPremium: true,
    nameInSidebar: true,
  },
];

export type FontId = "inter" | "source-sans-3" | "poppins" | "ibm-plex-sans" | "lora" | "pt-serif";

export type FontOption = {
  id: FontId;
  label: string;
  family: string;
  category: "sans" | "serif";
  googleFont: { family: string; weights: number[] };
};

export const FONT_OPTIONS: Record<FontId, FontOption> = {
  inter: {
    id: "inter",
    label: "Inter",
    family: "'Inter', system-ui, sans-serif",
    category: "sans",
    googleFont: { family: "Inter", weights: [400, 500, 600, 700] },
  },
  "source-sans-3": {
    id: "source-sans-3",
    label: "Source Sans 3",
    family: "'Source Sans 3', system-ui, sans-serif",
    category: "sans",
    googleFont: { family: "Source Sans 3", weights: [400, 500, 600, 700] },
  },
  poppins: {
    id: "poppins",
    label: "Poppins",
    family: "'Poppins', system-ui, sans-serif",
    category: "sans",
    googleFont: { family: "Poppins", weights: [400, 500, 600, 700] },
  },
  "ibm-plex-sans": {
    id: "ibm-plex-sans",
    label: "IBM Plex Sans",
    family: "'IBM Plex Sans', system-ui, sans-serif",
    category: "sans",
    googleFont: { family: "IBM Plex Sans", weights: [400, 500, 600, 700] },
  },
  lora: {
    id: "lora",
    label: "Lora",
    family: "'Lora', Georgia, serif",
    category: "serif",
    googleFont: { family: "Lora", weights: [400, 500, 600, 700] },
  },
  "pt-serif": {
    id: "pt-serif",
    label: "PT Serif",
    family: "'PT Serif', Georgia, serif",
    category: "serif",
    googleFont: { family: "PT Serif", weights: [400, 700] },
  },
};

export const DEFAULT_FONT_ID: FontId = "inter";

export type AccentSwatch = { label: string; hex: string };

export const ACCENT_SWATCHES: AccentSwatch[] = [
  { label: "Teal", hex: "#1D9E75" },
  { label: "Navy", hex: "#1e3a5f" },
  { label: "Bordô", hex: "#7f1d1d" },
  { label: "Charcoal", hex: "#1f2937" },
  { label: "Slate", hex: "#475569" },
  { label: "Forest", hex: "#14532d" },
  { label: "Plum", hex: "#6b21a8" },
  { label: "Terracota", hex: "#b45309" },
];

export const ITEM_GAP_PX: Record<SpacingSize, number> = {
  S: 8,
  M: 14,
  L: 20,
};

export const SECTION_GAP_PX: Record<SpacingSize, number> = {
  S: 16,
  M: 24,
  L: 32,
};

export const PAGE_MARGIN_PX: Record<SpacingSize, number> = {
  S: 32,
  M: 48,
  L: 64,
};

export const DEFAULT_FONT_SIZE: CvFontSize = "M";

/** M mantém exactamente o tamanho actual (13px) — nenhum CV existente muda. */
export const FONT_SIZE_PX: Record<CvFontSize, number> = {
  XS: 11,
  S: 12,
  M: 13,
  L: 14,
  XL: 15,
};

/** Tons neutros fixos — já não variam por preset, só a cor de acento é livre. */
const TEXT_COLOR = "#1a1a17";
const MUTED_COLOR = "#6b675f";
const RULE_BASE = "#e5e1d8";

export function designToCssVars(design: CvDesign): Record<string, string> {
  const font = FONT_OPTIONS[design.fontFamily as FontId] ?? FONT_OPTIONS[DEFAULT_FONT_ID];
  const accent = design.accentColor;
  return {
    "--cv-font": font.family,
    "--cv-accent": accent,
    "--cv-accent-soft": `color-mix(in srgb, ${accent} 55%, white)`,
    "--cv-rule": `color-mix(in srgb, ${accent} 22%, ${RULE_BASE})`,
    "--cv-text": TEXT_COLOR,
    "--cv-muted": MUTED_COLOR,
    "--cv-line-height": String(design.spacing.lineHeight),
    "--cv-item-gap": `${ITEM_GAP_PX[design.spacing.itemGap]}px`,
    "--cv-section-gap": `${SECTION_GAP_PX[design.spacing.sectionGap]}px`,
    "--cv-base-size": `${FONT_SIZE_PX[design.fontSize] ?? FONT_SIZE_PX[DEFAULT_FONT_SIZE]}px`,
  };
}

export function getTemplate(id: string): TemplateInfo {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export const DEFAULT_SPACING: CvSpacing = {
  lineHeight: 1.55,
  itemGap: "M",
  sectionGap: "M",
  pageMargin: "M",
};

/** Correspondência com as antigas paletas (F10 e anteriores) só para migrar CVs já guardados. */
const LEGACY_PALETA_ACCENT: Record<string, string> = {
  ardosia: "#334155",
  marinho: "#1e3a5f",
  esmeralda: "#065f46",
  bordeaux: "#7f1d1d",
  grafite: "#1f2937",
};

/** Correspondência com as antigas fontes (F10 e anteriores) só para migrar CVs já guardados. */
const LEGACY_FONTE_MAP: Record<string, FontId> = {
  inter: "inter",
  lato: "source-sans-3",
  georgia: "pt-serif",
  "source-serif": "lora",
};

const LEGACY_DENSIDADE_SPACING: Record<string, CvSpacing> = {
  compacto: { lineHeight: 1.4, itemGap: "S", sectionGap: "S", pageMargin: "S" },
  normal: { lineHeight: 1.55, itemGap: "M", sectionGap: "M", pageMargin: "M" },
  espacoso: { lineHeight: 1.7, itemGap: "L", sectionGap: "L", pageMargin: "L" },
};

function isSpacingSize(v: unknown): v is SpacingSize {
  return v === "S" || v === "M" || v === "L";
}

function isFontSize(v: unknown): v is CvFontSize {
  return v === "XS" || v === "S" || v === "M" || v === "L" || v === "XL";
}

function normalizeSpacing(raw: unknown): CvSpacing {
  if (!raw || typeof raw !== "object") return DEFAULT_SPACING;
  const r = raw as Record<string, unknown>;
  const lineHeight =
    typeof r.lineHeight === "number" && Number.isFinite(r.lineHeight)
      ? Math.min(1.6, Math.max(1.0, r.lineHeight))
      : DEFAULT_SPACING.lineHeight;
  return {
    lineHeight,
    itemGap: isSpacingSize(r.itemGap) ? r.itemGap : DEFAULT_SPACING.itemGap,
    sectionGap: isSpacingSize(r.sectionGap) ? r.sectionGap : DEFAULT_SPACING.sectionGap,
    pageMargin: isSpacingSize(r.pageMargin) ? r.pageMargin : DEFAULT_SPACING.pageMargin,
  };
}

/**
 * Normaliza qualquer forma de `design` guardada (vazia, forma antiga
 * fonte/paleta/densidade, ou a forma nova incompleta) para a forma canónica
 * atual, preservando a aparência visual de CVs já existentes.
 */
export function normalizeCvDesign(raw: unknown): CvDesign {
  if (!raw || typeof raw !== "object") {
    return {
      fontFamily: DEFAULT_FONT_ID,
      accentColor: LEGACY_PALETA_ACCENT.marinho,
      spacing: DEFAULT_SPACING,
      fontSize: DEFAULT_FONT_SIZE,
    };
  }

  const r = raw as Record<string, unknown>;
  const isLegacy =
    typeof r.fonte === "string" || typeof r.paleta === "string" || typeof r.densidade === "string";

  if (isLegacy) {
    const fonte = typeof r.fonte === "string" ? LEGACY_FONTE_MAP[r.fonte] : undefined;
    const paletaAccent = typeof r.paleta === "string" ? LEGACY_PALETA_ACCENT[r.paleta] : undefined;
    const densidadeSpacing =
      typeof r.densidade === "string" ? LEGACY_DENSIDADE_SPACING[r.densidade] : undefined;
    return {
      fontFamily: fonte ?? DEFAULT_FONT_ID,
      accentColor: paletaAccent ?? LEGACY_PALETA_ACCENT.marinho,
      spacing: densidadeSpacing ?? DEFAULT_SPACING,
      fontSize: DEFAULT_FONT_SIZE,
    };
  }

  const fontFamily =
    typeof r.fontFamily === "string" && r.fontFamily in FONT_OPTIONS
      ? r.fontFamily
      : DEFAULT_FONT_ID;
  const accentColor =
    typeof r.accentColor === "string" && HEX_RE.test(r.accentColor)
      ? r.accentColor
      : LEGACY_PALETA_ACCENT.marinho;

  return {
    fontFamily,
    accentColor,
    spacing: normalizeSpacing(r.spacing),
    fontSize: isFontSize(r.fontSize) ? r.fontSize : DEFAULT_FONT_SIZE,
  };
}
