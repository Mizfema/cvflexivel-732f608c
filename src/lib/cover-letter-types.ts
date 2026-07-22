// Tipos partilhados do fluxo de cartas de motivação — usados pelo stepper,
// pelo server function de geração e pelo editor de carta.

import type { CvDesign, CvPhoto, CvSections } from "@/lib/cv-types";

export type CoverLetterMode = "targeted" | "generic";

/**
 * Campos de perfil (nome + contactos) de uma carta — os mesmos da secção
 * Perfil do CV, à excepção de `foto` (já independente via `photo`) e
 * `resumo` (não faz sentido numa carta). Derivado do tipo do CV para nunca
 * divergir da lista de campos que a secção Perfil do editor de CV expõe.
 */
export type CartaPerfilFields = Omit<CvSections["perfil"], "foto" | "resumo">;

export const EMPTY_CARTA_PERFIL: CartaPerfilFields = {
  nome: "",
  headline: "",
  email: "",
  telefone: "",
  cidade: "",
  pais: "",
  morada: "",
  cartaConducao: "",
  dataNascimento: "",
  genero: "",
  estadoCivil: "",
  linkedin: "",
  website: "",
};

/** Normaliza o `perfil` (jsonb, pode vir null/incompleto do Supabase). */
export function normalizeCartaPerfil(raw: unknown): CartaPerfilFields {
  if (!raw || typeof raw !== "object") return EMPTY_CARTA_PERFIL;
  const r = raw as Partial<CartaPerfilFields>;
  return {
    nome: r.nome ?? "",
    headline: r.headline ?? "",
    email: r.email ?? "",
    telefone: r.telefone ?? "",
    cidade: r.cidade ?? "",
    pais: r.pais ?? "",
    morada: r.morada ?? "",
    cartaConducao: r.cartaConducao ?? "",
    dataNascimento: r.dataNascimento ?? "",
    genero: r.genero ?? "",
    estadoCivil: r.estadoCivil ?? "",
    linkedin: r.linkedin ?? "",
    website: r.website ?? "",
  };
}

/** true quando nenhum campo foi preenchido — usado para decidir se ainda é
 * seguro pré-preencher a partir do CV ligado/perfil da conta sem apagar o
 * que a pessoa já escreveu nesta carta. */
export function isCartaPerfilEmpty(perfil: CartaPerfilFields): boolean {
  return Object.values(perfil).every((v) => !v);
}

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
  /** Nome + contactos, independentes do CV ligado — mesmo padrão que `photo`
   * (ver `CartaPerfilFields`). */
  perfil: CartaPerfilFields;
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
