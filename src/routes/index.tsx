import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Target, Sparkles, ArrowRight } from "lucide-react";
import { AnaliseModal } from "@/components/AnaliseModal";
import { VagaStepper } from "@/components/VagaStepper";
import { ImportCvModal } from "@/components/ImportCvModal";
import { CriarCvModal } from "@/components/CriarCvModal";
import { CvThumbnail } from "@/components/cv/CvThumbnail";
import { TEMPLATES } from "@/lib/cv-design-presets";
import { buildLandingSampleCv } from "@/lib/landing-sample-cv";
import { track } from "@/lib/analytics";
import { hasResumeState } from "@/lib/resume-state";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CVelite — Alinha o teu CV à vaga" },
      {
        name: "description",
        content:
          "Descobre o que a vaga realmente avalia e alinha o teu CV. Para vagas de ONGs, desenvolvimento, consultoria e administração pública.",
      },
      { property: "og:title", content: "CVelite — Alinha o teu CV à vaga" },
      {
        property: "og:description",
        content:
          "Análise de cobertura honesta, modo entrevista guiada, exportação ATS. Em português.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const [criarOpen, setCriarOpen] = useState(false);
  const [analiseOpen, setAnaliseOpen] = useState(false);
  const [vagaOpen, setVagaOpen] = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);

  // Ao voltar de /auth a meio de uma análise iniciada na home, reabrir o
  // modal — ele próprio repõe o texto colado e o resultado já gerado.
  useEffect(() => {
    if (hasResumeState("analise-modal")) setAnaliseOpen(true);
  }, []);

  function handleCriarClick() {
    track("cta_click", { cta: "criar_cv_gratis" });
    setCriarOpen(true);
  }

  function handleAnalisarClick() {
    track("cta_click", { cta: "analisar_cv" });
    setAnaliseOpen(true);
  }

  function handleVagaClick() {
    track("cta_click", { cta: "cv_para_vaga" });
    setVagaOpen(true);
  }

  function handleEscolherZero() {
    window.localStorage.removeItem("cv-flexivel:draft");
    navigate({ to: "/editor" });
  }

  function handleEscolherMelhorar() {
    setImportarOpen(true);
  }

  return (
    <>
      <section className="border-b border-navy-rule overflow-hidden">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div className="relative flex items-center justify-center min-h-[420px] sm:min-h-[500px] lg:min-h-[580px] order-2 lg:order-1">
            <CvMockupFan />
          </div>

          <div className="flex flex-col justify-center order-1 lg:order-2">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy-mid">
              CVelite
            </p>
            <h1 className="mt-3 font-serif text-3xl leading-tight text-foreground sm:text-4xl lg:text-[2.75rem]">
              O teu próximo <em className="font-serif text-navy">CV, alinhado.</em>
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft max-w-md">
              Cria, melhora ou alinha o teu CV a uma vaga específica. Sem custo para começar.
            </p>

            <div className="mt-8">
              <button
                onClick={handleCriarClick}
                className="group relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-xl bg-navy px-6 py-5 text-left shadow-elevated transition-all duration-300 hover:shadow-[0_12px_32px_rgba(30,58,95,0.28)] hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 cursor-pointer"
              >
                <span className="flex items-center gap-3.5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/12">
                    <Sparkles className="h-5 w-5 text-white" strokeWidth={1.75} />
                  </span>
                  <span>
                    <span className="block font-serif text-lg text-white leading-snug">
                      Criar meu CV grátis
                    </span>
                    <span className="block text-[13px] text-white/70 mt-0.5">
                      Do zero ou a partir do que já tens
                    </span>
                  </span>
                </span>
                <ArrowRight
                  className="h-5 w-5 shrink-0 text-white/80 transition-transform duration-300 group-hover:translate-x-1"
                  strokeWidth={1.75}
                />
              </button>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SecundariaButton
                  Icon={Search}
                  label="Analisar meu CV"
                  onClick={handleAnalisarClick}
                />
                <SecundariaButton
                  Icon={Target}
                  label="CV para uma vaga"
                  onClick={handleVagaClick}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <TemplateGallery />

      <CriarCvModal
        open={criarOpen}
        onOpenChange={setCriarOpen}
        onEscolherZero={handleEscolherZero}
        onEscolherMelhorar={handleEscolherMelhorar}
      />
      <AnaliseModal open={analiseOpen} onOpenChange={setAnaliseOpen} />
      <VagaStepper open={vagaOpen} onOpenChange={setVagaOpen} />
      <ImportCvModal open={importarOpen} onOpenChange={setImportarOpen} />
    </>
  );
}

/* ── Botão secundário do hero ── */

function SecundariaButton({
  Icon,
  label,
  onClick,
}: {
  Icon: typeof Search;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center justify-center gap-2.5 rounded-xl border border-navy-rule bg-card px-4 py-3.5 text-sm font-medium text-foreground transition-all duration-200 hover:border-navy/40 hover:bg-navy/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 cursor-pointer"
    >
      <Icon
        className="h-4 w-4 text-navy-mid transition-colors duration-200 group-hover:text-navy"
        strokeWidth={1.75}
      />
      {label}
    </button>
  );
}

/* ── Prova visual: grelha de templates com previews reais ── */

function TemplateGallery() {
  return (
    <section className="border-b border-navy-rule">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:py-20">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy-mid">Modelos</p>
        <h2 className="mt-2 font-serif text-2xl leading-tight text-foreground sm:text-3xl">
          Escolhe o visual, o conteúdo é sempre teu
        </h2>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {TEMPLATES.map((template) => (
            <div key={template.id} className="group flex flex-col items-center gap-2.5">
              <div className="w-full overflow-hidden rounded-lg shadow-elevated transition-transform duration-300 group-hover:-translate-y-1 flex justify-center bg-white">
                <CvThumbnail draft={buildLandingSampleCv(template.id)} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">{template.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {template.tipo === "ats" ? "Optimizado para ATS" : "Visual"}
                  {template.isPremium && " · Premium"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
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
                    {
                      org: "CARE Internacional",
                      role: "Técnico de Projeto",
                      period: "2016 — 2019",
                    },
                  ]
            ).map((exp, i) => (
              <div key={i}>
                <div className="flex items-center justify-between">
                  <p className="text-[6px] font-semibold text-gray-700">{exp.org}</p>
                  <p className="text-[4.5px] text-gray-400">{exp.period}</p>
                </div>
                <p className="text-[5px] text-gray-500 mt-[1px]">{exp.role}</p>
                <div className="mt-[2px] space-y-[2px]">
                  <div
                    className="h-[1.5px] rounded-full w-full"
                    style={{ backgroundColor: "#e8e8e8" }}
                  />
                  <div
                    className="h-[1.5px] rounded-full w-[85%]"
                    style={{ backgroundColor: "#e8e8e8" }}
                  />
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
