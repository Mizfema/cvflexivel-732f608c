import type { CSSProperties } from "react";
import type { CvPhoto } from "@/lib/cv-types";

/**
 * Estilo do frame (círculo) e da <img> para uma CvPhoto, dado um tamanho em
 * px. Usado em todos os pontos de render (widget de ajuste, cabeçalho do CV,
 * sidebar, carta, miniaturas, impressão) — a MESMA fórmula em todo o lado
 * garante que o widget de ajuste é WYSIWYG face ao render final.
 */
export function photoFrameStyle(size: number): CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: "50%",
    overflow: "hidden",
    flexShrink: 0,
    position: "relative",
    background: "var(--cv-rule, #e5e1d8)",
  };
}

export function photoImgStyle(photo: CvPhoto): CSSProperties {
  return {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: `scale(${photo.zoom}) translate(${photo.offsetX}%, ${photo.offsetY}%)`,
    transformOrigin: "center",
  };
}
