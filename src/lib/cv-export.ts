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

function bullet(text: string) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    children: [new TextRun({ text, size: 22 })],
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
    children.push(para(perfil.resumo));
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
      if (e.descricao) {
        e.descricao
          .split(/\n+/)
          .filter(Boolean)
          .forEach((line) => children.push(bullet(line.replace(/^[-•]\s*/, ""))));
      }
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
      if (f.descricao) children.push(para(f.descricao));
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
      if (it.descricao) children.push(para(it.descricao));
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

/**
 * Exportar PDF via diálogo de impressão do navegador.
 * Funciona bem para CVs ATS porque o texto é seleccionável.
 */
export function exportCvPdf() {
  window.print();
}
