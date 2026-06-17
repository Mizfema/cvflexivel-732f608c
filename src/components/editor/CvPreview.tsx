import type { CSSProperties } from "react";
import type { CvDraft } from "@/lib/cv-types";
import { designToCssVars, getTemplate } from "@/lib/cv-design-presets";

function fmtPeriodo(inicio?: string, fim?: string) {
  const i = inicio || "";
  const f = fim || "";
  if (!i && !f) return "";
  if (i && f) return `${i} — ${f}`;
  return i || f;
}

export function CvPreview({ draft }: { draft: CvDraft }) {
  const { perfil, experiencia, formacao, competencias, idiomas, extras } =
    draft.sections;
  const template = getTemplate(draft.template);
  const style = designToCssVars(draft.design) as CSSProperties;

  const hasContacto =
    perfil.email || perfil.telefone || perfil.cidade || perfil.linkedin;

  // Estilos derivados via CSS vars
  const headerTitle = `text-[calc(var(--cv-base-size)*2.15)] leading-tight`;
  const sectionLabel =
    template.headerStyle === "underline"
      ? "border-b pb-1 text-[10px] font-semibold uppercase tracking-[0.2em]"
      : template.headerStyle === "accent"
        ? "text-[10px] font-semibold uppercase tracking-[0.22em]"
        : "text-[10px] font-medium uppercase tracking-[0.18em]";

  const Section = ({
    titulo,
    children,
  }: {
    titulo: string;
    children: React.ReactNode;
  }) => (
    <section style={{ marginTop: "var(--cv-section-gap)" }}>
      <h2
        className={sectionLabel}
        style={{
          color: "var(--cv-accent)",
          borderColor: "var(--cv-rule)",
        }}
      >
        {titulo}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );

  const Contacto = () =>
    hasContacto ? (
      <p
        className="text-[11px]"
        style={{ color: "var(--cv-muted)" }}
      >
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
          .join(template.layout === "sidebar" ? " · " : " · ")}
      </p>
    ) : null;

  const MainContent = (
    <>
      {perfil.resumo && (
        <Section titulo="Perfil">
          <p
            className="whitespace-pre-wrap"
            style={{ color: "var(--cv-text)" }}
          >
            {perfil.resumo}
          </p>
        </Section>
      )}

      {experiencia.length > 0 && (
        <Section titulo="Experiência profissional">
          <div style={{ display: "grid", gap: "var(--cv-item-gap)" }}>
            {experiencia.map((e) => (
              <div key={e.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <p
                    className="font-medium"
                    style={{ color: "var(--cv-text)" }}
                  >
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
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--cv-muted)" }}
                  >
                    {e.local}
                  </p>
                )}
                {e.descricao && (
                  <p
                    className="mt-1 whitespace-pre-wrap"
                    style={{ color: "var(--cv-text)" }}
                  >
                    {e.descricao}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {formacao.length > 0 && (
        <Section titulo="Formação">
          <div style={{ display: "grid", gap: "var(--cv-item-gap)" }}>
            {formacao.map((f) => (
              <div key={f.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <p
                    className="font-medium"
                    style={{ color: "var(--cv-text)" }}
                  >
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
                {f.descricao && (
                  <p
                    className="mt-1 whitespace-pre-wrap"
                    style={{ color: "var(--cv-text)" }}
                  >
                    {f.descricao}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {template.layout === "single" && competencias.length > 0 && (
        <Section titulo="Competências">
          <p style={{ color: "var(--cv-text)" }}>
            {competencias
              .map((c) => (c.nivel ? `${c.nome} (${c.nivel})` : c.nome))
              .join(" · ")}
          </p>
        </Section>
      )}

      {template.layout === "single" && idiomas.length > 0 && (
        <Section titulo="Idiomas">
          <p style={{ color: "var(--cv-text)" }}>
            {idiomas
              .map((i) => (i.nivel ? `${i.idioma} — ${i.nivel}` : i.idioma))
              .join(" · ")}
          </p>
        </Section>
      )}

      {extras.map((sec) => (
        <Section key={sec.id} titulo={sec.titulo}>
          <div style={{ display: "grid", gap: "calc(var(--cv-item-gap) * 0.6)" }}>
            {sec.itens.map((it) => (
              <div key={it.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <p
                    className="font-medium"
                    style={{ color: "var(--cv-text)" }}
                  >
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
                {it.descricao && (
                  <p
                    className="whitespace-pre-wrap"
                    style={{ color: "var(--cv-text)" }}
                  >
                    {it.descricao}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      ))}
    </>
  );

  const Sidebar = (
    <aside
      className="space-y-4"
      style={{
        paddingRight: "20px",
        borderRight: `1px solid var(--cv-rule)`,
      }}
    >
      <Contacto />
      {competencias.length > 0 && (
        <div>
          <h2
            className={sectionLabel}
            style={{
              color: "var(--cv-accent)",
              borderColor: "var(--cv-rule)",
            }}
          >
            Competências
          </h2>
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
          <h2
            className={sectionLabel}
            style={{
              color: "var(--cv-accent)",
              borderColor: "var(--cv-rule)",
            }}
          >
            Idiomas
          </h2>
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
    </aside>
  );

  return (
    <article
      data-cv-print
      className="mx-auto max-w-[720px] bg-paper shadow-card"
      style={{
        ...style,
        fontFamily: "var(--cv-font)",
        fontSize: "var(--cv-base-size)",
        lineHeight: "var(--cv-line-height)",
        color: "var(--cv-text)",
        padding: "var(--cv-padding)",
      }}
    >
      <header
        style={{
          borderBottom:
            template.headerStyle === "underline"
              ? `2px solid var(--cv-accent)`
              : "none",
          paddingBottom:
            template.headerStyle === "underline" ? "10px" : "0",
        }}
      >
        <h1
          className={headerTitle}
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
          <p
            className="mt-1"
            style={{ color: "var(--cv-accent-soft)" }}
          >
            {perfil.headline}
          </p>
        )}
        {template.layout === "single" && hasContacto && (
          <div className="mt-2">
            <Contacto />
          </div>
        )}
      </header>

      {template.layout === "sidebar" ? (
        <div
          className="mt-5 grid gap-6"
          style={{ gridTemplateColumns: "200px 1fr" }}
        >
          {Sidebar}
          <div>{MainContent}</div>
        </div>
      ) : (
        MainContent
      )}
    </article>
  );
}
