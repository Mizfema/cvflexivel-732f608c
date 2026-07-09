/**
 * Construtor do DOCX do CV.
 *
 * IMPORTANTE: este DOCX NÃO tenta clonar visualmente os templates do editor
 * (sem sidebar, sem duas colunas, sem tabelas ou caixas de texto a simular
 * layout). É sempre um documento de coluna única, limpo e ATS-friendly —
 * fonte + cor de acento + hierarquia tipográfica + bullets nativas, e nada
 * mais.
 */
import {
  AlignmentType,
  Document,
  ImageRun,
  LevelFormat,
  LineRuleType,
  Paragraph,
  TextRun,
  type IStylesOptions,
} from "docx";
import type { CvDesign, CvDraft, CvPhoto, SpacingSize } from "../cv-types";
import { DEFAULT_FONT_ID, FONT_OPTIONS } from "../cv-design-presets";
import { BULLET_LIST_REFERENCE, NUMBER_LIST_REFERENCE, htmlToDocxParagraphs } from "./html-to-docx";

const PHOTO_DOCX_SIZE = 320;
const PHOTO_DOCX_TWIPS = 90;

/**
 * Aproximação, só para o DOCX: o `docx` não aplica transforms CSS, por isso
 * "cozinhamos" o zoom/posição atuais num canvas offscreen (com recorte
 * circular) para gerar os bytes de um PNG. Se falhar (ex.: CORS), degrada
 * silenciosamente para DOCX sem foto — nunca deve rebentar a exportação.
 */
async function bakePhotoForDocx(photo: CvPhoto): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(photo.url);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const size = PHOTO_DOCX_SIZE;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const coverScale = Math.max(size / bitmap.width, size / bitmap.height) * photo.zoom;
    const drawW = bitmap.width * coverScale;
    const drawH = bitmap.height * coverScale;
    const cx = size / 2 + photo.zoom * (photo.offsetX / 100) * size;
    const cy = size / 2 + photo.zoom * (photo.offsetY / 100) * size;
    ctx.drawImage(bitmap, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
    ctx.restore();

    const pngBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!pngBlob) return null;
    return await pngBlob.arrayBuffer();
  } catch {
    return null;
  }
}

type CvSections = CvDraft["sections"];

const ACCENT_FALLBACK = "1E3A5F";
const DARK_GRAY = "404040";
const MEDIUM_GRAY = "595959";

// Twips (1/20 pt). Proporção pedida para sectionGap: S=120, M=240, L=360.
// itemGap segue a mesma proporção (metade do sectionGap). pageMargin usa uma
// escala maior — S≈1.6cm, M≈2cm (igual à margem fixa anterior), L≈2.54cm —
// para dar respiração real de página em vez de twips proporcionalmente pequenos.
const SECTION_GAP_TWIPS: Record<SpacingSize, number> = { S: 120, M: 240, L: 360 };
const ITEM_GAP_TWIPS: Record<SpacingSize, number> = { S: 60, M: 120, L: 180 };
const PAGE_MARGIN_TWIPS: Record<SpacingSize, number> = { S: 900, M: 1134, L: 1440 };

const STYLE_TITLE = "CVTitle";
const STYLE_SUBTITLE = "CVSubtitle";
const STYLE_CONTACT = "CVContact";
const STYLE_SECTION_HEADING = "CVSectionHeading";
const STYLE_JOB_TITLE = "CVJobTitle";
const STYLE_JOB_META = "CVJobMeta";
const STYLE_BODY = "CVBody";

function resolveFont(fontFamily: string): string {
  const font = FONT_OPTIONS[fontFamily as keyof typeof FONT_OPTIONS];
  return (font ?? FONT_OPTIONS[DEFAULT_FONT_ID]).label;
}

function hexNoHash(hex: string): string {
  const stripped = hex.replace("#", "");
  return /^[0-9a-fA-F]{6}$/.test(stripped) ? stripped : ACCENT_FALLBACK;
}

function lineSpacing(lineHeight: number) {
  return { line: Math.round(lineHeight * 240), lineRule: LineRuleType.AUTO };
}

function buildStyles(design: CvDesign): IStylesOptions {
  const font = resolveFont(design.fontFamily);
  const accent = hexNoHash(design.accentColor);
  const line = lineSpacing(design.spacing.lineHeight);
  const sectionGap = SECTION_GAP_TWIPS[design.spacing.sectionGap];
  const itemGap = ITEM_GAP_TWIPS[design.spacing.itemGap];

  return {
    default: {
      document: { run: { font, size: 21 } },
    },
    paragraphStyles: [
      {
        id: STYLE_TITLE,
        name: "CV Title",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font, bold: true, size: 44, color: accent },
        paragraph: { spacing: { ...line, after: 60 } },
      },
      {
        id: STYLE_SUBTITLE,
        name: "CV Subtitle",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font, size: 24, color: DARK_GRAY },
        paragraph: { spacing: { ...line, after: 120 } },
      },
      {
        id: STYLE_CONTACT,
        name: "CV Contact",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font, size: 20, color: MEDIUM_GRAY },
        paragraph: { spacing: { ...line, after: 200 } },
      },
      {
        id: STYLE_SECTION_HEADING,
        name: "CV Section Heading",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font, bold: true, size: 22, color: accent, allCaps: true, smallCaps: true },
        paragraph: { spacing: { ...line, before: sectionGap, after: 100 } },
      },
      {
        id: STYLE_JOB_TITLE,
        name: "CV Job Title",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font, bold: true, size: 22 },
        paragraph: { spacing: { ...line, before: itemGap, after: 20 } },
      },
      {
        id: STYLE_JOB_META,
        name: "CV Job Meta",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font, size: 18, color: MEDIUM_GRAY },
        paragraph: { spacing: { ...line, after: 80 } },
      },
      {
        id: STYLE_BODY,
        name: "CV Body",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font, size: 21 },
        paragraph: { spacing: { ...line, after: 80 } },
      },
    ],
  };
}

function buildNumbering() {
  return {
    config: [
      {
        reference: BULLET_LIST_REFERENCE,
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
        reference: NUMBER_LIST_REFERENCE,
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
  };
}

function fmtPeriodo(inicio?: string, fim?: string): string {
  if (!inicio && !fim) return "";
  if (inicio && fim) return `${inicio} — ${fim}`;
  return inicio || fim || "";
}

function line(text: string, style: string): Paragraph {
  return new Paragraph({ style, children: [new TextRun({ text })] });
}

export async function buildCvDocx(cv: CvSections, design: CvDesign): Promise<Document> {
  const { perfil, experiencia, formacao, competencias, idiomas, extras } = cv;
  const children: Paragraph[] = [];

  if (perfil.foto) {
    const photoBytes = await bakePhotoForDocx(perfil.foto);
    if (photoBytes) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              type: "png",
              data: photoBytes,
              transformation: { width: PHOTO_DOCX_TWIPS, height: PHOTO_DOCX_TWIPS },
            }),
          ],
        }),
      );
    }
  }

  children.push(line(perfil.nome || "Sem nome", STYLE_TITLE));
  if (perfil.headline) children.push(line(perfil.headline, STYLE_SUBTITLE));

  const contacto = [
    perfil.cidade && perfil.pais
      ? `${perfil.cidade}, ${perfil.pais}`
      : perfil.cidade || perfil.pais,
    perfil.email,
    perfil.telefone,
    perfil.morada,
    perfil.linkedin,
    perfil.website,
    perfil.cartaConducao,
  ]
    .filter(Boolean)
    .join(" · ");
  if (contacto) children.push(line(contacto, STYLE_CONTACT));

  if (perfil.resumo) {
    children.push(line("Perfil", STYLE_SECTION_HEADING));
    children.push(...htmlToDocxParagraphs(perfil.resumo, STYLE_BODY));
  }

  if (experiencia.length) {
    children.push(line("Experiência profissional", STYLE_SECTION_HEADING));
    experiencia.forEach((e) => {
      children.push(line([e.cargo, e.organizacao].filter(Boolean).join(" · "), STYLE_JOB_TITLE));
      const meta = [fmtPeriodo(e.inicio, e.fim), e.local].filter(Boolean).join(" · ");
      if (meta) children.push(line(meta, STYLE_JOB_META));
      children.push(...htmlToDocxParagraphs(e.descricao, STYLE_BODY));
    });
  }

  if (formacao.length) {
    children.push(line("Formação", STYLE_SECTION_HEADING));
    formacao.forEach((f) => {
      children.push(line([f.curso, f.instituicao].filter(Boolean).join(" · "), STYLE_JOB_TITLE));
      const meta = [fmtPeriodo(f.inicio, f.fim), f.local].filter(Boolean).join(" · ");
      if (meta) children.push(line(meta, STYLE_JOB_META));
      children.push(...htmlToDocxParagraphs(f.descricao, STYLE_BODY));
    });
  }

  if (competencias.length) {
    children.push(line("Competências", STYLE_SECTION_HEADING));
    children.push(
      line(
        competencias.map((c) => (c.nivel ? `${c.nome} (${c.nivel})` : c.nome)).join(" · "),
        STYLE_BODY,
      ),
    );
  }

  if (idiomas.length) {
    children.push(line("Idiomas", STYLE_SECTION_HEADING));
    children.push(
      line(
        idiomas.map((i) => (i.nivel ? `${i.idioma} — ${i.nivel}` : i.idioma)).join(" · "),
        STYLE_BODY,
      ),
    );
  }

  extras.forEach((sec) => {
    if (!sec.itens.length) return;
    children.push(line(sec.titulo, STYLE_SECTION_HEADING));
    sec.itens.forEach((it) => {
      children.push(line(it.titulo, STYLE_JOB_TITLE));
      if (it.data) children.push(line(it.data, STYLE_JOB_META));
      children.push(...htmlToDocxParagraphs(it.descricao, STYLE_BODY));
    });
  });

  const margin = PAGE_MARGIN_TWIPS[design.spacing.pageMargin];

  return new Document({
    creator: "CV Flexível",
    styles: buildStyles(design),
    numbering: buildNumbering(),
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: margin, right: margin, bottom: margin, left: margin },
          },
        },
        children,
      },
    ],
  });
}
