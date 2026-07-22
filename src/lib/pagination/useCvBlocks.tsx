// Decompõe um CvDraft numa lista ordenada de blocos indivisíveis + conteúdo de
// sidebar. O markup replica fielmente o da preview contínua original para que a
// medição e o render final sejam visualmente idênticos.
//
// FASE 2b (metade final): perfil/experiência/formação já têm versão compacta
// para a sidebar (texto completo, tipografia mais pequena). Com isto, QUALQUER
// secção já sabe render-se em qualquer zona — falta só a Fase 3 (UI de
// arrastar-e-largar) para o utilizador escolher a colocação.

import { useMemo } from "react";
import type { ReactNode } from "react";
import { User, type LucideIcon } from "lucide-react";
import type { CvDraft } from "@/lib/cv-types";
import type { TemplateInfo } from "@/lib/cv-design-presets";
import { toSafeHtml } from "@/lib/rich-text";
import { headerBorderStyle, sectionLabelClass } from "@/lib/templates/themes";
import { SECTION_ICONS, EXTRA_TYPE_ICONS } from "@/lib/section-icons";
import { buildContactItems } from "@/lib/contact-items";
import { photoFrameStyle, photoImgStyle } from "@/lib/photo-style";
import {
  resolveSectionLayout,
  keysByZone,
  isExtraKey,
  extraIdFromKey,
  getSectionTitle,
} from "@/lib/cv-section-layout";
import type { CvBlock } from "./types";
import {
  FIRST_ITEM_GAP,
  PHOTO_SIZE_HEADER_PX,
  PHOTO_SIZE_SIDEBAR_PX,
  type PageMetrics,
} from "./metrics";

function RichText({
  html,
  className,
  color = "var(--cv-text)",
}: {
  html: string;
  className?: string;
  color?: string;
}) {
  return (
    <div
      className={className ? `prose-cv ${className}` : "prose-cv"}
      style={{ color }}
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
  /** Cabeçalho fixo da sidebar (foto + nome + Informações pessoais) —
   *  aparece só na página 1; null se o template não tem sidebar. */
  sidebarHeader: ReactNode | null;
  /** Secções da sidebar, prontas a paginar; vazio se não tem sidebar. */
  sidebarBlocks: CvBlock[];
  /** Sidebar completa (cabeçalho + conteúdo) num único nó — compat.
   *  Continua a ser o que o CvPagedPreview usa hoje. Null se não tem
   *  sidebar. */
  sidebar: ReactNode | null;
};

export function useCvBlocks(
  draft: CvDraft,
  template: TemplateInfo,
  metrics: PageMetrics,
): CvBlocks {
  const { sectionGap, itemGap, padX, padY } = metrics;
  const isSidebar = template.layout === "sidebar";

  return useMemo(() => {
    const { perfil, experiencia, formacao, competencias, idiomas, extras } = draft.sections;
    const labelClass = sectionLabelClass(template.headerStyle);
    const isBanner = template.headerStyle === "banner";
    const isColorSidebar = isSidebar && template.accentSurface === "sidebar";
    const isBlockSidebar = isSidebar && template.accentSurface === "sidebar-block";
    const isHeroSidebar = isSidebar && template.accentSurface === "sidebar-hero";
    const nameInSidebar = isSidebar && !!template.nameInSidebar;
    const initials = (perfil.nome || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("");

    // ── Ordem/colocação das secções (Fase 2b) ──
    const layout = resolveSectionLayout(draft, template);
    const { main: mainKeys, sidebar: sidebarKeys } = keysByZone(layout);
    const extraById = new Map(extras.map((e) => [e.id, e]));

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

    const ContactList = ({
      items,
      light = false,
      stacked = false,
    }: {
      items: Array<{ field: string; icon: LucideIcon; text: string }>;
      light?: boolean;
      /** Um item por linha (ex. "Informações pessoais") em vez de embrulhar numa linha. */
      stacked?: boolean;
    }) =>
      items.length > 0 ? (
        <p
          className={
            stacked
              ? "flex flex-col gap-1 text-[11px]"
              : "flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
          }
          style={{ color: light ? "rgba(255,255,255,0.85)" : "var(--cv-muted)" }}
        >
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <span key={it.field} className="inline-flex min-w-0 items-start gap-1">
                <Icon
                  className="mt-[0.15em] shrink-0"
                  strokeWidth={2.5}
                  style={{
                    width: "1.25em",
                    height: "1.25em",
                    color: light ? "rgba(255,255,255,0.85)" : "var(--cv-accent-soft)",
                  }}
                />
                <span className="min-w-0 [overflow-wrap:anywhere]">{it.text}</span>
              </span>
            );
          })}
        </p>
      ) : null;

    const Contacto = ({ light = false }: { light?: boolean } = {}) =>
      hasContacto ? <ContactList items={contactItems} light={light} /> : null;

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
        className={`flex items-center gap-2 ${labelClass}`}
        style={{
          color: light ? "#fff" : "var(--cv-accent)",
          fontSize: "calc(var(--cv-base-size) * 1.2)",
          fontWeight: 700,
          letterSpacing: "0.03em",
          borderBottom: `1.5px solid ${light ? "rgba(255,255,255,0.45)" : "var(--cv-rule)"}`,
          paddingBottom: 3,
        }}
      >
        {Icon && (
          <Icon
            className="shrink-0"
            strokeWidth={2.5}
            style={{ width: "1.1em", height: "1.1em" }}
          />
        )}
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
    if (!nameInSidebar) {
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
    }

    // Adiciona um título de secção + os seus itens como blocos separados
    // (usado na coluna PRINCIPAL, onde cada item é um bloco medível/paginável).
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

    // Renderiza UMA secção na coluna principal, dado o seu key de layout.
    const renderMainSection = (key: string) => {
      if (key === "perfil") {
        if (perfil.resumo) {
          pushSection(
            "perfil",
            getSectionTitle("perfil", layout, draft),
            [{ id: "resumo", node: <RichText html={perfil.resumo} /> }],
            { icon: SECTION_ICONS.perfil },
          );
        }
        return;
      }
      if (key === "experiencia") {
        pushSection(
          "experiencia",
          getSectionTitle("experiencia", layout, draft),
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
        return;
      }
      if (key === "formacao") {
        pushSection(
          "formacao",
          getSectionTitle("formacao", layout, draft),
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
        return;
      }
      if (key === "competencias") {
        if (competencias.length > 0) {
          pushSection(
            "competencias",
            getSectionTitle("competencias", layout, draft),
            [
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
            ],
            { icon: SECTION_ICONS.competencias },
          );
        }
        return;
      }
      if (key === "idiomas") {
        if (idiomas.length > 0) {
          pushSection(
            "idiomas",
            getSectionTitle("idiomas", layout, draft),
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
        return;
      }
      if (isExtraKey(key)) {
        const sec = extraById.get(extraIdFromKey(key));
        if (!sec) return;
        // sectionId = key (formato "extra:<id>"), igual ao que a sidebar já
        // usa (renderSidebarSection/buildSidebarBlocks) e ao que sectionLayout
        // usa em todo o lado (order/placement/titles/hidden/pageBreakBefore) —
        // antes era "extra-<id>" (hífen), desalinhado destas chaves.
        pushSection(
          key,
          getSectionTitle(key, layout, draft),
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
      }
    };

    mainKeys.forEach(renderMainSection);

    // ── Sidebar (contactos + secções colocadas na sidebar), só página 1 ──
    let sidebar: ReactNode | null = null;
    let sidebarHeader: ReactNode | null = null;
    let sidebarBlocks: CvBlock[] = [];
    if (isSidebar) {
      // Renderiza UMA secção na coluna SIDEBAR, dado o seu key de layout.
      // Regra de produto: descrições completas (texto rico), tipografia menor
      // do que na coluna principal para caber na largura estreita — nunca corta
      // conteúdo.
      const renderSidebarSection = (
        key: string,
        light: boolean,
        itemColor: string,
        mutedItemColor: string,
      ): ReactNode => {
        if (key === "perfil") {
          if (!perfil.resumo) return null;
          return (
            <div key={key}>
              <SectionTitle
                titulo={getSectionTitle("perfil", layout, draft)}
                icon={SECTION_ICONS.perfil}
                light={light}
              />
              <div className="mt-2">
                <RichText
                  html={perfil.resumo}
                  className="text-[11px] leading-snug"
                  color={itemColor}
                />
              </div>
            </div>
          );
        }
        if (key === "experiencia") {
          if (experiencia.length === 0) return null;
          return (
            <div key={key}>
              <SectionTitle
                titulo={getSectionTitle("experiencia", layout, draft)}
                icon={SECTION_ICONS.experiencia}
                light={light}
              />
              <div className="mt-2 space-y-2">
                {experiencia.map((e) => (
                  <div key={e.id}>
                    <p className="font-medium text-[11px]" style={{ color: itemColor }}>
                      {e.cargo || "—"}
                    </p>
                    {e.organizacao && (
                      <p className="text-[10px]" style={{ color: mutedItemColor }}>
                        {e.organizacao}
                      </p>
                    )}
                    <p className="text-[10px]" style={{ color: mutedItemColor }}>
                      {fmtPeriodo(e.inicio, e.fim)}
                      {e.local ? ` · ${e.local}` : ""}
                    </p>
                    {e.descricao && (
                      <RichText
                        html={e.descricao}
                        className="mt-1 text-[10px] leading-snug"
                        color={itemColor}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        }
        if (key === "formacao") {
          if (formacao.length === 0) return null;
          return (
            <div key={key}>
              <SectionTitle
                titulo={getSectionTitle("formacao", layout, draft)}
                icon={SECTION_ICONS.formacao}
                light={light}
              />
              <div className="mt-2 space-y-2">
                {formacao.map((f) => (
                  <div key={f.id}>
                    <p className="font-medium text-[11px]" style={{ color: itemColor }}>
                      {f.curso || "—"}
                    </p>
                    {f.instituicao && (
                      <p className="text-[10px]" style={{ color: mutedItemColor }}>
                        {f.instituicao}
                      </p>
                    )}
                    <p className="text-[10px]" style={{ color: mutedItemColor }}>
                      {fmtPeriodo(f.inicio, f.fim)}
                    </p>
                    {f.descricao && (
                      <RichText
                        html={f.descricao}
                        className="mt-1 text-[10px] leading-snug"
                        color={itemColor}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        }
        if (key === "competencias") {
          if (competencias.length === 0) return null;
          return (
            <div key={key}>
              <SectionTitle
                titulo={getSectionTitle("competencias", layout, draft)}
                icon={SECTION_ICONS.competencias}
                light={light}
              />
              <ul className="mt-2 space-y-0.5" style={{ color: itemColor }}>
                {competencias.map((c) => (
                  <li key={c.id}>· {c.nome}</li>
                ))}
              </ul>
            </div>
          );
        }
        if (key === "idiomas") {
          if (idiomas.length === 0) return null;
          return (
            <div key={key}>
              <SectionTitle
                titulo={getSectionTitle("idiomas", layout, draft)}
                icon={SECTION_ICONS.idiomas}
                light={light}
              />
              <ul className="mt-2 space-y-0.5" style={{ color: itemColor }}>
                {idiomas.map((i) => (
                  <li key={i.id}>
                    {i.idioma}
                    {i.nivel ? ` — ${i.nivel}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        if (isExtraKey(key)) {
          const sec = extraById.get(extraIdFromKey(key));
          if (!sec) return null;
          return (
            <div key={key}>
              <SectionTitle
                titulo={getSectionTitle(key, layout, draft)}
                icon={EXTRA_TYPE_ICONS[sec.tipo]}
                light={light}
              />
              <div className="mt-2 space-y-2">
                {sec.itens.map((it) => (
                  <div key={it.id}>
                    <p className="font-medium" style={{ color: itemColor }}>
                      {it.titulo || "—"}
                    </p>
                    {it.data && (
                      <p className="text-[10px]" style={{ color: mutedItemColor }}>
                        {it.data}
                      </p>
                    )}
                    {it.descricao && (
                      <RichText
                        html={it.descricao}
                        className="text-[10px] leading-snug"
                        color={itemColor}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        }
        return null;
      };

      const renderSidebarEntries = (light: boolean, itemColor: string, mutedItemColor: string) =>
        sidebarKeys.map((key) => renderSidebarSection(key, light, itemColor, mutedItemColor));

      // Mesmos keys de renderSidebarEntries, mas cada secção embrulhada num
      // CvBlock pronto a paginar (Fase P2). Secções vazias (node null) ficam
      // de fora.
      const buildSidebarBlocks = (
        light: boolean,
        itemColor: string,
        mutedItemColor: string,
      ): CvBlock[] =>
        sidebarKeys.reduce<CvBlock[]>((acc, key) => {
          const node = renderSidebarSection(key, light, itemColor, mutedItemColor);
          if (node === null) return acc;
          acc.push({
            id: `sidebar-${key}`,
            kind: "sidebar-item",
            sectionId: key,
            marginBefore: sectionGap,
            node,
          });
          return acc;
        }, []);

      if (nameInSidebar) {
        const light = isColorSidebar; // institucional=true (aside navy) / arco=false (texto escuro sobre translúcido)
        const itemColor = light ? "rgba(255,255,255,0.92)" : "var(--cv-text)";
        const mutedItemColor = light ? "rgba(255,255,255,0.7)" : "var(--cv-muted)";
        const photoSize = template.photoSizeSidebar ?? PHOTO_SIZE_SIDEBAR_PX;
        const HERO_RADIUS = 55; // curvatura do arco — ajustável

        const nameBox = (
          <div>
            <div
              style={{
                padding: "10px 8px",
                textAlign: "center",
              }}
            >
              <div
                className="text-[calc(var(--cv-base-size)*1.35)] leading-tight"
                style={{ color: "#fff", fontWeight: 600, letterSpacing: "0.3px" }}
              >
                {perfil.nome || "O teu nome"}
              </div>
            </div>
            {perfil.headline && (
              <p
                className="mt-1 text-center text-[11px]"
                style={{ color: "rgba(255,255,255,0.85)" }}
              >
                {perfil.headline}
              </p>
            )}
          </div>
        );

        const photoNode = (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              ...(isHeroSidebar ? { marginTop: -Math.round(photoSize / 2) } : {}),
            }}
          >
            <div
              style={{
                position: "relative",
                zIndex: 2,
                borderRadius: "50%",
                border: "3px solid #fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                lineHeight: 0,
              }}
            >
              {perfil.foto ? (
                <div style={photoFrameStyle(photoSize)}>
                  <img src={perfil.foto.url} alt="" style={photoImgStyle(perfil.foto)} />
                </div>
              ) : (
                <div
                  style={{
                    width: photoSize,
                    height: photoSize,
                    borderRadius: "50%",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: light ? "rgba(255,255,255,0.18)" : "var(--cv-accent)",
                    WebkitPrintColorAdjust: "exact",
                    printColorAdjust: "exact",
                  }}
                >
                  {initials ? (
                    <span
                      style={{
                        fontSize: Math.round(photoSize * 0.34),
                        fontWeight: 600,
                        color: "#fff",
                      }}
                    >
                      {initials}
                    </span>
                  ) : (
                    <User
                      style={{
                        width: photoSize * 0.5,
                        height: photoSize * 0.5,
                        color: "rgba(255,255,255,0.85)",
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        );

        const personalInfoItems = buildContactItems({
          email: perfil.email,
          telefone: perfil.telefone,
          cidade: perfil.cidade,
          pais: perfil.pais,
          morada: perfil.morada,
          linkedin: perfil.linkedin,
          website: perfil.website,
          cartaConducao: perfil.cartaConducao,
          dataNascimento: perfil.dataNascimento,
          genero: perfil.genero,
          estadoCivil: perfil.estadoCivil,
        });

        const informacoesPessoais = (
          <div>
            <SectionTitle titulo="Informações pessoais" icon={SECTION_ICONS.perfil} light={light} />
            <div className="mt-2">
              <ContactList items={personalInfoItems} light={light} stacked />
            </div>
          </div>
        );

        const sectionsNode = renderSidebarEntries(light, itemColor, mutedItemColor);
        sidebarBlocks = buildSidebarBlocks(light, itemColor, mutedItemColor);

        if (isHeroSidebar) {
          // ── Template "Arco": hero navy arredondado + foto sobreposta + fundo translúcido ──
          const headerNode = (
            <>
              <div
                style={{
                  background: "var(--cv-accent)",
                  color: "#fff",
                  WebkitPrintColorAdjust: "exact",
                  printColorAdjust: "exact",
                  margin: `-${padY}px -20px 0 -${padX}px`,
                  padding: "24px 16px 34px",
                  minHeight: 150,
                  boxSizing: "border-box",
                  borderRadius: `0 0 ${HERO_RADIUS}px ${HERO_RADIUS}px`,
                  textAlign: "center",
                }}
              >
                {nameBox}
              </div>
              {photoNode}
              {informacoesPessoais}
            </>
          );
          sidebarHeader = headerNode;
          sidebar = (
            <div className="space-y-4">
              {headerNode}
              {sectionsNode}
            </div>
          );
        } else {
          // ── Template "Institucional": aside já é navy (accentSurface "sidebar") ──
          const headerNode = (
            <>
              {nameBox}
              {photoNode}
              {informacoesPessoais}
            </>
          );
          sidebarHeader = headerNode;
          sidebar = (
            <div className="space-y-4" style={{ color: "#fff" }}>
              {headerNode}
              {sectionsNode}
            </div>
          );
        }
      } else {
        const itemColor = isColorSidebar ? "rgba(255,255,255,0.92)" : "var(--cv-text)";
        const mutedItemColor = isColorSidebar ? "rgba(255,255,255,0.7)" : "var(--cv-muted)";

        // "Informações pessoais": nome como 1.º item com ícone + contactos +
        // data de nascimento/género/estado civil — só quando o template pede
        // este título dedicado (estes 3 campos não aparecem em mais nenhum
        // template, mesmo que estejam preenchidos no perfil).
        const personalInfoItems: Array<{ field: string; icon: LucideIcon; text: string }> =
          template.personalInfoTitle
            ? [
                ...(perfil.nome ? [{ field: "nome", icon: User, text: perfil.nome }] : []),
                ...buildContactItems({
                  email: perfil.email,
                  telefone: perfil.telefone,
                  cidade: perfil.cidade,
                  pais: perfil.pais,
                  morada: perfil.morada,
                  linkedin: perfil.linkedin,
                  website: perfil.website,
                  cartaConducao: perfil.cartaConducao,
                  dataNascimento: perfil.dataNascimento,
                  genero: perfil.genero,
                  estadoCivil: perfil.estadoCivil,
                }),
              ]
            : contactItems;

        const photoAndPersonalInfo = (
          <div className="space-y-3">
            {perfil.foto && (
              <div style={{ display: "flex", justifyContent: "center" }}>
                <Photo size={template.photoSizeSidebar ?? PHOTO_SIZE_SIDEBAR_PX} />
              </div>
            )}
            {template.personalInfoTitle ? (
              <div>
                <SectionTitle
                  titulo="Informações pessoais"
                  icon={SECTION_ICONS.perfil}
                  light={isColorSidebar || isBlockSidebar}
                />
                <div className="mt-2">
                  <ContactList
                    items={personalInfoItems}
                    light={isColorSidebar || isBlockSidebar}
                    stacked
                  />
                </div>
              </div>
            ) : (
              <Contacto light={isColorSidebar} />
            )}
          </div>
        );

        const headerNode = isBlockSidebar ? (
          <div
            style={{
              background: "var(--cv-accent)",
              color: "#fff",
              margin: `-${padY}px -20px 0 -${padX}px`,
              padding: `${padY}px 20px 20px ${padX}px`,
            }}
          >
            {photoAndPersonalInfo}
          </div>
        ) : (
          photoAndPersonalInfo
        );
        const sectionsNode = renderSidebarEntries(isColorSidebar, itemColor, mutedItemColor);
        sidebarBlocks = buildSidebarBlocks(isColorSidebar, itemColor, mutedItemColor);

        sidebarHeader = headerNode;
        sidebar = (
          <div className="space-y-4" style={isColorSidebar ? { color: "#fff" } : undefined}>
            {headerNode}
            {sectionsNode}
          </div>
        );
      }
    }

    return { mainBlocks: blocks, sidebarHeader, sidebarBlocks, sidebar };
  }, [draft.sections, draft.sectionLayout, template, sectionGap, itemGap, isSidebar, padX, padY]);
}
