import type { CvDraft } from "@/lib/cv-types";

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

  const hasContacto =
    perfil.email || perfil.telefone || perfil.cidade || perfil.linkedin;

  return (
    <article className="mx-auto max-w-[680px] bg-paper px-10 py-12 font-serif text-[13px] leading-relaxed text-foreground shadow-card">
      <header>
        <h1 className="font-serif text-[28px] leading-tight">
          {perfil.nome || (
            <span className="text-muted-foreground">O teu nome</span>
          )}
        </h1>
        {perfil.headline && (
          <p className="mt-1 font-sans text-[13px] text-ink-soft">
            {perfil.headline}
          </p>
        )}
        {hasContacto && (
          <p className="mt-2 font-sans text-[11px] text-muted-foreground">
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
        )}
      </header>

      {perfil.resumo && (
        <Section titulo="Perfil">
          <p className="font-sans text-[13px] text-ink-soft whitespace-pre-wrap">
            {perfil.resumo}
          </p>
        </Section>
      )}

      {experiencia.length > 0 && (
        <Section titulo="Experiência profissional">
          <div className="space-y-4">
            {experiencia.map((e) => (
              <div key={e.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-sans text-[13px] font-medium text-foreground">
                    {e.cargo || "—"}
                    {e.organizacao && (
                      <span className="font-normal text-ink-soft">
                        {" "}
                        · {e.organizacao}
                      </span>
                    )}
                  </p>
                  <p className="shrink-0 font-sans text-[11px] text-muted-foreground">
                    {fmtPeriodo(e.inicio, e.fim)}
                  </p>
                </div>
                {e.local && (
                  <p className="font-sans text-[11px] text-muted-foreground">
                    {e.local}
                  </p>
                )}
                {e.descricao && (
                  <p className="mt-1 font-sans text-[12.5px] text-ink-soft whitespace-pre-wrap">
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
          <div className="space-y-3">
            {formacao.map((f) => (
              <div key={f.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-sans text-[13px] font-medium text-foreground">
                    {f.curso || "—"}
                    {f.instituicao && (
                      <span className="font-normal text-ink-soft">
                        {" "}
                        · {f.instituicao}
                      </span>
                    )}
                  </p>
                  <p className="shrink-0 font-sans text-[11px] text-muted-foreground">
                    {fmtPeriodo(f.inicio, f.fim)}
                  </p>
                </div>
                {f.descricao && (
                  <p className="mt-1 font-sans text-[12.5px] text-ink-soft whitespace-pre-wrap">
                    {f.descricao}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {competencias.length > 0 && (
        <Section titulo="Competências">
          <p className="font-sans text-[13px] text-ink-soft">
            {competencias
              .map((c) => (c.nivel ? `${c.nome} (${c.nivel})` : c.nome))
              .join(" · ")}
          </p>
        </Section>
      )}

      {idiomas.length > 0 && (
        <Section titulo="Idiomas">
          <p className="font-sans text-[13px] text-ink-soft">
            {idiomas
              .map((i) => (i.nivel ? `${i.idioma} — ${i.nivel}` : i.idioma))
              .join(" · ")}
          </p>
        </Section>
      )}

      {extras.map((sec) => (
        <Section key={sec.id} titulo={sec.titulo}>
          <div className="space-y-2">
            {sec.itens.map((it) => (
              <div key={it.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-sans text-[13px] font-medium text-foreground">
                    {it.titulo || "—"}
                  </p>
                  {it.data && (
                    <p className="shrink-0 font-sans text-[11px] text-muted-foreground">
                      {it.data}
                    </p>
                  )}
                </div>
                {it.descricao && (
                  <p className="font-sans text-[12.5px] text-ink-soft whitespace-pre-wrap">
                    {it.descricao}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      ))}
    </article>
  );
}

function Section({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="border-b border-navy-rule pb-1 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-navy">
        {titulo}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
