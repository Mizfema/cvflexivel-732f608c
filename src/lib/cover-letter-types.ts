// Tipos partilhados do fluxo de cartas de motivação — usados pelo stepper,
// pelo server function de geração e pelo editor de carta.

import type { CvDesign, CvPhoto } from "@/lib/cv-types";

export type CoverLetterMode = "targeted" | "generic";

/** Estado editável de uma carta na sessão do editor (ver /carta-editor). */
export type CoverLetterEditorState = {
  title: string;
  content: string;
  cvId: string | null;
  jobTdr: string | null;
  template: string;
  design: CvDesign;
  /** Foto do candidato, independente do CV ligado (ver [[F17]]). */
  photo: CvPhoto | null;
};

export type GeneratedCoverLetter = {
  content: string; // HTML restrito (p, strong, em, ul, li), ver rich-text.ts
  /** true quando `content` é só a amostra grátis (Fase 1.3) — o resto nunca desceu ao cliente. */
  hasMore: boolean;
};

export type RecentTdrOrigem = "Análise" | "Preparação de entrevista";

export type RecentTdr = {
  origem: RecentTdrOrigem;
  excerto: string;
  texto: string;
  data: string;
};
