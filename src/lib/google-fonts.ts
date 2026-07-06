import { FONT_OPTIONS, type FontId } from "@/lib/cv-design-presets";

const loaded = new Set<FontId>();

/** Injeta o <link> Google Fonts da fonte, uma única vez por sessão de página. */
export function ensureGoogleFont(fontId: FontId) {
  if (typeof document === "undefined") return;
  if (loaded.has(fontId)) return;
  loaded.add(fontId);

  const font = FONT_OPTIONS[fontId];
  const family = font.googleFont.family.replace(/ /g, "+");
  const weights = font.googleFont.weights.join(";");
  const href = `https://fonts.googleapis.com/css2?family=${family}:wght@${weights}&display=swap`;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

export function ensureAllGoogleFonts() {
  (Object.keys(FONT_OPTIONS) as FontId[]).forEach(ensureGoogleFont);
}
