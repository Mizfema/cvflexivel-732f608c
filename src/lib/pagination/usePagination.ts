// Mede a altura real de cada bloco (num container fora do ecrã, à largura útil da
// página) e distribui-os por páginas com um algoritmo greedy. Recalcula quando o
// conteúdo/design mudam e via ResizeObserver quando as alturas mudam (ex.: fonts).

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { CvBlock } from "./types";
import { paginate, paginateTwoColumns } from "./paginate";

// useLayoutEffect no servidor emite warning; no SSR degradamos para useEffect.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function usePagination(
  blocks: CvBlock[],
  opts: {
    contentWidth: number;
    contentHeight: number;
    signature: string;
    sidebarBlocks?: CvBlock[];
    sidebarContentHeight?: number;
    firstPageSidebarContentHeight?: number;
    /** Fase F: chaves de secções com quebra de página manual. */
    pageBreakBefore?: Set<string>;
  },
) {
  const {
    contentWidth,
    contentHeight,
    signature,
    sidebarBlocks,
    sidebarContentHeight,
    firstPageSidebarContentHeight,
    pageBreakBefore,
  } = opts;
  const measureRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<CvBlock[][] | null>(null);
  const [overflowIds, setOverflowIds] = useState<Set<string>>(new Set());
  const [twoColumnPages, setTwoColumnPages] = useState<Array<{
    main: CvBlock[];
    sidebar: CvBlock[];
  }> | null>(null);

  const recompute = useCallback(() => {
    const container = measureRef.current;
    if (!container) return;
    const heights = new Map<string, number>();
    container
      .querySelectorAll<HTMLElement>("[data-block-id]")
      .forEach((n) => {
        const id = n.dataset.blockId;
        if (id) heights.set(id, n.offsetHeight);
      });

    if (sidebarBlocks && sidebarBlocks.length > 0) {
      // Cabeçalho fixo da sidebar (foto + nome + Informações pessoais, ver
      // useCvBlocks/CvPagedPreview): quando presente no mesmo container de
      // medição (atributo data-sidebar-header-id), a página 1 tem menos
      // altura útil disponível para os blocos pagináveis da SIDEBAR, porque
      // o cabeçalho ocupa esse espaço dentro do próprio <aside> (ver
      // CVDocument.tsx). A coluna principal é uma irmã de flexbox do
      // <aside> e começa sempre no topo da página — não perde altura por
      // causa do cabeçalho da sidebar. Resolvido aqui (em vez de exigir que
      // o chamador pré-calcule e passe as alturas da página 1) para evitar
      // duplicar a medição.
      const headerEl = container.querySelector<HTMLElement>(
        "[data-sidebar-header-id]",
      );
      const sidebarHeaderHeight = headerEl?.offsetHeight ?? 0;
      const effectiveSidebarContentHeight = sidebarContentHeight ?? contentHeight;

      const result = paginateTwoColumns(
        blocks,
        sidebarBlocks,
        heights,
        contentHeight,
        effectiveSidebarContentHeight,
        (firstPageSidebarContentHeight ?? effectiveSidebarContentHeight) -
          sidebarHeaderHeight,
        contentHeight,
        pageBreakBefore,
      );
      setTwoColumnPages(result.pages);
      setPages(result.pages.map((p) => p.main));
      setOverflowIds(result.overflowIds);
    } else {
      const result = paginate(blocks, heights, contentHeight, pageBreakBefore);
      setPages(result.pages);
      setOverflowIds(result.overflowIds);
      setTwoColumnPages(null);
    }
  }, [
    blocks,
    contentHeight,
    sidebarBlocks,
    sidebarContentHeight,
    firstPageSidebarContentHeight,
    pageBreakBefore,
  ]);

  // Recalcula quando conteúdo, largura útil ou densidade mudam.
  useIsoLayoutEffect(() => {
    recompute();
  }, [recompute, contentWidth, contentHeight, signature]);

  // Recalcula (debounced) quando alturas mudam de forma assíncrona: web fonts,
  // reflow tardio, etc.
  useEffect(() => {
    const container = measureRef.current;
    if (!container) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(recompute, 150);
    };
    const ro = new ResizeObserver(schedule);
    container
      .querySelectorAll<HTMLElement>("[data-block-id], [data-sidebar-header-id]")
      .forEach((n) => ro.observe(n));
    // Fonts carregam depois do 1.º paint → altura muda.
    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(schedule).catch(() => {});
    }
    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, [recompute, signature]);

  return { pages, overflowIds, measureRef, twoColumnPages };
}
