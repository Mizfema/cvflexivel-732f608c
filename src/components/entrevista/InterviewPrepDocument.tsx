// Documento impresso/exportado da preparação de entrevista — pintado com o
// TEMA partilhado do CV/carta (getTemplateTheme: cor de acento, tipografia,
// estilo de cabeçalho), para ficar coerente com o CV e a carta do
// utilizador. A UI de preparação em ecrã (InterviewPrepResult) não muda;
// isto só existe para a exportação, montado num portal para #cv-print-root
// (mesmo mecanismo do CV/carta — ver InterviewPrepExport.tsx e styles.css).
//
// Ao contrário do CV/carta, o conteúdo pode ocupar várias páginas — por isso
// não usa a classe `.cv-print-page` (que força exactamente uma página); flui
// naturalmente pela paginação nativa do browser na impressão.

import type { CSSProperties } from "react";
import { designToCssVars, FONT_OPTIONS } from "@/lib/cv-design-presets";
import type { CvDesign } from "@/lib/cv-types";
import { getTemplateTheme, headerBorderStyle, sectionLabelClass } from "@/lib/templates/themes";
import type { InterviewQuestion, InterviewQuestionCategoria } from "@/lib/interview-types";

const CATEGORY_ORDER: InterviewQuestionCategoria[] = [
  "comportamental",
  "tecnica",
  "sobre_empresa",
  "eliminatoria",
];

const CATEGORY_LABELS: Record<InterviewQuestionCategoria, string> = {
  comportamental: "Perguntas comportamentais",
  tecnica: "Perguntas técnicas",
  sobre_empresa: "Sobre a organização",
  eliminatoria: "Requisitos eliminatórios",
};

export type InterviewPrepDraft = {
  template: string;
  jobTdr: string | null;
  questions: InterviewQuestion[];
};

function tdrFirstLine(tdr: string): string {
  const line =
    tdr
      .split("\n")
      .find((l) => l.trim())
      ?.trim() ?? "";
  return line.length > 140 ? line.slice(0, 140) + "…" : line;
}

export function InterviewPrepDocument({ draft }: { draft: InterviewPrepDraft }) {
  const theme = getTemplateTheme(draft.template);
  const font = FONT_OPTIONS[theme.fontFamily];

  const design: CvDesign = {
    fontFamily: theme.fontFamily,
    accentColor: theme.accentColor,
    spacing: { lineHeight: 1.6, itemGap: "M", sectionGap: "M", pageMargin: "M" },
    fontSize: "M",
  };
  const cssVars = designToCssVars(design) as CSSProperties;

  const grouped = CATEGORY_ORDER.map((categoria) => ({
    categoria,
    items: draft.questions.filter((q) => q.categoria === categoria),
  })).filter((g) => g.items.length > 0);

  const tdrLine = draft.jobTdr ? tdrFirstLine(draft.jobTdr) : "";

  return (
    <div
      style={{
        ...cssVars,
        width: "210mm",
        margin: "0 auto",
        padding: "22mm 24mm",
        fontFamily: font.family,
        fontSize: 12.5,
        lineHeight: 1.6,
        color: "var(--cv-text)",
      }}
    >
      <header style={headerBorderStyle(theme.headerStyle)}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--cv-accent)" }}>
          Preparação de Entrevista
        </p>
        {tdrLine && (
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--cv-muted)" }}>{tdrLine}</p>
        )}
      </header>

      {grouped.map(({ categoria, items }) => (
        <section key={categoria} style={{ marginTop: "var(--cv-section-gap)" }}>
          <h2
            className={sectionLabelClass(theme.headerStyle)}
            style={{ color: "var(--cv-accent)", borderColor: "var(--cv-rule)" }}
          >
            {CATEGORY_LABELS[categoria]}
          </h2>
          <div style={{ marginTop: 8 }}>
            {items.map((q, i) => (
              <div
                key={i}
                style={{
                  marginTop: i === 0 ? 0 : "var(--cv-item-gap)",
                  breakInside: "avoid",
                }}
              >
                <p style={{ margin: 0, fontWeight: 600, color: "var(--cv-text)" }}>{q.pergunta}</p>
                <p style={{ margin: "4px 0 0", color: "var(--cv-text)", whiteSpace: "pre-line" }}>
                  {q.resposta_sugerida}
                </p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
