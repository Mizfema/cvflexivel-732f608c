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
import { paginate } from "./paginate";

// useLayoutEffect no servidor emite warning; no SSR degradamos para useEffect.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function usePagination(
  blocks: CvBlock[],
  opts: { contentWidth: number; contentHeight: number; signature: string },
) {
  const { contentWidth, contentHeight, signature } = opts;
  const measureRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<CvBlock[][] | null>(null);
  const [overflowIds, setOverflowIds] = useState<Set<string>>(new Set());

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
    const result = paginate(blocks, heights, contentHeight);
    setPages(result.pages);
    setOverflowIds(result.overflowIds);
  }, [blocks, contentHeight]);

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
      .querySelectorAll<HTMLElement>("[data-block-id]")
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

  return { pages, overflowIds, measureRef };
}
