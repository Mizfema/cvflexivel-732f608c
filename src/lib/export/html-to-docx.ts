// Converte o HTML restrito dos campos de texto rico do CV (F9: apenas
// p, br, ul, ol, li, strong, em, u, e text-align inline nos parágrafos)
// em parágrafos docx. Não faz parsing genérico de HTML — só entende o
// subconjunto que o RichTextField consegue produzir.
import { AlignmentType, Paragraph, TextRun } from "docx";
import { toSafeHtml } from "../rich-text";

export const BULLET_LIST_REFERENCE = "bullets";
export const NUMBER_LIST_REFERENCE = "numbers";

type Marks = { bold?: boolean; italics?: boolean; underline?: boolean };

function textRunsFromNode(node: ChildNode, marks: Marks): TextRun[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    if (!text) return [];
    return [
      new TextRun({
        text,
        bold: marks.bold,
        italics: marks.italics,
        underline: marks.underline ? {} : undefined,
      }),
    ];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (tag === "br") return [new TextRun({ text: "", break: 1 })];

  const nextMarks: Marks = {
    bold: marks.bold || tag === "strong" || tag === "b",
    italics: marks.italics || tag === "em" || tag === "i",
    underline: marks.underline || tag === "u",
  };
  const runs: TextRun[] = [];
  el.childNodes.forEach((child) => runs.push(...textRunsFromNode(child, nextMarks)));
  return runs;
}

function alignmentFromStyle(el: Element) {
  const style = el.getAttribute("style") ?? "";
  const match = style.match(/text-align:\s*(left|center|right|justify)/i);
  switch (match?.[1]?.toLowerCase()) {
    case "center":
      return AlignmentType.CENTER;
    case "right":
      return AlignmentType.RIGHT;
    case "justify":
      return AlignmentType.JUSTIFIED;
    case "left":
      return AlignmentType.LEFT;
    default:
      return undefined;
  }
}

/**
 * Converte o HTML restrito de um campo de CV em parágrafos docx, aplicando
 * o estilo nomeado indicado (por omissão "CVBody") e as listas nativas
 * "bullets"/"numbers" definidas no Document pelo docx-builder.
 */
export function htmlToDocxParagraphs(html: string | undefined, style = "CVBody"): Paragraph[] {
  const safe = toSafeHtml(html);
  if (!safe) return [];
  const doc = new DOMParser().parseFromString(`<body>${safe}</body>`, "text/html");
  const paragraphs: Paragraph[] = [];

  doc.body.childNodes.forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (tag === "p") {
      const runs = textRunsFromNode(el, {});
      if (runs.length === 0) return;
      paragraphs.push(new Paragraph({ style, alignment: alignmentFromStyle(el), children: runs }));
    } else if (tag === "ul" || tag === "ol") {
      const reference = tag === "ul" ? BULLET_LIST_REFERENCE : NUMBER_LIST_REFERENCE;
      Array.from(el.children)
        .filter((child) => child.tagName === "LI")
        .forEach((li) => {
          const runs = textRunsFromNode(li, {});
          if (runs.length === 0) return;
          paragraphs.push(
            new Paragraph({ style, numbering: { reference, level: 0 }, children: runs }),
          );
        });
    }
  });

  return paragraphs;
}
