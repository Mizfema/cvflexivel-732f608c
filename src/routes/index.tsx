import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Target, PenLine, FilePlus, ArrowRight } from "lucide-react";
import { AnaliseModal } from "@/components/AnaliseModal";
import { VagaStepper } from "@/components/VagaStepper";
import { ImportCvModal } from "@/components/ImportCvModal";

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

type Acao = {
  id: string;
  titulo: string;
  descricao: string;
  Icon: typeof Search;
  color: string;
  bgFrom: string;
  bgTo: string;
};

const acoes: Acao[] = [
  {
    id: "analisar",
    titulo: "Quero analisar meu CV",
    descricao:
      "Faz upload do teu CV e recebe uma análise detalhada com sugestões.",
    Icon: Search,
    color: "#1e3a5f",
    bgFrom: "from-[#1e3a5f]",
    bgTo: "to-[#2d5a8e]",
  },
  {
    id: "vaga",
    titulo: "Quero CV para uma vaga específica",
    descricao:
      "Cola o anúncio da vaga e cria um CV alinhado aos requisitos.",
    Icon: Target,
    color: "#1a5454",
    bgFrom: "from-[#1a5454]",
    bgTo: "to-[#247a7a]",
  },
  {
    id: "melhorar",
    titulo: "Tenho CV, quero apenas melhorar",
    descricao:
      "Edita e aperfeiçoa o teu CV existente com ferramentas profissionais.",
    Icon: PenLine,
    color: "#6b2142",
    bgFrom: "from-[#6b2142]",
    bgTo: "to-[#943060]",
  },
  {
    id: "zero",
    titulo: "CV do zero",
    descricao:
      "Começa com um editor vazio e constrói o teu CV passo a passo.",
    Icon: FilePlus,
    color: "#3d4f1e",
    bgFrom: "from-[#3d4f1e]",
    bgTo: "to-[#5a7a2e]",
  },
];

function LandingPage() {
  const [analiseOpen, setAnaliseOpen] = useState(false);
  const [vagaOpen, setVagaOpen] = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);

  function handleAcaoClick(id: string) {
    if (id === "analisar") {
      setAnaliseOpen(true);
    } else if (id === "vaga") {
      setVagaOpen(true);
    } else if (id === "melhorar") {
      setImportarOpen(true);
    } else {
      alert(`"${acoes.find((a) => a.id === id)?.titulo}" — será implementado nas próximas fases.`);
    }
  }

  return (
    <>
      <section className="border-b border-navy-rule overflow-hidden">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div className="relative flex items-center justify-center min-h-[420px] sm:min-h-[500px] lg:min-h-[580px]">
            <CvMockupFan />
          </div>

          <div className="flex flex-col justify-center">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy-mid">
              Escolhe o teu caminho
            </p>
            <h1 className="mt-3 font-serif text-3xl leading-tight text-foreground sm:text-4xl lg:text-[2.75rem]">
              O que precisas{" "}
              <em className="font-serif text-navy">hoje?</em>
            </h1>
            <div className="mt-8 flex flex-col gap-3">
              {acoes.map((acao) => (
                <AcaoCard key={acao.id} acao={acao} onClick={handleAcaoClick} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <AnaliseModal open={analiseOpen} onOpenChange={setAnaliseOpen} />
      <VagaStepper open={vagaOpen} onOpenChange={setVagaOpen} />
      <ImportCvModal open={importarOpen} onOpenChange={setImportarOpen} />
    </>
  );
}

/* ── Mockups de CV em leque ── */

function CvMockupFan() {
  return (
    <div className="relative w-full max-w-[440px] h-[480px] lg:h-[540px] scale-[0.72] sm:scale-[0.85] lg:scale-100">
      <div
        className="absolute left-[0%] top-[12%] animate-cv-fade-in"
        style={{ animationDelay: "0s", zIndex: 10 }}
      >
        <div className="animate-cv-float" style={{ animationDelay: "0s" }}>
          <CvMockup
            sidebarColor="#1e3a5f"
            accentColor="#2d5a8e"
            name="João Mutola"
            initials="JM"
            title="Gestor de Projectos"
            email="j.mutola@email.co.mz"
            location="Maputo"
            rotation={-8}
            variant={1}
          />
        </div>
      </div>

      <div
        className="absolute right-[0%] top-[6%] animate-cv-fade-in"
        style={{ animationDelay: "0.15s", zIndex: 20 }}
      >
        <div className="animate-cv-float" style={{ animationDelay: "1.3s" }}>
          <CvMockup
            sidebarColor="#1a5454"
            accentColor="#247a7a"
            name="Sara Nhantumbo"
            initials="SN"
            title="Coordenadora de M&A"
            email="sara.n@ong.org"
            location="Nampula"
            rotation={6}
            variant={2}
          />
        </div>
      </div>

      <div
        className="absolute left-[13%] top-[0%] animate-cv-fade-in"
        style={{ animationDelay: "0.3s", zIndex: 30 }}
      >
        <div className="animate-cv-float" style={{ animationDelay: "2.6s" }}>
          <CvMockup
            sidebarColor="#6b2142"
            accentColor="#943060"
            name="André Macuácua"
            initials="AM"
            title="Oficial de Programa"
            email="a.macuacua@undp.org"
            location="Beira"
            rotation={-2}
            variant={3}
          />
        </div>
      </div>
    </div>
  );
}

function CvMockup({
  sidebarColor,
  accentColor,
  name,
  initials,
  title,
  email,
  location,
  rotation,
  variant,
}: {
  sidebarColor: string;
  accentColor: string;
  name: string;
  initials: string;
  title: string;
  email: string;
  location: string;
  rotation: number;
  variant: number;
}) {
  return (
    <div
      className="w-[210px] h-[310px] rounded-lg overflow-hidden shadow-elevated bg-white flex select-none"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      {/* Sidebar */}
      <div
        className="w-[66px] shrink-0 flex flex-col items-center pt-4 pb-3"
        style={{ backgroundColor: sidebarColor }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold text-white/90 ring-2 ring-white/20"
          style={{ backgroundColor: accentColor }}
        >
          {initials}
        </div>

        <div className="mt-3 w-full px-2 space-y-[5px]">
          <div className="flex items-center gap-1">
            <div className="w-[5px] h-[5px] rounded-full bg-white/40 shrink-0" />
            <div className="h-[2px] bg-white/25 rounded-full flex-1" />
          </div>
          <div className="flex items-center gap-1">
            <div className="w-[5px] h-[5px] rounded-full bg-white/40 shrink-0" />
            <div className="h-[2px] bg-white/25 rounded-full flex-1 w-3/4" />
          </div>
          <div className="flex items-center gap-1">
            <div className="w-[5px] h-[5px] rounded-full bg-white/40 shrink-0" />
            <div className="h-[2px] bg-white/25 rounded-full flex-1 w-1/2" />
          </div>
        </div>

        <div className="mt-3 w-full px-2">
          <p className="text-[4.5px] uppercase tracking-wider text-white/50 font-bold mb-1.5">
            Competências
          </p>
          <div className="space-y-[4px]">
            {[85, 70, 90, 60, 75].map((pct, i) => (
              <div key={i}>
                <div className="h-[2px] bg-white/15 rounded-full w-full" />
                <div
                  className="h-[2px] bg-white/50 rounded-full -mt-[2px]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-2.5 w-full px-2">
          <p className="text-[4.5px] uppercase tracking-wider text-white/50 font-bold mb-1.5">
            Idiomas
          </p>
          <div className="space-y-[3px]">
            {[
              { w: "100%", dots: 5 },
              { w: "80%", dots: 4 },
              { w: "60%", dots: 3 },
            ].map((lang, i) => (
              <div key={i} className="flex items-center gap-[2px]">
                <div className="h-[2px] bg-white/25 rounded-full flex-1" />
                <div className="flex gap-[1.5px]">
                  {Array.from({ length: 5 }).map((_, d) => (
                    <div
                      key={d}
                      className={`w-[3px] h-[3px] rounded-full ${
                        d < lang.dots ? "bg-white/60" : "bg-white/15"
                      }`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto w-full px-2">
          <p className="text-[4.5px] uppercase tracking-wider text-white/50 font-bold mb-1">
            Referências
          </p>
          <div className="space-y-[3px]">
            <div>
              <div className="h-[2px] bg-white/30 rounded-full w-[80%]" />
              <div className="h-[2px] bg-white/15 rounded-full w-[60%] mt-[2px]" />
            </div>
            <div>
              <div className="h-[2px] bg-white/30 rounded-full w-[70%]" />
              <div className="h-[2px] bg-white/15 rounded-full w-[55%] mt-[2px]" />
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-2.5 pt-3 flex flex-col overflow-hidden">
        <div>
          <p className="text-[10px] font-bold text-gray-800 leading-tight">{name}</p>
          <p className="text-[6.5px] font-medium mt-[1px]" style={{ color: sidebarColor }}>
            {title}
          </p>
          <div className="flex items-center gap-2 mt-[3px]">
            <span className="text-[5px] text-gray-400 flex items-center gap-[2px]">
              <span
                className="inline-block w-[4px] h-[4px] rounded-full"
                style={{ backgroundColor: `${sidebarColor}40` }}
              />
              {email}
            </span>
            <span className="text-[5px] text-gray-400">{location}</span>
          </div>
        </div>

        <div className="w-full h-[1px] my-1.5" style={{ backgroundColor: `${sidebarColor}20` }} />

        <div>
          <p
            className="text-[5.5px] font-bold uppercase tracking-[0.12em]"
            style={{ color: sidebarColor }}
          >
            Resumo Profissional
          </p>
          <div className="mt-1 space-y-[2.5px]">
            <div className="h-[2px] bg-gray-200 rounded-full" />
            <div className="h-[2px] bg-gray-200 rounded-full w-[95%]" />
            <div className="h-[2px] bg-gray-200 rounded-full w-[80%]" />
            <div className="h-[2px] bg-gray-200 rounded-full w-[88%]" />
          </div>
        </div>

        <div className="mt-2">
          <p
            className="text-[5.5px] font-bold uppercase tracking-[0.12em]"
            style={{ color: sidebarColor }}
          >
            Experiência Profissional
          </p>
          <div className="mt-1 space-y-1.5">
            {(variant === 1
              ? [
                  { org: "UNICEF Moçambique", role: "Gestor Sénior", period: "2021 — Atual" },
                  { org: "World Vision", role: "Coordenador", period: "2018 — 2021" },
                  { org: "Save the Children", role: "Oficial de Projecto", period: "2015 — 2018" },
                ]
              : variant === 2
              ? [
                  { org: "UNDP", role: "Coord. de M&A", period: "2020 — Atual" },
                  { org: "OIM Moçambique", role: "Analista de Dados", period: "2017 — 2020" },
                  { org: "Cruz Vermelha", role: "Assistente M&A", period: "2014 — 2017" },
                ]
              : [
                  { org: "PNUD Moçambique", role: "Oficial de Programa", period: "2022 — Atual" },
                  { org: "Oxfam", role: "Coord. de Campo", period: "2019 — 2022" },
                  { org: "CARE Internacional", role: "Técnico de Projeto", period: "2016 — 2019" },
                ]
            ).map((exp, i) => (
              <div key={i}>
                <div className="flex items-center justify-between">
                  <p className="text-[6px] font-semibold text-gray-700">{exp.org}</p>
                  <p className="text-[4.5px] text-gray-400">{exp.period}</p>
                </div>
                <p className="text-[5px] text-gray-500 mt-[1px]">{exp.role}</p>
                <div className="mt-[2px] space-y-[2px]">
                  <div className="h-[1.5px] rounded-full w-full" style={{ backgroundColor: "#e8e8e8" }} />
                  <div className="h-[1.5px] rounded-full w-[85%]" style={{ backgroundColor: "#e8e8e8" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-2">
          <p
            className="text-[5.5px] font-bold uppercase tracking-[0.12em]"
            style={{ color: sidebarColor }}
          >
            Formação Académica
          </p>
          <div className="mt-1 space-y-1">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[5.5px] font-semibold text-gray-600">
                  {variant === 1
                    ? "Mestrado em Gestão"
                    : variant === 2
                    ? "Mestrado em Estatística"
                    : "Licenciatura em RI"}
                </p>
                <p className="text-[4.5px] text-gray-400">
                  {variant === 1 ? "2014" : variant === 2 ? "2016" : "2015"}
                </p>
              </div>
              <p className="text-[4.5px] text-gray-400">
                {variant === 1
                  ? "Universidade Eduardo Mondlane"
                  : variant === 2
                  ? "Universidade Pedagógica"
                  : "ISCTEM"}
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[5.5px] font-semibold text-gray-600">
                  {variant === 1
                    ? "Licenciatura em Economia"
                    : variant === 2
                    ? "Lic. Matemática Aplicada"
                    : "Cert. Gestão de Projectos"}
                </p>
                <p className="text-[4.5px] text-gray-400">
                  {variant === 1 ? "2011" : variant === 2 ? "2012" : "2017"}
                </p>
              </div>
              <p className="text-[4.5px] text-gray-400">
                {variant === 1
                  ? "UEM — Faculdade de Economia"
                  : variant === 2
                  ? "Universidade Lúrio"
                  : "PMI / Online"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-1.5">
          <div className="flex gap-1">
            {[1, 2, 3].map((_, i) => (
              <div
                key={i}
                className="flex-1 h-[4px] rounded-full"
                style={{
                  backgroundColor: `${sidebarColor}${i === 0 ? "30" : i === 1 ? "20" : "15"}`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Cartão de ação ── */

function AcaoCard({ acao, onClick }: { acao: Acao; onClick: (id: string) => void }) {
  const { Icon } = acao;

  return (
    <button
      onClick={() => onClick(acao.id)}
      className="group relative flex items-start gap-4 rounded-xl border border-navy-rule/60 bg-card p-5 text-left transition-all duration-300 hover:border-transparent hover:shadow-elevated hover:-translate-y-0.5 cursor-pointer overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 rounded-xl"
        style={{
          background: `linear-gradient(135deg, ${acao.color}08, ${acao.color}03)`,
          boxShadow: `inset 0 0 0 1.5px ${acao.color}30`,
        }}
      />

      <div
        className="relative mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-md"
        style={{
          background: `linear-gradient(135deg, ${acao.color}12, ${acao.color}06)`,
          border: `1px solid ${acao.color}18`,
        }}
      >
        <Icon
          className="h-5 w-5 transition-colors duration-300"
          style={{ color: acao.color }}
          strokeWidth={1.75}
        />
      </div>

      <div className="relative flex-1 min-w-0">
        <h3
          className="font-serif text-base leading-snug text-foreground group-hover:text-[var(--hover-color)] transition-colors duration-300"
          style={{ "--hover-color": acao.color } as React.CSSProperties}
        >
          {acao.titulo}
        </h3>
        <p className="mt-1 text-sm text-ink-soft leading-relaxed">{acao.descricao}</p>
      </div>

      <div className="relative mt-2.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 group-hover:translate-x-1">
        <div
          className="absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ backgroundColor: `${acao.color}12` }}
        />
        <ArrowRight
          className="h-4 w-4 text-muted-foreground transition-colors duration-300 group-hover:text-foreground relative z-10"
          strokeWidth={1.75}
        />
      </div>
    </button>
  );
}
