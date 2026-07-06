// Sanitização e conversão de texto rico para os campos longos do CV.
// Usado tanto no cliente (RichTextField, CvPreview) como no servidor (llm.functions, mocks).
import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = ["p", "br", "ul", "ol", "li", "strong", "em", "u"];

// Só o alinhamento de texto é permitido dentro de "style" — qualquer outra propriedade é descartada.
const ALIGN_VALUES = new Set(["left", "center", "right", "justify"]);

DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
  if (data.attrName !== "style") return;
  const match = data.attrValue.match(/text-align\s*:\s*([a-z]+)/i);
  const value = match?.[1]?.toLowerCase();
  if (value && ALIGN_VALUES.has(value)) {
    data.attrValue = `text-align: ${value}`;
  } else {
    data.keepAttr = false;
  }
});

// Alguns browsers invalidam a TrustedTypePolicy interna do DOMPurify
// precisamente durante a transição síncrona beforeprint→afterprint (ver
// CvPagedPreview.tsx), fazendo `DOMPurify.sanitize` rebentar nesse instante.
// O conteúdo que é impresso já passou por sanitizeCvHtml antes — na gravação
// (RichTextField/llm.functions) e/ou na preview em ecrã que o utilizador viu
// mesmo antes de imprimir — por isso é seguro saltar apenas nesta janela.
let printBypassActive = false;

/** Ativa/desativa o bypass do DOMPurify durante a impressão. Só chamar à
 * volta da janela beforeprint→afterprint (ver CvPagedPreview.tsx). */
export function setRichTextPrintBypass(active: boolean) {
  printBypassActive = active;
}

/** Sanitiza HTML de um campo de CV, restringindo à allowlist estrita da app. */
export function sanitizeCvHtml(html: string): string {
  if (printBypassActive) return html ?? "";
  return DOMPurify.sanitize(html ?? "", {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ["style"],
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Heurística: o valor já parece HTML (em vez de texto simples de CVs antigos)? */
export function looksLikeHtml(value: string): boolean {
  return /<\/?(p|ul|ol|li|strong|em|u|br)\b/i.test(value);
}

/**
 * Converte texto simples (CVs antigos) em HTML restrito.
 * Parágrafos por linha; linhas começadas por "- " ou "• " viram <ul><li>.
 */
export function plainTextToHtml(text: string): string {
  if (!text) return "";
  const lines = text.split(/\r?\n/);
  const blocks: string[] = [];
  let currentList: string[] = [];

  const flushList = () => {
    if (currentList.length === 0) return;
    blocks.push(`<ul>${currentList.map((li) => `<li>${escapeHtml(li)}</li>`).join("")}</ul>`);
    currentList = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }
    const bulletMatch = line.match(/^[-•]\s+(.*)/);
    if (bulletMatch) {
      currentList.push(bulletMatch[1]);
    } else {
      flushList();
      blocks.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  flushList();
  return blocks.join("");
}

/** Insere uma sugestão de IA (frase simples) como novo <li> no fim da lista existente, ou cria uma nova <ul>. */
export function appendSuggestionBullet(html: string, suggestion: string): string {
  const li = `<li>${escapeHtml(suggestion.trim())}</li>`;
  const current = toSafeHtml(html);
  if (!current) return sanitizeCvHtml(`<ul>${li}</ul>`);
  if (/<\/ul>\s*$/i.test(current)) {
    return sanitizeCvHtml(current.replace(/<\/ul>\s*$/i, `${li}</ul>`));
  }
  return sanitizeCvHtml(`${current}<ul>${li}</ul>`);
}

/** Forma canónica e segura para guardar/renderizar: converte texto antigo e sanitiza sempre. */
export function toSafeHtml(value: string | undefined | null): string {
  if (!value) return "";
  const html = looksLikeHtml(value) ? value : plainTextToHtml(value);
  return sanitizeCvHtml(html);
}

/** Extrai texto simples de um campo (HTML ou texto antigo) — usado para prompts de IA. */
export function htmlToPlainText(value: string | undefined | null): string {
  if (!value) return "";
  const html = toSafeHtml(value);
  return html
    .replace(/<li>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
