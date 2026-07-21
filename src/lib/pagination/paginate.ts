// Distribuição greedy pura (sem DOM): acumula blocos até estourar a altura útil.
// - `section-title` nunca fecha uma página: se o bloco seguinte não couber, o
//   título desce com ele (regra dos órfãos).
// - bloco maior que a página inteira fica sozinho e é marcado como overflow.

import type { CvBlock, PaginationResult, TwoColumnPaginationResult } from "./types";

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

// Pagina duas colunas (principal + sidebar) em paralelo, sincronizando as
// quebras de página: cada página termina assim que UMA das colunas não
// consegue encaixar mais um bloco, avançando ambos os cursores em conjunto.
// A coluna que ainda tiver espaço fica com espaço em branco por baixo — é o
// comportamento correcto (não redistribui blocos entre colunas).
export function paginateTwoColumns(
  mainBlocks: CvBlock[],
  sidebarBlocks: CvBlock[],
  heights: Map<string, number>,
  mainContentHeight: number,
  sidebarContentHeight: number,
  firstPageSidebarContentHeight: number,
  // Opcional: quando o cabeçalho fixo da sidebar é mais alto do que o topo da
  // coluna principal (templates nameInSidebar), a página 1 também precisa de
  // uma altura útil menor para a coluna principal. Por omissão mantém-se
  // igual a mainContentHeight (comportamento anterior, sem desconto).
  firstPageMainContentHeight: number = mainContentHeight,
): TwoColumnPaginationResult {
  const pages: Array<{ main: CvBlock[]; sidebar: CvBlock[] }> = [];
  const overflowIds = new Set<string>();

  // Greedy de uma única coluna, preenchendo só até encher UMA página a
  // partir de startIdx — mesma regra dos órfãos e de overflow que a
  // `paginate` acima, mas devolve o ponto onde a próxima página deve
  // retomar em vez de continuar a acumular páginas internamente.
  function fillColumn(
    blocks: CvBlock[],
    startIdx: number,
    availableHeight: number,
  ): { placed: CvBlock[]; nextIdx: number } {
    const cur: CvBlock[] = [];
    let used = 0;
    let idx = startIdx;

    while (idx < blocks.length) {
      const b = blocks[idx];
      const h = heights.get(b.id) ?? 0;

      if (h > availableHeight) {
        const orphan =
          cur.length > 0 && cur[cur.length - 1].kind === "section-title"
            ? cur.pop()!
            : null;
        if (cur.length > 0) {
          return { placed: cur, nextIdx: orphan ? idx - 1 : idx };
        }
        overflowIds.add(b.id);
        return { placed: orphan ? [orphan, b] : [b], nextIdx: idx + 1 };
      }

      const margin = cur.length === 0 ? 0 : b.marginBefore;

      if (cur.length > 0 && used + margin + h > availableHeight) {
        const orphan =
          cur[cur.length - 1].kind === "section-title" ? cur.pop()! : null;
        return { placed: cur, nextIdx: orphan ? idx - 1 : idx };
      }

      cur.push(b);
      used += margin + h;
      idx++;
    }

    return { placed: cur, nextIdx: idx };
  }

  let mainIdx = 0;
  let sideIdx = 0;
  let pageNum = 1;

  while (mainIdx < mainBlocks.length || sideIdx < sidebarBlocks.length) {
    const sidebarHeight =
      pageNum === 1 ? firstPageSidebarContentHeight : sidebarContentHeight;
    const mainHeight = pageNum === 1 ? firstPageMainContentHeight : mainContentHeight;

    const mainResult = fillColumn(mainBlocks, mainIdx, mainHeight);
    const sideResult = fillColumn(sidebarBlocks, sideIdx, sidebarHeight);

    pages.push({ main: mainResult.placed, sidebar: sideResult.placed });
    mainIdx = mainResult.nextIdx;
    sideIdx = sideResult.nextIdx;
    pageNum++;
  }

  return { pages, overflowIds };
}
