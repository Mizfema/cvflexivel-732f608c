// Miniatura de uma carta para a grelha "Cartas de Motivação" — mesma técnica
// da miniatura do CV (CvThumbnail.tsx): folha A4 de tamanho fixo, reduzida
// por transform: scale + transform-origin: top left, dentro de um contentor
// com overflow:hidden. Sem paginação (a carta cabe sempre numa página).

import { useEffect } from "react";
import { ensureGoogleFont } from "@/lib/google-fonts";
import { getTemplateTheme } from "@/lib/templates/themes";
import { PAGE_H, PAGE_W } from "@/lib/pagination/metrics";
import { CartaDocument, type CartaDraft } from "@/components/carta/CartaDocument";

export const CARTA_THUMB_W = 220;
const THUMB_SCALE = CARTA_THUMB_W / PAGE_W;
export const CARTA_THUMB_H = Math.round(PAGE_H * THUMB_SCALE);

export function CartaThumbnail({ draft }: { draft: CartaDraft }) {
  useEffect(() => {
    ensureGoogleFont(getTemplateTheme(draft.template).fontFamily);
  }, [draft.template]);

  return (
    <div
      aria-hidden
      style={{
        width: CARTA_THUMB_W,
        height: CARTA_THUMB_H,
        overflow: "hidden",
        position: "relative",
        background: "white",
      }}
    >
      <div
        style={{
          width: PAGE_W,
          height: PAGE_H,
          transform: `scale(${THUMB_SCALE})`,
          transformOrigin: "top left",
        }}
      >
        <CartaDocument draft={draft} />
      </div>
    </div>
  );
}
