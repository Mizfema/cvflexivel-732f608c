import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileText, Sparkles, MessageSquare, Compass } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CV Flexível — Alinha o teu CV à vaga" },
      {
        name: "description",
        content:
          "Descobre o que a vaga realmente avalia e alinha o teu CV. Para vagas de ONGs, desenvolvimento, consultoria e administração pública.",
      },
      { property: "og:title", content: "CV Flexível — Alinha o teu CV à vaga" },
      {
        property: "og:description",
        content:
          "Análise de cobertura honesta, modo entrevista guiada, exportação ATS. Em português.",
      },
    ],
  }),
  component: LandingPage,
});

type Porta = {
  modo: string;
  titulo: string;
  descricao: string;
  Icon: typeof FileText;
  destaque?: boolean;
  badge?: string;
};

const portas: Porta[] = [
  {
    modo: "cv-vaga",
    titulo: "Tenho CV e uma vaga em mente",
    descricao:
      "A via mais directa: cole o TdR, lê a análise de cobertura, alinha o CV.",
    Icon: Sparkles,
    destaque: true,
    badge: "Recomendado",
  },
  {
    modo: "cv",
    titulo: "Tenho CV, sem vaga",
    descricao: "Edita, melhora e exporta em formato ATS ou visual.",
    Icon: FileText,
  },
  {
    modo: "entrevista-vaga",
    titulo: "Tenho a vaga, sem CV",
    descricao: "Entrevista guiada que constrói o CV à medida do TdR.",
    Icon: MessageSquare,
  },
  {
    modo: "entrevista-zero",
    titulo: "Não tenho nada — começa do zero",
    descricao: "Respostas curtas em PT, transformadas em texto profissional.",
    Icon: Compass,
  },
];

function LandingPage() {
  return (
    <>
      {/* HERO — split-screen editorial */}
      <section className="border-b border-navy-rule">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-24">
          {/* Manifesto */}
          <div className="flex flex-col justify-center">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy-mid">
              Para o setor de desenvolvimento
            </p>
            <h1 className="mt-6 font-serif text-[2.5rem] leading-[1.05] text-foreground sm:text-5xl lg:text-[3.75rem]">
              Descobre o que a vaga{" "}
              <em className="font-serif text-navy">realmente</em> avalia —{" "}
              <span className="text-navy-deep">e alinha o teu CV.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-soft">
              Para vagas de ONGs, desenvolvimento, consultoria e administração
              pública. Em português.
            </p>

            <div className="mt-10 flex items-start gap-3 border-l-2 border-navy-mid pl-4">
              <span className="font-serif text-2xl leading-none text-navy-mid">
                ※
              </span>
              <p className="text-sm text-ink-soft">
                <span className="font-medium text-foreground">
                  Sem registo.
                </span>{" "}
                Nesta fase nem te pedimos o CV. Escolhe a porta de entrada à
                direita.
              </p>
            </div>

            <div className="mt-10 hidden items-center gap-6 text-xs uppercase tracking-[0.18em] text-muted-foreground lg:flex">
              <span>Análise honesta</span>
              <span className="h-px w-8 bg-navy-rule" />
              <span>ATS-friendly</span>
              <span className="h-px w-8 bg-navy-rule" />
              <span>Moçambique + PALOP</span>
            </div>
          </div>

          {/* 4 Portas */}
          <div className="flex flex-col gap-4">
            {portas.map((porta, idx) => (
              <PortaCard key={porta.modo} porta={porta} index={idx + 1} />
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona — preview do editor */}
      <section className="border-b border-navy-rule bg-surface/40">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy-mid">
              Como funciona
            </p>
            <h2 className="mt-4 font-serif text-3xl text-foreground sm:text-4xl">
              Editor à esquerda, CV à direita.{" "}
              <em className="text-navy">Tudo ao vivo.</em>
            </h2>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              Cada secção que editas atualiza imediatamente a pré-visualização.
              Análise de cobertura quando há TdR. Exportação em PDF e DOCX com
              texto real, legível por parsers ATS — nunca screenshot.
            </p>
          </div>

          <EditorPreview />
        </div>
      </section>

      {/* Faixa credibilidade */}
      <section className="bg-navy-deep text-paper">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <p className="font-serif text-3xl">ReliefWeb</p>
              <p className="mt-2 text-sm text-paper/70">
                Vagas do setor para Moçambique, atualizadas. Data de fecho
                sempre visível.
              </p>
            </div>
            <div>
              <p className="font-serif text-3xl">Análise honesta</p>
              <p className="mt-2 text-sm text-paper/70">
                Cobertura X de Y requisitos — sem inventar probabilidades de
                entrevista.
              </p>
            </div>
            <div>
              <p className="font-serif text-3xl">PT primeiro</p>
              <p className="mt-2 text-sm text-paper/70">
                Interface, perguntas e geração de texto em português europeu.
                Versão EN mais tarde.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function PortaCard({ porta, index }: { porta: Porta; index: number }) {
  const { Icon } = porta;
  const numero = String(index).padStart(2, "0");

  if (porta.destaque) {
    return (
      <Link
        to="/editor"
        search={{ modo: porta.modo }}
        className="group relative block overflow-hidden rounded-lg border border-navy-deep bg-navy-deep p-7 text-paper shadow-elevated transition-all hover:bg-navy"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-paper/50">{numero}</span>
            {porta.badge && (
              <span className="rounded-full border border-paper/30 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-paper/80">
                {porta.badge}
              </span>
            )}
          </div>
          <Icon className="h-5 w-5 text-paper/70" strokeWidth={1.5} />
        </div>
        <h3 className="mt-6 font-serif text-2xl leading-tight text-paper">
          {porta.titulo}
        </h3>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-paper/75">
          {porta.descricao}
        </p>
        <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-paper">
          Começar
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-1"
            strokeWidth={2}
          />
        </div>
      </Link>
    );
  }

  return (
    <Link
      to="/editor"
      search={{ modo: porta.modo }}
      className="group relative block rounded-lg border border-navy-rule bg-card p-5 transition-all hover:border-navy hover:shadow-card"
    >
      <div className="flex items-start gap-4">
        <span className="mt-0.5 font-mono text-xs text-muted-foreground">
          {numero}
        </span>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-serif text-lg leading-snug text-foreground">
              {porta.titulo}
            </h3>
            <Icon
              className="mt-1 h-4 w-4 shrink-0 text-navy-mid"
              strokeWidth={1.5}
            />
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            {porta.descricao}
          </p>
        </div>
        <ArrowRight
          className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-foreground"
          strokeWidth={1.75}
        />
      </div>
    </Link>
  );
}

function EditorPreview() {
  return (
    <div className="mt-12 grid gap-4 rounded-lg border border-navy-rule bg-card p-3 shadow-elevated lg:grid-cols-[280px_1fr]">
      {/* Sidebar do editor */}
      <aside className="rounded-md bg-surface p-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Secções
        </p>
        <ul className="mt-3 space-y-1 text-sm">
          {[
            { label: "Perfil", active: true },
            { label: "Experiência", count: 4 },
            { label: "Formação", count: 2 },
            { label: "Competências", count: 8 },
            { label: "Idiomas", count: 3 },
          ].map((item) => (
            <li
              key={item.label}
              className={`flex items-center justify-between rounded px-3 py-2 ${
                item.active
                  ? "bg-navy text-paper"
                  : "text-foreground hover:bg-paper-deep"
              }`}
            >
              <span>{item.label}</span>
              {item.count !== undefined && (
                <span
                  className={`font-mono text-xs ${
                    item.active ? "text-paper/70" : "text-muted-foreground"
                  }`}
                >
                  {item.count}
                </span>
              )}
            </li>
          ))}
        </ul>
        <button className="mt-4 w-full rounded border border-dashed border-navy-rule px-3 py-2 text-xs text-muted-foreground hover:border-navy-mid hover:text-foreground">
          + Adicionar secção
        </button>
      </aside>

      {/* CV preview */}
      <div className="rounded-md bg-paper p-8 lg:p-10">
        <div className="mx-auto max-w-md font-serif text-foreground">
          <p className="text-xs uppercase tracking-[0.2em] text-navy-mid">
            Currículo
          </p>
          <h3 className="mt-2 text-2xl">Ana Macuácua</h3>
          <p className="mt-1 font-sans text-sm text-ink-soft">
            Coordenadora de Programa — Maputo
          </p>
          <hr className="my-5 border-navy-rule" />
          <p className="font-sans text-xs uppercase tracking-[0.2em] text-navy">
            Experiência
          </p>
          <div className="mt-3 space-y-3 font-sans text-sm">
            <div>
              <p className="font-medium text-foreground">
                World Vision Moçambique
              </p>
              <p className="text-xs text-muted-foreground">
                Coordenadora de Projeto · 2022 — Atualidade
              </p>
              <p className="mt-1 text-ink-soft">
                Liderança de equipa multidisciplinar de 12 pessoas em Nampula;
                gestão de orçamento de 1.2M USD…
              </p>
            </div>
            <div className="opacity-60">
              <p className="font-medium text-foreground">UNICEF</p>
              <p className="text-xs text-muted-foreground">
                Oficial de Programa · 2019 — 2022
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
