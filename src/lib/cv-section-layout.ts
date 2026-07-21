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

  return { order, placement };
}

/** Conveniência para o render: chaves de cada zona, já na ordem final. */
export function keysByZone(layout: ResolvedLayout) {
  const main = layout.order.filter((k) => layout.placement[k] !== "sidebar");
  const sidebar = layout.order.filter((k) => layout.placement[k] === "sidebar");
  return { main, sidebar };
}
