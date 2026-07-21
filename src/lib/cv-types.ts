// Tipos partilhados do CV — usados pelo editor, preview, draft local e Supabase.

export type CvExperience = {
  id: string;
  cargo: string;
  organizacao: string;
  local?: string;
  inicio?: string; // "2023-01"
  fim?: string; // "2024-06" ou "atual"
  descricao?: string;
};

export type CvFormacao = {
  id: string;
  curso: string;
  instituicao: string;
  local?: string;
  inicio?: string;
  fim?: string;
  descricao?: string;
};

export type CvCompetencia = {
  id: string;
  nome: string;
  nivel?: "basico" | "intermedio" | "avancado" | "especialista";
};

export type CvIdioma = {
  id: string;
  idioma: string;
  nivel?: "basico" | "intermedio" | "avancado" | "fluente" | "nativo";
};

export type CvSecaoExtra = {
  id: string;
  tipo: "cursos" | "estagios" | "certificados" | "realizacoes" | "atividades" | "qualidades";
  titulo: string;
  itens: Array<{ id: string; titulo: string; descricao?: string; data?: string }>;
};

/** Foto do candidato: imagem original + ajuste de zoom/posição (nunca recortada em pixels). */
export type CvPhoto = {
  url: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
};

export type CvSections = {
  perfil: {
    nome: string;
    headline: string;
    email: string;
    telefone: string;
    cidade: string;
    pais: string;
    linkedin?: string;
    website?: string;
    morada?: string;
    cartaConducao?: string;
    dataNascimento?: string;
    genero?: string;
    estadoCivil?: string;
    foto?: CvPhoto | null;
    resumo?: string; // rich text leve
  };
  experiencia: CvExperience[];
  formacao: CvFormacao[];
  competencias: CvCompetencia[];
  idiomas: CvIdioma[];
  extras: CvSecaoExtra[];
};

export type SpacingSize = "S" | "M" | "L";

export type CvSpacing = {
  lineHeight: number; // 1.0–1.6, passo 0.05
  itemGap: SpacingSize;
  sectionGap: SpacingSize;
  pageMargin: SpacingSize;
};

export type CvDesign = {
  fontFamily: string;
  accentColor: string;
  spacing: CvSpacing;
};

export type FixedSectionKey =
  | "perfil"
  | "experiencia"
  | "formacao"
  | "competencias"
  | "idiomas";
export type SectionKey = FixedSectionKey | `extra:${string}`;
export type SectionZone = "main" | "sidebar";
export type CvSectionLayout = {
  order: string[];
  placement: Record<string, SectionZone>;
};

export type CvDraft = {
  title: string;
  sections: CvSections;
  template: string;
  design: CvDesign;
  sectionLayout?: CvSectionLayout | null;
  updatedAt: string;
};

// Alterações feitas pelo alinhamento CV ↔ TdR

export type AlignmentChangeType = "reformulado" | "recontextualizado";

export type AlignmentChange = {
  tipo: AlignmentChangeType;
  campo: string;
  de: string;
  para: string;
  justificacao: string;
};

export type AlignmentResult = {
  sections: CvSections;
  alteracoes: AlignmentChange[];
};

export const EMPTY_CV: CvDraft = {
  title: "CV sem título",
  sections: {
    perfil: {
      nome: "",
      headline: "",
      email: "",
      telefone: "",
      cidade: "",
      pais: "Moçambique",
      morada: "",
      cartaConducao: "",
      foto: null,
    },
    experiencia: [],
    formacao: [],
    competencias: [],
    idiomas: [],
    extras: [],
  },
  template: "classico",
  design: {
    fontFamily: "inter",
    accentColor: "#1e3a5f",
    spacing: { lineHeight: 1.55, itemGap: "M", sectionGap: "M", pageMargin: "M" },
  },
  updatedAt: new Date(0).toISOString(),
};
