// Presets visuais do CV. Aplicados via CSS variables na preview.

import type { CvDesign } from "./cv-types";

export type FonteId = CvDesign["fonte"];
export type PaletaId = CvDesign["paleta"];
export type DensidadeId = CvDesign["densidade"];

export type TemplateId =
  | "classico"
  | "moderno"
  | "compacto"
  | "visual-sidebar";

export type TemplateInfo = {
  id: TemplateId;
  nome: string;
  tipo: "ats" | "visual";
  descricao: string;
  layout: "single" | "sidebar";
  headerStyle: "underline" | "accent" | "minimal";
};

export const TEMPLATES: TemplateInfo[] = [
  {
    id: "classico",
    nome: "Clássico",
    tipo: "ats",
    descricao: "Uma coluna, títulos sublinhados. Legibilidade máxima.",
    layout: "single",
    headerStyle: "underline",
  },
  {
    id: "moderno",
    nome: "Moderno",
    tipo: "ats",
    descricao: "Uma coluna, títulos com cor de acento. Sem ícones.",
    layout: "single",
    headerStyle: "accent",
  },
  {
    id: "compacto",
    nome: "Compacto",
    tipo: "ats",
    descricao: "Uma coluna mais densa. Bom para CVs longos.",
    layout: "single",
    headerStyle: "minimal",
  },
  {
    id: "visual-sidebar",
    nome: "Sidebar",
    tipo: "visual",
    descricao: "Sidebar com contactos e competências. Não recomendado para ATS.",
    layout: "sidebar",
    headerStyle: "accent",
  },
];

export const FONTES: Record<
  FonteId,
  { nome: string; familia: string; tipo: "sans" | "serif" }
> = {
  inter: {
    nome: "Inter",
    familia: "'Inter', system-ui, sans-serif",
    tipo: "sans",
  },
  lato: {
    nome: "Lato",
    familia: "'Lato', system-ui, sans-serif",
    tipo: "sans",
  },
  georgia: {
    nome: "Georgia",
    familia: "Georgia, 'Times New Roman', serif",
    tipo: "serif",
  },
  "source-serif": {
    nome: "Source Serif",
    familia: "'Source Serif 4', 'Source Serif Pro', Georgia, serif",
    tipo: "serif",
  },
};

export const PALETAS: Record<
  PaletaId,
  {
    nome: string;
    accent: string;
    accentSoft: string;
    rule: string;
    text: string;
    muted: string;
  }
> = {
  ardosia: {
    nome: "Ardósia",
    accent: "#334155",
    accentSoft: "#64748b",
    rule: "#cbd5e1",
    text: "#0f172a",
    muted: "#64748b",
  },
  marinho: {
    nome: "Marinho",
    accent: "#1e3a5f",
    accentSoft: "#3b5b85",
    rule: "#c8d4e3",
    text: "#0b1f3a",
    muted: "#54678a",
  },
  esmeralda: {
    nome: "Esmeralda",
    accent: "#065f46",
    accentSoft: "#0f8a6b",
    rule: "#bfe3d3",
    text: "#0a2e25",
    muted: "#4f6e63",
  },
  bordeaux: {
    nome: "Bordeaux",
    accent: "#7f1d1d",
    accentSoft: "#a23b3b",
    rule: "#e6c9c9",
    text: "#3a0e0e",
    muted: "#7a5454",
  },
  grafite: {
    nome: "Grafite",
    accent: "#1f2937",
    accentSoft: "#4b5563",
    rule: "#d1d5db",
    text: "#111827",
    muted: "#6b7280",
  },
};

export const DENSIDADES: Record<
  DensidadeId,
  {
    nome: string;
    padding: string;
    sectionGap: string;
    itemGap: string;
    lineHeight: string;
    baseSize: string;
  }
> = {
  compacto: {
    nome: "Compacto",
    padding: "32px 36px",
    sectionGap: "16px",
    itemGap: "10px",
    lineHeight: "1.4",
    baseSize: "12px",
  },
  normal: {
    nome: "Normal",
    padding: "44px 48px",
    sectionGap: "24px",
    itemGap: "14px",
    lineHeight: "1.55",
    baseSize: "13px",
  },
  espacoso: {
    nome: "Espaçoso",
    padding: "56px 56px",
    sectionGap: "32px",
    itemGap: "18px",
    lineHeight: "1.7",
    baseSize: "13.5px",
  },
};

export function designToCssVars(
  design: CvDesign,
): Record<string, string> {
  const f = FONTES[design.fonte];
  const p = PALETAS[design.paleta];
  const d = DENSIDADES[design.densidade];
  return {
    "--cv-font": f.familia,
    "--cv-accent": p.accent,
    "--cv-accent-soft": p.accentSoft,
    "--cv-rule": p.rule,
    "--cv-text": p.text,
    "--cv-muted": p.muted,
    "--cv-padding": d.padding,
    "--cv-section-gap": d.sectionGap,
    "--cv-item-gap": d.itemGap,
    "--cv-line-height": d.lineHeight,
    "--cv-base-size": d.baseSize,
  };
}

export function getTemplate(id: string): TemplateInfo {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
