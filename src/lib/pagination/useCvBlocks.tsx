// Decompõe um CvDraft numa lista ordenada de blocos indivisíveis + conteúdo de
// sidebar. O markup replica fielmente o da preview contínua original para que a
// medição e o render final sejam visualmente idênticos.

import { useMemo } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { CvDraft } from "@/lib/cv-types";
import type { TemplateInfo } from "@/lib/cv-design-presets";
import { toSafeHtml } from "@/lib/rich-text";
import { headerBorderStyle, sectionLabelClass } from "@/lib/templates/themes";
import { SECTION_ICONS, EXTRA_TYPE_ICONS } from "@/lib/section-icons";
import { buildContactItems } from "@/lib/contact-items";
import { photoFrameStyle, photoImgStyle } from "@/lib/photo-style";
import type { CvBlock } from "./types";
import {
  FIRST_ITEM_GAP,
  PHOTO_SIZE_HEADER_PX,
  PHOTO_SIZE_SIDEBAR_PX,
  type PageMetrics,
} from "./metrics";

function RichText({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={className ? `prose-cv ${className}` : "prose-cv"}
      style={{ color: "var(--cv-text)" }}
      dangerouslySetInnerHTML={{ __html: toSafeHtml(html) }}
    />
  );
}

function fmtPeriodo(inicio?: string, fim?: string) {
  const i = inicio || "";
  const f = fim || "";
  if (!i && !f) return "";
  if (i && f) return `${i} — ${f}`;
  return i || f;
}

export type CvBlocks = {
  mainBlocks: CvBlock[];
  /** Conteúdo da coluna lateral (só renderizado na página 1); null se single. */
  sidebar: ReactNode | null;
};

export function useCvBlocks(
  draft: CvDraft,
  template: TemplateInfo,
  metrics: PageMetrics,
): CvBlocks {
  const { sectionGap, itemGap } = metrics;
  const isSidebar = template.layout === "sidebar";

  return useMemo(() => {
    const { perfil, experiencia, formacao, competencias, idiomas, extras } = draft.sections;
    const labelClass = sectionLabelClass(template.headerStyle);
    const isBanner = template.headerStyle === "banner";
    const isColorSidebar = isSidebar && template.accentSurface === "sidebar";

    const contactItems = buildContactItems({
      email: perfil.email,
      telefone: perfil.telefone,
      cidade: perfil.cidade,
      pais: perfil.pais,
      morada: perfil.morada,
      linkedin: perfil.linkedin,
      website: perfil.website,
      cartaConducao: perfil.cartaConducao,
    });
    const hasContacto = contactItems.length > 0;

    const Contacto = ({ light = false }: { light?: boolean } = {}) =>
      hasContacto ? (
        <p
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
          style={{ color: light ? "rgba(255,255,255,0.85)" : "var(--cv-muted)" }}
        >
          {contactItems.map((it) => {
            const Icon = it.icon;
            return (
              <span key={it.field} className="inline-flex items-center gap-1">
                <Icon
                  className="h-[1em] w-[1em] shrink-0"
                  style={{ color: light ? "rgba(255,255,255,0.85)" : "var(--cv-accent-soft)" }}
                />
                {it.text}
              </span>
            );
          })}
        </p>
      ) : null;

    const SectionTitle = ({
      titulo,
      icon: Icon,
      light = false,
    }: {
      titulo: string;
      icon?: LucideIcon;
      light?: boolean;
    }) => (
      <h2
        className={`flex items-center gap-1.5 ${labelClass}`}
        style={{
          color: light ? "#fff" : "var(--cv-accent)",
          borderColor: light ? "rgba(255,255,255,0.4)" : "var(--cv-rule)",
        }}
      >
        {Icon && <Icon className="h-[1em] w-[1em] shrink-0" />}
        {titulo}
      </h2>
    );

    const Photo = ({ size }: { size: number }) =>
      perfil.foto ? (
        <div style={photoFrameStyle(size)}>
          <img src={perfil.foto.url} alt="" style={photoImgStyle(perfil.foto)} />
        </div>
      ) : null;

    const blocks: CvBlock[] = [];

    // ── Cabeçalho ──
    blocks.push({
      id: "header",
      kind: "header",
      sectionId: "header",
      marginBefore: 0,
      node: (
        <header
          style={{
            ...(isBanner
              ? { background: "var(--cv-accent)", borderRadius: 10, padding: "18px 22px" }
              : headerBorderStyle(template.headerStyle)),
            display: "flex",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1
              className="text-[calc(var(--cv-base-size)*2.15)] leading-tight"
              style={{
                color: isBanner ? "#fff" : "var(--cv-accent)",
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              {perfil.nome || (
                <span style={{ color: isBanner ? "rgba(255,255,255,0.7)" : "var(--cv-muted)" }}>
                  O teu nome
                </span>
              )}
            </h1>
            {perfil.headline && (
              <p
                className="mt-1"
                style={{ color: isBanner ? "rgba(255,255,255,0.85)" : "var(--cv-accent-soft)" }}
              >
                {perfil.headline}
              </p>
            )}
            {!isSidebar && hasContacto && (
              <div className="mt-2">
                <Contacto light={isBanner} />
              </div>
            )}
          </div>
          {!isSidebar && <Photo size={PHOTO_SIZE_HEADER_PX} />}
        </header>
      ),
    });

    // Adiciona um título de secção + os seus itens como blocos separados.
    const pushSection = (
      sectionId: string,
      titulo: string,
      items: Array<{ id: string; node: ReactNode }>,
      opts?: { gap?: number; icon?: LucideIcon },
    ) => {
      if (items.length === 0) return;
      const gap = opts?.gap ?? itemGap;
      blocks.push({
        id: `title-${sectionId}`,
        kind: "section-title",
        sectionId,
        marginBefore: sectionGap,
        node: <SectionTitle titulo={titulo} icon={opts?.icon} />,
      });
      items.forEach((it, idx) => {
        blocks.push({
          id: `${sectionId}-${it.id}`,
          kind: "item",
          sectionId,
          marginBefore: idx === 0 ? FIRST_ITEM_GAP : gap,
          node: it.node,
        });
      });
    };

    // ── Perfil (resumo) ──
    if (perfil.resumo) {
      pushSection("perfil", "Perfil", [{ id: "resumo", node: <RichText html={perfil.resumo} /> }], {
        icon: SECTION_ICONS.perfil,
      });
    }

    // ── Experiência ──
    pushSection(
      "experiencia",
      "Experiência profissional",
      experiencia.map((e) => ({
        id: e.id,
        node: (
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium" style={{ color: "var(--cv-text)" }}>
                {e.cargo || "—"}
                {e.organizacao && (
                  <span className="font-normal" style={{ color: "var(--cv-accent-soft)" }}>
                    {" "}
                    · {e.organizacao}
                  </span>
                )}
              </p>
              <p className="shrink-0 text-[11px]" style={{ color: "var(--cv-muted)" }}>
                {fmtPeriodo(e.inicio, e.fim)}
              </p>
            </div>
            {e.local && (
              <p className="text-[11px]" style={{ color: "var(--cv-muted)" }}>
                {e.local}
              </p>
            )}
            {e.descricao && <RichText html={e.descricao} className="mt-1" />}
          </div>
        ),
      })),
      { icon: SECTION_ICONS.experiencia },
    );

    // ── Formação ──
    pushSection(
      "formacao",
      "Formação",
      formacao.map((f) => ({
        id: f.id,
        node: (
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium" style={{ color: "var(--cv-text)" }}>
                {f.curso || "—"}
                {f.instituicao && (
                  <span className="font-normal" style={{ color: "var(--cv-accent-soft)" }}>
                    {" "}
                    · {f.instituicao}
                  </span>
                )}
              </p>
              <p className="shrink-0 text-[11px]" style={{ color: "var(--cv-muted)" }}>
                {fmtPeriodo(f.inicio, f.fim)}
              </p>
            </div>
            {f.descricao && <RichText html={f.descricao} className="mt-1" />}
          </div>
        ),
      })),
      { icon: SECTION_ICONS.formacao },
    );

    // ── Competências / Idiomas (só no fluxo principal em layout single) ──
    if (!isSidebar && competencias.length > 0) {
      pushSection(
        "competencias",
        "Competências",
        [
          {
            id: "lista",
            node: (
              <p style={{ color: "var(--cv-text)" }}>
                {competencias.map((c) => (c.nivel ? `${c.nome} (${c.nivel})` : c.nome)).join(" · ")}
              </p>
            ),
          },
        ],
        { icon: SECTION_ICONS.competencias },
      );
    }

    if (!isSidebar && idiomas.length > 0) {
      pushSection(
        "idiomas",
        "Idiomas",
        [
          {
            id: "lista",
            node: (
              <p style={{ color: "var(--cv-text)" }}>
                {idiomas.map((i) => (i.nivel ? `${i.idioma} — ${i.nivel}` : i.idioma)).join(" · ")}
              </p>
            ),
          },
        ],
        { icon: SECTION_ICONS.idiomas },
      );
    }

    // ── Secções extras ──
    extras.forEach((sec) => {
      pushSection(
        `extra-${sec.id}`,
        sec.titulo,
        sec.itens.map((it) => ({
          id: it.id,
          node: (
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium" style={{ color: "var(--cv-text)" }}>
                  {it.titulo || "—"}
                </p>
                {it.data && (
                  <p className="shrink-0 text-[11px]" style={{ color: "var(--cv-muted)" }}>
                    {it.data}
                  </p>
                )}
              </div>
              {it.descricao && <RichText html={it.descricao} />}
            </div>
          ),
        })),
        { gap: itemGap * 0.6, icon: EXTRA_TYPE_ICONS[sec.tipo] },
      );
    });

    // ── Sidebar (contactos + competências + idiomas), só página 1 ──
    let sidebar: ReactNode | null = null;
    if (isSidebar) {
      const itemColor = isColorSidebar ? "rgba(255,255,255,0.92)" : "var(--cv-text)";
      sidebar = (
        <div className="space-y-4" style={isColorSidebar ? { color: "#fff" } : undefined}>
          {perfil.foto && (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Photo size={template.photoSizeSidebar ?? PHOTO_SIZE_SIDEBAR_PX} />
            </div>
          )}
          <Contacto light={isColorSidebar} />
          {competencias.length > 0 && (
            <div>
              <SectionTitle
                titulo="Competências"
                icon={SECTION_ICONS.competencias}
                light={isColorSidebar}
              />
              <ul className="mt-2 space-y-0.5" style={{ color: itemColor }}>
                {competencias.map((c) => (
                  <li key={c.id}>· {c.nome}</li>
                ))}
              </ul>
            </div>
          )}
          {idiomas.length > 0 && (
            <div>
              <SectionTitle titulo="Idiomas" icon={SECTION_ICONS.idiomas} light={isColorSidebar} />
              <ul className="mt-2 space-y-0.5" style={{ color: itemColor }}>
                {idiomas.map((i) => (
                  <li key={i.id}>
                    {i.idioma}
                    {i.nivel ? ` — ${i.nivel}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    return { mainBlocks: blocks, sidebar };
  }, [draft.sections, template, sectionGap, itemGap, isSidebar]);
}
