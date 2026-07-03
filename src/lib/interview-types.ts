// Tipos partilhados da preparação de entrevista — usados pelo server function,
// pela persistência em interview_preps (coluna questions, JSONB) e pela UI.

export type InterviewQuestionCategoria =
  | "comportamental"
  | "tecnica"
  | "sobre_empresa"
  | "eliminatoria";

export type InterviewQuestion = {
  categoria: InterviewQuestionCategoria;
  pergunta: string;
  resposta_sugerida: string;
};
