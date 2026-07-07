// Tipos partilhados do fluxo de cartas de motivação — usados pelo stepper,
// pelo server function de geração e pelo editor de carta.

export type CoverLetterMode = "targeted" | "generic";

export type GeneratedCoverLetter = {
  content: string; // HTML restrito (p, strong, em, ul, li), ver rich-text.ts
};

export type RecentTdrOrigem = "Análise" | "Preparação de entrevista";

export type RecentTdr = {
  origem: RecentTdrOrigem;
  excerto: string;
  texto: string;
  data: string;
};
