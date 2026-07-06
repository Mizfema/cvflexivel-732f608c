// Distribuição greedy pura (sem DOM): acumula blocos até estourar a altura útil.
// - `section-title` nunca fecha uma página: se o bloco seguinte não couber, o
//   título desce com ele (regra dos órfãos).
// - bloco maior que a página inteira fica sozinho e é marcado como overflow.

import type { CvBlock, PaginationResult } from "./types";

export function paginate(
  blocks: CvBlock[],
  heights: Map<string, number>,
  contentHeight: number,
): PaginationResult {
  const pages: CvBlock[][] = [];
  const overflowIds = new Set<string>();
  let cur: CvBlock[] = [];
  let used = 0;

  const flush = () => {
    if (cur.length) {
      pages.push(cur);
      cur = [];
      used = 0;
    }
  };

  for (const b of blocks) {
    const h = heights.get(b.id) ?? 0;

    // Bloco maior que uma página: fica na sua própria página (v1 — não partir
    // ao meio). Se o bloco anterior for um título de secção, desce com ele para
    // não deixar o título órfão no fim da página anterior.
    if (h > contentHeight) {
      const orphan =
        cur.length > 0 && cur[cur.length - 1].kind === "section-title"
          ? cur.pop()!
          : null;
      flush();
      overflowIds.add(b.id);
      pages.push(orphan ? [orphan, b] : [b]);
      continue;
    }

    const margin = cur.length === 0 ? 0 : b.marginBefore;

    if (cur.length > 0 && used + margin + h > contentHeight) {
      // Não cabe: se o último bloco colocado é um título de secção, arrasta-o
      // para a página nova junto com este bloco.
      const orphan =
        cur[cur.length - 1].kind === "section-title" ? cur.pop()! : null;
      flush();
      if (orphan) {
        cur.push(orphan);
        used += heights.get(orphan.id) ?? 0;
        cur.push(b);
        used += b.marginBefore + h;
      } else {
        cur.push(b);
        used += h;
      }
    } else {
      cur.push(b);
      used += margin + h;
    }
  }
  flush();

  return { pages, overflowIds };
}
