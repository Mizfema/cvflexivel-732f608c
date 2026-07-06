import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import FileSaver from "file-saver";
const { saveAs } = FileSaver;
import type { CvDraft } from "./cv-types";
import { toSafeHtml } from "./rich-text";

function fmtPeriodo(inicio?: string, fim?: string) {
  if (!inicio && !fim) return "";
  if (inicio && fim) return `${inicio} — ${fim}`;
  return inicio || fim || "";
}

function slugify(s: string) {
  return (
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "cv"
  );
}

function sectionHeading(title: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text: title.toUpperCase(), bold: true, size: 22 })],
  });
}

function para(text: string, opts?: { bold?: boolean; size?: number }) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text, bold: opts?.bold, size: opts?.size ?? 22 }),
    ],
  });
}

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
        size: 22,
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

/** Converte o HTML restrito de um campo de CV (p, ul, ol, li, strong, em, u) em parágrafos docx. */
function htmlToParagraphs(html: string | undefined): Paragraph[] {
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
      paragraphs.push(
        new Paragraph({ spacing: { after: 60 }, alignment: alignmentFromStyle(el), children: runs }),
      );
    } else if (tag === "ul" || tag === "ol") {
      const reference = tag === "ul" ? "bullets" : "numbers";
      Array.from(el.children)
        .filter((child) => child.tagName === "LI")
        .forEach((li) => {
          const runs = textRunsFromNode(li, {});
          if (runs.length === 0) return;
          paragraphs.push(new Paragraph({ numbering: { reference, level: 0 }, children: runs }));
        });
    }
  });

  return paragraphs;
}

export async function exportCvDocx(draft: CvDraft) {
  const { perfil, experiencia, formacao, competencias, idiomas, extras } =
    draft.sections;

  const children: Paragraph[] = [];

  // Cabeçalho
  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 60 },
      children: [
        new TextRun({ text: perfil.nome || "Sem nome", bold: true, size: 36 }),
      ],
    }),
  );
  if (perfil.headline) {
    children.push(para(perfil.headline, { size: 24 }));
  }
  const contacto = [
    perfil.cidade && perfil.pais
      ? `${perfil.cidade}, ${perfil.pais}`
      : perfil.cidade || perfil.pais,
    perfil.email,
    perfil.telefone,
    perfil.linkedin,
    perfil.website,
  ]
    .filter(Boolean)
    .join(" · ");
  if (contacto) children.push(para(contacto, { size: 20 }));

  if (perfil.resumo) {
    children.push(sectionHeading("Perfil"));
    children.push(...htmlToParagraphs(perfil.resumo));
  }

  if (experiencia.length) {
    children.push(sectionHeading("Experiência profissional"));
    experiencia.forEach((e) => {
      const titulo = [e.cargo, e.organizacao].filter(Boolean).join(" · ");
      const meta = [fmtPeriodo(e.inicio, e.fim), e.local]
        .filter(Boolean)
        .join(" · ");
      children.push(para(titulo, { bold: true }));
      if (meta) children.push(para(meta, { size: 20 }));
      children.push(...htmlToParagraphs(e.descricao));
    });
  }

  if (formacao.length) {
    children.push(sectionHeading("Formação"));
    formacao.forEach((f) => {
      children.push(
        para([f.curso, f.instituicao].filter(Boolean).join(" · "), {
          bold: true,
        }),
      );
      const meta = [fmtPeriodo(f.inicio, f.fim), f.local]
        .filter(Boolean)
        .join(" · ");
      if (meta) children.push(para(meta, { size: 20 }));
      children.push(...htmlToParagraphs(f.descricao));
    });
  }

  if (competencias.length) {
    children.push(sectionHeading("Competências"));
    children.push(
      para(
        competencias
          .map((c) => (c.nivel ? `${c.nome} (${c.nivel})` : c.nome))
          .join(" · "),
      ),
    );
  }

  if (idiomas.length) {
    children.push(sectionHeading("Idiomas"));
    children.push(
      para(
        idiomas
          .map((i) => (i.nivel ? `${i.idioma} — ${i.nivel}` : i.idioma))
          .join(" · "),
      ),
    );
  }

  extras.forEach((sec) => {
    if (!sec.itens.length) return;
    children.push(sectionHeading(sec.titulo));
    sec.itens.forEach((it) => {
      children.push(para(it.titulo, { bold: true }));
      if (it.data) children.push(para(it.data, { size: 20 }));
      children.push(...htmlToParagraphs(it.descricao));
    });
  });

  const doc = new Document({
    creator: "CV Flexível",
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 } } },
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 180 } } },
            },
          ],
        },
        {
          reference: "numbers",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 180 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }, // ~2cm
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${slugify(perfil.nome || draft.title)}.docx`);
}

function filenameSafeTitle(s: string) {
  return s.replace(/[\\/:*?"<>|]/g, "").trim() || "CV";
}

/**
 * Exportar PDF via diálogo de impressão do navegador (print CSS sobre as
 * páginas reais em `.cv-print-page`, ver @media print em styles.css).
 * Funciona bem para CVs ATS porque o texto é seleccionável. Client-side only.
 */
export async function exportCvPdf(draft: CvDraft) {
  if (typeof window === "undefined") return;

  await document.fonts.ready;

  const previousTitle = document.title;
  document.title = filenameSafeTitle(draft.sections.perfil.nome || draft.title);

  const restoreTitle = () => {
    document.title = previousTitle;
    window.removeEventListener("afterprint", restoreTitle);
  };
  window.addEventListener("afterprint", restoreTitle);

  window.print();
}
