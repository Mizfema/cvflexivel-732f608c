// Preview ao vivo da carta de motivação — mesma técnica do CV (CvPagedPreview),
// mas sem paginação/medição: a carta cabe sempre numa única página A4, por
// isso basta escalar `CartaDocument` para caber na largura do painel e, ao
// imprimir, montar uma cópia sem escala em #cv-print-root.

import { useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { setRichTextPrintBypass } from "@/lib/rich-text";
import { ensureGoogleFont } from "@/lib/google-fonts";
import type { FontId } from "@/lib/cv-design-presets";
import { PAGE_H, PAGE_W } from "@/lib/pagination/metrics";
import { CartaDocument, type CartaDraft } from "@/components/carta/CartaDocument";

export function CartaPagedPreview({
  draft,
  printable = true,
}: {
  draft: CartaDraft;
  /** Marca este container como fonte do PDF (@media print). Só uma instância deve ter isto ativo de cada vez. */
  printable?: boolean;
}) {
  useEffect(() => {
    ensureGoogleFont(draft.design.fontFamily as FontId);
  }, [draft.design.fontFamily]);

  const panelRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setScale(Math.min(1, el.clientWidth / PAGE_W));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [isPrinting, setIsPrinting] = useState(false);
  useEffect(() => {
    if (!printable) return;
    const handleBeforePrint = () => {
      setRichTextPrintBypass(true);
      flushSync(() => setIsPrinting(true));
    };
    const handleAfterPrint = () => {
      flushSync(() => setIsPrinting(false));
      setRichTextPrintBypass(false);
    };
    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [printable]);

  return (
    <div ref={panelRef} className="w-full">
      <div style={{ height: PAGE_H * scale }}>
        <div
          style={{
            width: PAGE_W,
            transformOrigin: "top left",
            transform: `scale(${scale})`,
          }}
        >
          <CartaDocument draft={draft} />
        </div>
      </div>

      {printable &&
        isPrinting &&
        createPortal(
          <div id="cv-print-root">
            <CartaDocument draft={draft} />
          </div>,
          document.body,
        )}
    </div>
  );
}
