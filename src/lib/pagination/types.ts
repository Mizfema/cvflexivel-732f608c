// Motor de paginação da preview do CV (fase F10).
// Um "bloco" é a unidade indivisível de paginação: cabeçalho, título de secção,
// item (experiência, formação, …) ou bloco de sidebar.

import type { ReactNode } from "react";

export type BlockKind =
  | "header"
  | "section-title"
  | "item"
  | "sidebar-block"
  | "sidebar-header"
  | "sidebar-item";

export type CvBlock = {
  /** Estável entre recomputações — usado como key React e chave de medição. */
  id: string;
  kind: BlockKind;
  /** Secção lógica a que pertence (ex.: "experiencia", "header", "perfil"). */
  sectionId: string;
  /** Espaço vertical (px) que precede o bloco quando NÃO é o 1.º da página. */
  marginBefore: number;
  node: ReactNode;
};

export type PaginationResult = {
  /** Blocos distribuídos por página, na ordem original. */
  pages: CvBlock[][];
  /** Ids de blocos maiores que uma página inteira (overflow, aviso visual). */
  overflowIds: Set<string>;
};

export type TwoColumnPaginationResult = {
  /** Uma entrada por página; cada página tem os blocos da coluna
   *  principal e os blocos da sidebar que devem aparecer nessa página. */
  pages: Array<{ main: CvBlock[]; sidebar: CvBlock[] }>;
  /** Blocos que, individualmente, são maiores que a página inteira
   *  (em qualquer das duas colunas). */
  overflowIds: Set<string>;
};
