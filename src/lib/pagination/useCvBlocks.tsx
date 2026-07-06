// Decompõe um CvDraft numa lista ordenada de blocos indivisíveis + conteúdo de
// sidebar. O markup replica fielmente o da preview contínua original para que a
// medição e o render final sejam visualmente idênticos.

import { useMemo } from "react";
import type { ReactNode } from "react";
import type { CvDraft } from "@/lib/cv-types";
import type { TemplateInfo } from "@/lib/cv-design-presets";
import { toSafeHtml } from "@/lib/rich-text";
import type { CvBlock } from "./types";
import { FIRST_ITEM_GAP, type PageMetrics } from "./metrics";

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

function sectionLabelClass(headerStyle: TemplateInfo["headerStyle"]) {
  return headerStyle === "underline"
    ? "border-b pb-1 text-[10px] font-semibold uppercase tracking-[0.2em]"
    : headerStyle === "accent"
      ? "text-[10px] font-semibold uppercase tracking-[0.22em]"
      : "text-[10px] font-medium uppercase tracking-[0.18em]";
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
    const { perfil, experiencia, formacao, competencias, idiomas, extras } =
      draft.sections;
    const labelClass = sectionLabelClass(template.headerStyle);

    const hasContacto = !!(
      perfil.email ||
      perfil.telefone ||
      perfil.cidade ||
      perfil.linkedin
    );

    const Contacto = () =>
      hasContacto ? (
        <p className="text-[11px]" style={{ color: "var(--cv-muted)" }}>
          {[
            perfil.cidade && perfil.pais
              ? `${perfil.cidade}, ${perfil.pais}`
              : perfil.cidade || perfil.pais,
            perfil.email,
            perfil.telefone,
            perfil.linkedin,
            perfil.website,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null;

    const SectionTitle = ({ titulo }: { titulo: string }) => (
      <h2
        className={labelClass}
        style={{ color: "var(--cv-accent)", borderColor: "var(--cv-rule)" }}
      >
        {titulo}
      </h2>
    );

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
            borderBottom:
              template.headerStyle === "underline"
                ? "2px solid var(--cv-accent)"
                : "none",
            paddingBottom: template.headerStyle === "underline" ? "10px" : "0",
          }}
        >
          <h1
            className="text-[calc(var(--cv-base-size)*2.15)] leading-tight"
            style={{
              color: "var(--cv-accent)",
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            {perfil.nome || (
              <span style={{ color: "var(--cv-muted)" }}>O teu nome</span>
            )}
          </h1>
          {perfil.headline && (
            <p className="mt-1" style={{ color: "var(--cv-accent-soft)" }}>
              {perfil.headline}
            </p>
          )}
          {!isSidebar && hasContacto && (
            <div className="mt-2">
              <Contacto />
            </div>
          )}
        </header>
      ),
    });

    // Adiciona um título de secção + os seus itens como blocos separados.
    const pushSection = (
      sectionId: string,
      titulo: string,
      items: Array<{ id: string; node: ReactNode }>,
      gap = itemGap,
    ) => {
      if (items.length === 0) return;
      blocks.push({
        id: `title-${sectionId}`,
        kind: "section-title",
        sectionId,
        marginBefore: sectionGap,
        node: <SectionTitle titulo={titulo} />,
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
      pushSection("perfil", "Perfil", [
        { id: "resumo", node: <RichText html={perfil.resumo} /> },
      ]);
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
                  <span
                    className="font-normal"
                    style={{ color: "var(--cv-accent-soft)" }}
                  >
                    {" "}
                    · {e.organizacao}
                  </span>
                )}
              </p>
              <p
                className="shrink-0 text-[11px]"
                style={{ color: "var(--cv-muted)" }}
              >
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
                  <span
                    className="font-normal"
                    style={{ color: "var(--cv-accent-soft)" }}
                  >
                    {" "}
                    · {f.instituicao}
                  </span>
                )}
              </p>
              <p
                className="shrink-0 text-[11px]"
                style={{ color: "var(--cv-muted)" }}
              >
                {fmtPeriodo(f.inicio, f.fim)}
              </p>
            </div>
            {f.descricao && <RichText html={f.descricao} className="mt-1" />}
          </div>
        ),
      })),
    );

    // ── Competências / Idiomas (só no fluxo principal em layout single) ──
    if (!isSidebar && competencias.length > 0) {
      pushSection("competencias", "Competências", [
        {
          id: "lista",
          node: (
            <p style={{ color: "var(--cv-text)" }}>
              {competencias
                .map((c) => (c.nivel ? `${c.nome} (${c.nivel})` : c.nome))
                .join(" · ")}
            </p>
          ),
        },
      ]);
    }

    if (!isSidebar && idiomas.length > 0) {
      pushSection("idiomas", "Idiomas", [
        {
          id: "lista",
          node: (
            <p style={{ color: "var(--cv-text)" }}>
              {idiomas
                .map((i) => (i.nivel ? `${i.idioma} — ${i.nivel}` : i.idioma))
                .join(" · ")}
            </p>
          ),
        },
      ]);
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
                  <p
                    className="shrink-0 text-[11px]"
                    style={{ color: "var(--cv-muted)" }}
                  >
                    {it.data}
                  </p>
                )}
              </div>
              {it.descricao && <RichText html={it.descricao} />}
            </div>
          ),
        })),
        itemGap * 0.6,
      );
    });

    // ── Sidebar (contactos + competências + idiomas), só página 1 ──
    let sidebar: ReactNode | null = null;
    if (isSidebar) {
      sidebar = (
        <div className="space-y-4">
          <Contacto />
          {competencias.length > 0 && (
            <div>
              <SectionTitle titulo="Competências" />
              <ul
                className="mt-2 space-y-0.5"
                style={{ color: "var(--cv-text)" }}
              >
                {competencias.map((c) => (
                  <li key={c.id}>· {c.nome}</li>
                ))}
              </ul>
            </div>
          )}
          {idiomas.length > 0 && (
            <div>
              <SectionTitle titulo="Idiomas" />
              <ul
                className="mt-2 space-y-0.5"
                style={{ color: "var(--cv-text)" }}
              >
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
