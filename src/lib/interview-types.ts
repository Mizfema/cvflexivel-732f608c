// Tipos partilhados da preparação de entrevista — usados pelo server function,
// pela persistência em interview_preps (coluna questions, JSONB) e pela UI.

/** Fonte de verdade única da ordem/categorias — antes duplicada como array
 * literal em InterviewPrepResult.tsx, useInterviewBlocks.tsx e no enum de
 * interview-preps.functions.ts (Fase 3A, Passo 2). O tipo é derivado deste
 * array (em vez do inverso) para nunca poderem divergir. */
export const CATEGORY_ORDER = [
  "comportamental",
  "tecnica",
  "sobre_empresa",
  "eliminatoria",
] as const;

export type InterviewQuestionCategoria = (typeof CATEGORY_ORDER)[number];

/** Rótulos usados nos títulos de secção do documento paginado (PDF/preview) —
 * ver useInterviewBlocks.tsx. Distintos dos rótulos de UI do ecrã de
 * resultado (InterviewPrepResult.tsx tem os seus próprios, com ícone/cor
 * próprios) — não fundir os dois, para não alterar texto visível. */
export const CATEGORY_LABELS: Record<InterviewQuestionCategoria, string> = {
  comportamental: "Perguntas comportamentais",
  tecnica: "Perguntas técnicas",
  sobre_empresa: "Sobre a organização",
  eliminatoria: "Requisitos eliminatórios",
};

export type InterviewQuestion = {
  /** Fase 3A: identifica a pergunta de forma estável para reordenar (drag and
   * drop) e editar sem depender do índice no array — mesmo padrão de
   * CvExperience.id. Gerado em generateInterviewPrep (crypto.randomUUID()). */
  id: string;
  categoria: InterviewQuestionCategoria;
  pergunta: string;
  resposta_sugerida: string;
};

/** Estado editável (tema) da pré-visualização/exportação de uma preparação
 * de entrevista já gerada — ver InterviewPrepPagedPreview/InterviewPrepExport. */
export type InterviewPrepDraft = {
  template: string;
  jobTdr: string | null;
  questions: InterviewQuestion[];
};
