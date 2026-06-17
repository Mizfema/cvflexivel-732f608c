// Tipos partilhados da análise de cobertura — usados pelo server function e UI.

export type CoverageScore = 0 | 1 | 2 | 3; // 0 = ausente, 3 = totalmente coberto

export type SectionCoverage = {
  secao: string;
  score: CoverageScore;
  presentes: string[];
  emFalta: string[];
};

export type EliminatorioNaoCumprido = {
  requisito: string;
  mitigacao: string;
};

export type CoverageAnalysis = {
  resumo: string;
  cobertura: SectionCoverage[];
  keywords: {
    presentes: string[];
    emFalta: string[];
  };
  requisitosEliminatoriosNaoCumpridos: EliminatorioNaoCumprido[];
  totalRequisitos: number;
  requisitosCobertos: number;
};
