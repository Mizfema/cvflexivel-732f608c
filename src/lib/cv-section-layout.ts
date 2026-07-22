// Ordenação e colocação (sidebar/principal) das secções movíveis de um CV.
//
// Regras de produto (decididas com o utilizador):
//  • O cabeçalho da sidebar — foto + nome + "Informações pessoais" — é FIXO e
//    NÃO é uma secção movível. Só se movem as secções de conteúdo abaixo.
//  • Em templates sem sidebar (layout "single"), TODAS as secções colapsam para
//    a coluna principal, mantendo a ordem definida pelo utilizador.
//  • CVs antigos (sem `sectionLayout`) recebem um default que replica o
//    comportamento atual — ou seja, não mudam de aspeto até o utilizador mexer.

import type { CvDraft, SectionZone } from "@/lib/cv-types";
import type { TemplateInfo } from "@/lib/cv-design-presets";

/** Secções fixas movíveis, na ordem canónica de fábrica. (extras entram a seguir) */
export const BASE_SECTION_ORDER = [
  "perfil",
  "experiencia",
  "formacao",
  "competencias",
  "idiomas",
] as const;

export function extraKey(id: string): string {
  return `extra:${id}`;
}
export function isExtraKey(key: string): boolean {
  return key.startsWith("extra:");
}
export function extraIdFromKey(key: string): string {
  return key.slice("extra:".length);
}

export type ResolvedLayout = {
  order: string[];
  placement: Record<string, SectionZone>;
  /** Títulos personalizados por secção (E3). */
  titles?: Record<string, string>;
  /** Chaves de secções ocultadas (E4) — dados preservados, só não renderizam. */
  hidden?: string[];
  /** Chaves de secções com quebra de página manual (Fase F). */
  pageBreakBefore?: string[];
};

/** Títulos por omissão — os mesmos textos que useCvBlocks.tsx já usava fixos
 * em cada <SectionTitle>, antes de existir personalização (E3). */
const DEFAULT_SECTION_TITLES: Record<string, string> = {
  perfil: "Perfil",
  experiencia: "Experiência profissional",
  formacao: "Formação",
  competencias: "Competências",
  idiomas: "Idiomas",
};

/**
 * Default de fábrica — o que o motor fazia antes de existir `sectionLayout`:
 * perfil/experiência/formação na principal; competências/idiomas na sidebar;
 * extras na sidebar quando o template usa `sidebarExtras`, senão na principal.
 */
export function defaultSectionLayout(draft: CvDraft, template: TemplateInfo): ResolvedLayout {
  const extraKeys = draft.sections.extras.map((e) => extraKey(e.id));
  const order = [...BASE_SECTION_ORDER, ...extraKeys];

  const isSidebar = template.layout === "sidebar";
  const extrasToSidebar = isSidebar && !!template.sidebarExtras;

  const placement: Record<string, SectionZone> = {
    perfil: "main",
    experiencia: "main",
    formacao: "main",
    competencias: isSidebar ? "sidebar" : "main",
    idiomas: isSidebar ? "sidebar" : "main",
  };
  for (const k of extraKeys) placement[k] = extrasToSidebar ? "sidebar" : "main";

  return { order, placement };
}

/**
 * Combina o layout guardado (se existir) com os dados e o template ATUAIS:
 *  • mantém a ordem escolhida pelo utilizador, mas só para secções que ainda existem;
 *  • acrescenta no fim quaisquer secções novas (ex.: uma extra criada depois);
 *  • preenche colocações em falta a partir do default;
 *  • se o template não tem sidebar, colapsa tudo para "main" (mantendo a ordem).
 *
 * É seguro chamar em qualquer draft: sem `sectionLayout`, devolve o default puro.
 */
export function resolveSectionLayout(draft: CvDraft, template: TemplateInfo): ResolvedLayout {
  const base = defaultSectionLayout(draft, template);
  const saved = draft.sectionLayout ?? null;
  const isSidebar = template.layout === "sidebar";

  const validKeys = new Set(base.order);

  let order: string[];
  let placement: Record<string, SectionZone>;

  if (saved) {
    const savedValid = saved.order.filter((k) => validKeys.has(k));
    const missing = base.order.filter((k) => !savedValid.includes(k));
    order = [...savedValid, ...missing];
    placement = {};
    for (const k of order) {
      placement[k] = saved.placement[k] ?? base.placement[k] ?? "main";
    }
  } else {
    order = base.order;
    placement = base.placement;
  }

  // Decisão de produto: sem sidebar, tudo colapsa para a principal.
  if (!isSidebar) {
    const collapsed: Record<string, SectionZone> = {};
    for (const k of order) collapsed[k] = "main";
    placement = collapsed;
  }

  // titles/hidden (E3/E4): preservados do que está guardado, filtrados às
  // chaves ainda válidas — evita lixo de uma extra entretanto apagada.
  const titles = saved?.titles
    ? Object.fromEntries(Object.entries(saved.titles).filter(([k]) => validKeys.has(k)))
    : undefined;
  const hidden = saved?.hidden?.filter((k) => validKeys.has(k));
  const pageBreakBefore = saved?.pageBreakBefore?.filter((k) => validKeys.has(k));

  return { order, placement, titles, hidden, pageBreakBefore };
}

/** Conveniência para o render: chaves de cada zona, já na ordem final, SEM as
 * chaves ocultadas (E4) — uma secção oculta não aparece em nenhuma zona. */
export function keysByZone(layout: ResolvedLayout) {
  const hidden = new Set(layout.hidden ?? []);
  const visible = layout.order.filter((k) => !hidden.has(k));
  const main = visible.filter((k) => layout.placement[k] !== "sidebar");
  const sidebar = visible.filter((k) => layout.placement[k] === "sidebar");
  return { main, sidebar };
}

/** Título efectivo de uma secção: o override em layout.titles, senão o título
 * por omissão (para extras, sec.titulo). */
export function getSectionTitle(key: string, layout: ResolvedLayout, draft: CvDraft): string {
  const override = layout.titles?.[key];
  if (override) return override;
  if (isExtraKey(key)) {
    const sec = draft.sections.extras.find((e) => e.id === extraIdFromKey(key));
    return sec?.titulo ?? "Secção";
  }
  return DEFAULT_SECTION_TITLES[key] ?? key;
}

/** true se a secção estiver oculta (E4) — dados preservados, só não renderiza. */
export function isSectionHidden(key: string, layout: ResolvedLayout): boolean {
  return !!layout.hidden?.includes(key);
}

/** true se a secção tiver quebra de página manual antes de si (Fase F). */
export function hasPageBreakBefore(key: string, layout: ResolvedLayout): boolean {
  return !!layout.pageBreakBefore?.includes(key);
}

/** Move uma única secção para "main" ou "sidebar", sem alterar `order`. Usado
 * tanto pelo cartão "Organizar secções" (ao largar noutra zona) como pelo
 * interruptor "Secção na barra lateral" no menu de três pontos de cada
 * cartão — a mesma operação, dois pontos de entrada. */
export function moveSectionToZone(
  layout: ResolvedLayout,
  key: string,
  zone: SectionZone,
): ResolvedLayout {
  return { order: layout.order, placement: { ...layout.placement, [key]: zone } };
}
