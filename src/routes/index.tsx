import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import {
  Search, Target, PenLine, FilePlus, ArrowRight, ArrowLeft,
  Upload, Loader2, X, FileText, AlertTriangle,
  CheckCircle2, XCircle, Lightbulb, ShieldAlert, Sparkles,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { analyzeCoverage, alignCvToTdr } from "@/lib/llm.functions";
import { DRAFT_KEY } from "@/hooks/use-draft-cv";
import { EMPTY_CV } from "@/lib/cv-types";
import type { AlignmentResult } from "@/lib/cv-types";
import type { CoverageAnalysis, GapDetail, GapType } from "@/lib/coverage-types";

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

  function handleAcaoClick(id: string) {
    if (id === "analisar") {
      setAnaliseOpen(true);
    } else if (id === "vaga") {
      setVagaOpen(true);
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
    </>
  );
}

/* ── Stepper: CV para uma vaga ── */

const ALIGN_MESSAGES = [
  "A ler os Termos de Referência…",
  "A mapear requisitos obrigatórios e desejáveis…",
  "A analisar a tua experiência…",
  "A reformular títulos e descrições…",
  "A reordenar secções por relevância…",
  "A ajustar o resumo profissional à vaga…",
  "A priorizar competências-chave…",
  "A verificar que nada foi inventado…",
  "Quase pronto — últimos ajustes…",
];

function VagaStepper({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [tdrText, setTdrText] = useState("");
  const [cvText, setCvText] = useState("");
  const [tdrFileName, setTdrFileName] = useState<string | null>(null);
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const tdrFileRef = useRef<HTMLInputElement>(null);
  const cvFileRef = useRef<HTMLInputElement>(null);

  const align = useServerFn(alignCvToTdr);
  const mutation = useMutation<AlignmentResult, Error, { cv: string; jobTdr: string }>({
    mutationFn: (vars) => align({ data: vars }) as Promise<AlignmentResult>,
    onSuccess: (result) => {
      const draft = {
        ...EMPTY_CV,
        title: "CV alinhado à vaga",
        sections: { ...EMPTY_CV.sections, ...result.sections },
        updatedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      if (result.alteracoes.length > 0) {
        window.localStorage.setItem("cv-flexivel:align-changes", JSON.stringify(result.alteracoes));
      }
      navigate({ to: "/editor", search: { modo: "cv-vaga" } });
      onOpenChange(false);
    },
  });

  function resetAll() {
    setStep(1);
    setTdrText("");
    setCvText("");
    setTdrFileName(null);
    setCvFileName(null);
    setFileError(null);
    setProcessing(false);
    mutation.reset();
  }

  function handleClose(v: boolean) {
    if (!v && !mutation.isPending) {
      onOpenChange(false);
      resetAll();
    } else {
      onOpenChange(v);
    }
  }

  async function handleFileUpload(
    file: File,
    setText: (v: string) => void,
    setName: (v: string | null) => void,
  ) {
    setFileError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    try {
      setProcessing(true);
      let text: string;
      if (ext === "docx") {
        const mammoth = await import("mammoth");
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else if (ext === "pdf") {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pages: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          pages.push(content.items.map((it: any) => it.str).join(" "));
        }
        text = pages.join("\n\n");
      } else {
        text = await file.text();
      }
      if (text.startsWith("PK") || text.includes("[Content_Types].xml")) {
        setFileError(`O ficheiro "${file.name}" contém dados binários. Tenta .txt ou .docx.`);
        return;
      }
      const trimmed = text.trim();
      if (!trimmed) {
        setFileError(`O ficheiro "${file.name}" está vazio.`);
        return;
      }
      setName(file.name);
      setText(trimmed);
    } catch (err) {
      setFileError(`Erro ao ler "${file.name}": ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setProcessing(false);
    }
  }

  function handleSubmit() {
    const guard = (s: string) => s.startsWith("PK") || s.includes("[Content_Types].xml");
    if (guard(cvText) || guard(tdrText)) {
      setFileError("Um dos textos contém dados binários. Remove e carrega de novo.");
      return;
    }
    setFileError(null);
    setStep(3);
    mutation.mutate({ cv: cvText, jobTdr: tdrText });
  }

  const stepLabels = ["TdR da vaga", "O teu CV", "Alinhamento"];
  const canNext1 = tdrText.trim().length >= 20 && !processing;
  const canNext2 = cvText.trim().length >= 20 && !processing;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Stepper indicator */}
        <div className="flex items-center gap-2 mb-6">
          {stepLabels.map((label, i) => {
            const stepNum = (i + 1) as 1 | 2 | 3;
            const isActive = step === stepNum;
            const isDone = step > stepNum;
            return (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 ${
                      isDone
                        ? "bg-emerald-500 text-white"
                        : isActive
                        ? "bg-[#1a5454] text-white shadow-md"
                        : "bg-paper-deep text-muted-foreground"
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : stepNum}
                  </div>
                  <span
                    className={`text-xs font-medium truncate transition-colors ${
                      isActive ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {i < 2 && (
                  <div
                    className={`h-[2px] flex-1 rounded-full transition-colors duration-300 ${
                      isDone ? "bg-emerald-400" : "bg-navy-rule"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 1: TdR */}
        {step === 1 && (
          <div className="animate-stepper-in space-y-5">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">
                <span className="text-[#1a5454]">Etapa 1</span> — Termos de Referência
              </DialogTitle>
              <DialogDescription>
                Cola ou carrega o anúncio completo da vaga: responsabilidades, qualificações,
                requisitos, competências desejadas.
              </DialogDescription>
            </DialogHeader>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  TdR / anúncio da vaga
                </label>
                <div className="flex items-center gap-2">
                  {tdrFileName && (
                    <span className="flex items-center gap-1 text-xs text-navy-mid">
                      <FileText className="h-3 w-3" />
                      {tdrFileName}
                      <button onClick={() => { setTdrFileName(null); setTdrText(""); }} className="hover:text-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => tdrFileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-navy-rule px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-navy-mid hover:text-foreground"
                  >
                    <Upload className="h-3 w-3" />
                    Carregar ficheiro
                  </button>
                  <input
                    ref={tdrFileRef}
                    type="file"
                    accept=".txt,.docx,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f, setTdrText, setTdrFileName);
                    }}
                  />
                </div>
              </div>
              <Textarea
                value={tdrText}
                onChange={(e) => { setTdrText(e.target.value); setTdrFileName(null); setFileError(null); }}
                rows={10}
                placeholder="Cola aqui o anúncio completo da vaga: contexto, responsabilidades, qualificações exigidas, requisitos eliminatórios, competências desejadas…"
                className="font-mono text-[13px] resize-none"
              />
              <p className="mt-1 text-xs text-muted-foreground text-right">{tdrText.length} caracteres</p>
            </div>

            {processing && (
              <div className="flex items-center gap-2 rounded-md border border-navy-rule bg-surface/40 p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                A extrair texto do ficheiro…
              </div>
            )}
            {fileError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {fileError}
              </div>
            )}

            <div className="flex justify-end">
              <Button disabled={!canNext1} onClick={() => { setFileError(null); setStep(2); }} className="min-w-[140px]">
                Próximo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: CV */}
        {step === 2 && (
          <div className="animate-stepper-in space-y-5">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">
                <span className="text-[#1a5454]">Etapa 2</span> — O teu CV actual
              </DialogTitle>
              <DialogDescription>
                Cola ou carrega o teu CV actual. A IA vai reescrevê-lo para casar com os
                requisitos da vaga — sem inventar experiência.
              </DialogDescription>
            </DialogHeader>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  O teu CV
                </label>
                <div className="flex items-center gap-2">
                  {cvFileName && (
                    <span className="flex items-center gap-1 text-xs text-navy-mid">
                      <FileText className="h-3 w-3" />
                      {cvFileName}
                      <button onClick={() => { setCvFileName(null); setCvText(""); }} className="hover:text-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => cvFileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-navy-rule px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-navy-mid hover:text-foreground"
                  >
                    <Upload className="h-3 w-3" />
                    Carregar ficheiro
                  </button>
                  <input
                    ref={cvFileRef}
                    type="file"
                    accept=".txt,.docx,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f, setCvText, setCvFileName);
                    }}
                  />
                </div>
              </div>
              <Textarea
                value={cvText}
                onChange={(e) => { setCvText(e.target.value); setCvFileName(null); setFileError(null); }}
                rows={10}
                placeholder="Cola aqui o conteúdo completo do teu CV: dados pessoais, resumo, experiência, formação, competências…"
                className="font-mono text-[13px] resize-none"
              />
              <p className="mt-1 text-xs text-muted-foreground text-right">{cvText.length} caracteres</p>
            </div>

            {processing && (
              <div className="flex items-center gap-2 rounded-md border border-navy-rule bg-surface/40 p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                A extrair texto do ficheiro…
              </div>
            )}
            {fileError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {fileError}
              </div>
            )}

            {mutation.isError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {mutation.error.message}
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <Button disabled={!canNext2} onClick={handleSubmit} className="min-w-[140px]">
                Alinhar CV
                <Sparkles className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Processing */}
        {step === 3 && (
          <div className="animate-stepper-in">
            {mutation.isError ? (
              <div className="flex flex-col items-center py-8 px-4 text-center space-y-4">
                <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-destructive/10">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
                <div>
                  <p className="font-serif text-lg text-foreground">Falha no alinhamento</p>
                  <p className="mt-2 text-sm text-muted-foreground max-w-md">{mutation.error.message}</p>
                </div>
                <div className="flex gap-2 justify-center pt-2">
                  <Button variant="outline" onClick={() => { setStep(2); mutation.reset(); }}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                  </Button>
                  <Button onClick={() => { mutation.reset(); mutation.mutate({ cv: cvText, jobTdr: tdrText }); }}>
                    Tentar de novo
                  </Button>
                </div>
              </div>
            ) : (
              <ScannerAnimation
                title="A alinhar o teu CV"
                messages={ALIGN_MESSAGES}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Modal de análise ── */

function AnaliseModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [cvText, setCvText] = useState("");
  const [tdrText, setTdrText] = useState("");
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [tdrFileName, setTdrFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const cvFileRef = useRef<HTMLInputElement>(null);
  const tdrFileRef = useRef<HTMLInputElement>(null);

  const analyze = useServerFn(analyzeCoverage);
  const mutation = useMutation<CoverageAnalysis, Error, { cv: string; jobTdr: string }>({
    mutationFn: (vars) => analyze({ data: vars }) as Promise<CoverageAnalysis>,
  });

  async function handleFileUpload(
    file: File,
    setText: (v: string) => void,
    setName: (v: string | null) => void,
  ) {
    setFileError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

    try {
      setProcessing(true);
      let text: string;

      if (ext === "docx") {
        const mammoth = await import("mammoth");
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else if (ext === "pdf") {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pages: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          pages.push(content.items.map((it: any) => it.str).join(" "));
        }
        text = pages.join("\n\n");
      } else {
        text = await file.text();
      }

      if (text.startsWith("PK") || text.includes("[Content_Types].xml")) {
        setFileError(
          `O ficheiro "${file.name}" não foi extraído correctamente — parece conter dados binários em vez de texto. Tenta exportar como .txt ou .docx e carrega de novo.`,
        );
        return;
      }

      const trimmed = text.trim();
      if (!trimmed) {
        setFileError(`O ficheiro "${file.name}" está vazio ou não contém texto legível.`);
        return;
      }

      setName(file.name);
      setText(trimmed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFileError(`Erro ao ler "${file.name}": ${msg}`);
    } finally {
      setProcessing(false);
    }
  }

  function handleClose(v: boolean) {
    if (!v && !mutation.isPending) {
      onOpenChange(false);
      if (!mutation.data) {
        setCvText("");
        setTdrText("");
        setCvFileName(null);
        setTdrFileName(null);
        setFileError(null);
        mutation.reset();
      }
    } else {
      onOpenChange(v);
    }
  }

  const canSubmit = cvText.trim().length >= 20 && tdrText.trim().length >= 20 && !mutation.isPending && !processing;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={mutation.isPending || mutation.data ? "max-w-3xl max-h-[90vh] overflow-y-auto" : "max-w-2xl max-h-[90vh] overflow-y-auto"}>
        {mutation.isPending ? (
          <ScannerAnimation />
        ) : mutation.data ? (
          <>
            <ResultadoCompleto data={mutation.data} />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => mutation.reset()}>
                Nova análise
              </Button>
              <Button onClick={() => handleClose(false)}>Fechar</Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Analisar cobertura do CV</DialogTitle>
              <DialogDescription>
                Cola ou carrega o teu CV e os Termos de Referência da vaga. A análise compara ambos e
                mostra requisitos cobertos e em falta.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 mt-2">
              {/* CV input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    O teu CV
                  </label>
                  <div className="flex items-center gap-2">
                    {cvFileName && (
                      <span className="flex items-center gap-1 text-xs text-navy-mid">
                        <FileText className="h-3 w-3" />
                        {cvFileName}
                        <button
                          onClick={() => { setCvFileName(null); setCvText(""); }}
                          className="hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => cvFileRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-md border border-navy-rule px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-navy-mid hover:text-foreground"
                    >
                      <Upload className="h-3 w-3" />
                      Carregar ficheiro
                    </button>
                    <input
                      ref={cvFileRef}
                      type="file"
                      accept=".txt,.docx,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(f, setCvText, setCvFileName);
                      }}
                    />
                  </div>
                </div>
                <Textarea
                  value={cvText}
                  onChange={(e) => { setCvText(e.target.value); setCvFileName(null); setFileError(null); }}
                  rows={6}
                  placeholder="Cola aqui o conteúdo completo do teu CV: dados pessoais, resumo, experiência, formação, competências…"
                  className="font-mono text-[13px] resize-none"
                />
                <p className="mt-1 text-xs text-muted-foreground text-right">{cvText.length} caracteres</p>
              </div>

              {/* TdR input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Termos de Referência (TdR)
                  </label>
                  <div className="flex items-center gap-2">
                    {tdrFileName && (
                      <span className="flex items-center gap-1 text-xs text-navy-mid">
                        <FileText className="h-3 w-3" />
                        {tdrFileName}
                        <button
                          onClick={() => { setTdrFileName(null); setTdrText(""); }}
                          className="hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => tdrFileRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-md border border-navy-rule px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-navy-mid hover:text-foreground"
                    >
                      <Upload className="h-3 w-3" />
                      Carregar ficheiro
                    </button>
                    <input
                      ref={tdrFileRef}
                      type="file"
                      accept=".txt,.docx,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(f, setTdrText, setTdrFileName);
                      }}
                    />
                  </div>
                </div>
                <Textarea
                  value={tdrText}
                  onChange={(e) => { setTdrText(e.target.value); setTdrFileName(null); setFileError(null); }}
                  rows={6}
                  placeholder="Cola aqui o anúncio completo da vaga: contexto, responsabilidades, qualificações exigidas, requisitos eliminatórios, competências desejadas…"
                  className="font-mono text-[13px] resize-none"
                />
                <p className="mt-1 text-xs text-muted-foreground text-right">{tdrText.length} caracteres</p>
              </div>

              {processing && (
                <div className="flex items-center gap-2 rounded-md border border-navy-rule bg-surface/40 p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  A extrair texto do ficheiro…
                </div>
              )}

              {fileError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {fileError}
                </div>
              )}

              {mutation.isError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {mutation.error.message}
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  disabled={!canSubmit}
                  onClick={() => {
                    const guard = (s: string) => s.startsWith("PK") || s.includes("[Content_Types].xml");
                    if (guard(cvText) || guard(tdrText)) {
                      setFileError("Um dos textos contém dados binários em vez de texto legível. Remove e carrega de novo como .txt ou .docx.");
                      return;
                    }
                    setFileError(null);
                    mutation.mutate({ cv: cvText, jobTdr: tdrText });
                  }}
                  className="min-w-[140px]"
                >
                  Analisar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Scanner animation (durante processamento) ── */

const SCANNER_MESSAGES = [
  "A ler o teu CV…",
  "A extrair competências e experiência…",
  "A comparar com os requisitos da vaga…",
  "A identificar palavras-chave…",
  "A calcular cobertura por secção…",
  "A verificar requisitos eliminatórios…",
  "A preparar o relatório…",
];

function ScannerAnimation({
  title = "A analisar o teu CV",
  messages = SCANNER_MESSAGES,
}: {
  title?: string;
  messages?: string[];
} = {}) {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % messages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div className="flex flex-col items-center py-8 px-4">
      {/* Mini CV being scanned */}
      <div className="relative w-[200px] h-[280px] rounded-lg border border-navy-rule bg-white shadow-elevated overflow-hidden animate-scanner-pulse">
        {/* Scan line */}
        <div className="absolute left-0 right-0 h-[2px] animate-scanner-sweep z-20">
          <div className="h-full bg-navy-mid animate-scanner-glow" />
          <div className="absolute inset-x-0 -top-6 h-12 bg-gradient-to-b from-transparent via-navy-mid/10 to-transparent" />
        </div>

        {/* Mock CV content */}
        <div className="flex h-full">
          {/* Sidebar */}
          <div className="w-[56px] shrink-0 bg-navy-deep flex flex-col items-center pt-5 pb-3">
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-[9px] font-bold text-white/70">
              CV
            </div>
            <div className="mt-4 w-full px-2 space-y-[4px]">
              {[100, 75, 85, 55, 90].map((w, i) => (
                <div key={i}>
                  <div className="h-[2px] bg-white/10 rounded-full" />
                  <div className="h-[2px] bg-white/30 rounded-full -mt-[2px]" style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-auto w-full px-2 space-y-[3px]">
              {[1, 2, 3].map((_, i) => (
                <div key={i} className="h-[2px] bg-white/15 rounded-full" style={{ width: `${80 - i * 15}%` }} />
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-3 pt-4 space-y-3">
            <div>
              <div className="h-[8px] bg-gray-300 rounded w-[70%]" />
              <div className="h-[5px] bg-gray-200 rounded w-[50%] mt-1.5" />
            </div>
            <div className="h-[1px] bg-gray-200" />
            <div className="space-y-[3px]">
              <div className="h-[4px] bg-navy-deep/10 rounded w-[40%]" />
              <div className="h-[3px] bg-gray-200 rounded w-full" />
              <div className="h-[3px] bg-gray-200 rounded w-[90%]" />
              <div className="h-[3px] bg-gray-200 rounded w-[80%]" />
            </div>
            <div className="space-y-[3px]">
              <div className="h-[4px] bg-navy-deep/10 rounded w-[55%]" />
              <div className="h-[3px] bg-gray-200 rounded w-full" />
              <div className="h-[3px] bg-gray-200 rounded w-[85%]" />
            </div>
            <div className="space-y-[3px]">
              <div className="h-[4px] bg-navy-deep/10 rounded w-[45%]" />
              <div className="h-[3px] bg-gray-200 rounded w-[75%]" />
              <div className="h-[3px] bg-gray-200 rounded w-full" />
              <div className="h-[3px] bg-gray-200 rounded w-[60%]" />
            </div>
            <div className="space-y-[3px]">
              <div className="h-[4px] bg-navy-deep/10 rounded w-[35%]" />
              <div className="h-[3px] bg-gray-200 rounded w-[90%]" />
              <div className="h-[3px] bg-gray-200 rounded w-[70%]" />
            </div>
          </div>
        </div>
      </div>

      {/* Status text */}
      <div className="mt-8 text-center">
        <p className="font-serif text-lg text-foreground">{title}</p>
        <p
          key={msgIndex}
          className="mt-2 text-sm text-navy-mid animate-result-fade-up"
        >
          {messages[msgIndex]}
        </p>
        <div className="mt-4 flex justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-navy-mid animate-scanner-glow"
              style={{ animationDelay: `${i * 0.3}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Resultado completo ── */

function ResultadoCompleto({ data }: { data: CoverageAnalysis }) {
  const pct = data.totalRequisitos
    ? Math.round((data.requisitosCobertos / data.totalRequisitos) * 100)
    : 0;
  const pctColor = pct >= 70 ? "text-emerald-600" : pct >= 40 ? "text-amber-600" : "text-destructive";
  const ringColor = pct >= 70 ? "stroke-emerald-600" : pct >= 40 ? "stroke-amber-600" : "stroke-destructive";

  return (
    <div className="space-y-5">
      {/* Hero: percentagem + resumo */}
      <div className="animate-result-fade-up flex flex-col items-center text-center pt-4 pb-2">
        {/* Circular gauge */}
        <div className="relative w-28 h-28">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r="52" fill="none" strokeWidth="8" className="stroke-paper-deep" />
            <circle
              cx="60" cy="60" r="52" fill="none" strokeWidth="8" strokeLinecap="round"
              className={`${ringColor} transition-all duration-1000 ease-out`}
              strokeDasharray={`${2 * Math.PI * 52}`}
              strokeDashoffset={`${2 * Math.PI * 52 * (1 - pct / 100)}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`font-serif text-3xl font-bold animate-pct-count ${pctColor}`}>
              {pct}%
            </span>
          </div>
        </div>
        <p className="mt-3 text-xs font-medium uppercase tracking-wider text-navy-mid">
          {data.requisitosCobertos} de {data.totalRequisitos} requisitos cobertos
        </p>
        <p className="mt-3 max-w-lg text-sm text-ink-soft leading-relaxed">{data.resumo}</p>
      </div>

      {/* Eliminatórios */}
      {data.requisitosEliminatoriosNaoCumpridos.length > 0 && (
        <div className="animate-result-fade-up rounded-xl border border-destructive/25 bg-gradient-to-br from-destructive/5 to-transparent p-5" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
              <ShieldAlert className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <h3 className="font-serif text-base text-foreground">Requisitos eliminatórios não cumpridos</h3>
              <p className="text-xs text-muted-foreground">Atenção obrigatória antes de candidatar</p>
            </div>
          </div>
          <div className="space-y-3">
            {data.requisitosEliminatoriosNaoCumpridos.map((r, i) => (
              <div key={i} className="rounded-lg bg-white/60 border border-destructive/10 p-3">
                <p className="text-sm font-medium text-foreground flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  {r.requisito}
                </p>
                <div className="mt-2 ml-6 flex items-start gap-1.5 text-sm text-ink-soft">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  {r.mitigacao}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cobertura por secção */}
      <div className="animate-result-fade-up rounded-xl border border-navy-rule bg-card p-5" style={{ animationDelay: "0.2s" }}>
        <h3 className="font-serif text-base text-foreground mb-4">Cobertura por secção</h3>
        <div className="space-y-4">
          {data.cobertura.map((c, i) => {
            const barPct = Math.round((c.score / 3) * 100);
            const barColor =
              c.score === 3 ? "bg-emerald-500" :
              c.score === 2 ? "bg-amber-400" :
              c.score === 1 ? "bg-amber-500" : "bg-red-400";
            const label = ["Ausente", "Fraco", "Parcial", "Coberto"][c.score];
            const labelColor =
              c.score === 3 ? "text-emerald-700 bg-emerald-50 border-emerald-200" :
              c.score === 2 ? "text-amber-700 bg-amber-50 border-amber-200" :
              c.score === 1 ? "text-amber-800 bg-amber-100 border-amber-300" :
              "text-red-700 bg-red-50 border-red-200";

            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-foreground">{c.secao}</span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${labelColor}`}>
                    {label}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-paper-deep">
                  <div
                    className={`h-full rounded-full ${barColor} transition-all duration-700 ease-out`}
                    style={{ width: `${barPct}%`, animation: "result-bar-fill 0.8s ease-out" }}
                  />
                </div>
                {c.presentes.length > 0 && (
                  <div className="mt-2 text-xs">
                    <span className="flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      {c.presentes.join(" · ")}
                    </span>
                  </div>
                )}
                {c.emFalta.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {c.emFalta.map((gap, gi) => (
                      <GapItem key={gi} gap={gap} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Keywords */}
      <div className="animate-result-fade-up grid gap-4 sm:grid-cols-2" style={{ animationDelay: "0.3s" }}>
        <div className="rounded-xl border border-navy-rule bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Keywords encontradas
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.keywords.presentes.length === 0
              ? <span className="text-sm text-muted-foreground">Nenhuma keyword identificada</span>
              : data.keywords.presentes.map((k, i) => (
                  <span key={i} className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                    {k}
                  </span>
                ))
            }
          </div>
        </div>
        <div className="rounded-xl border border-navy-rule bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Keywords em falta
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.keywords.emFalta.length === 0
              ? <span className="text-sm text-muted-foreground">Nenhuma keyword em falta</span>
              : data.keywords.emFalta.map((k, i) => (
                  <span key={i} className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                    {k}
                  </span>
                ))
            }
          </div>
        </div>
      </div>

      {/* Plano de acção agrupado por tipo */}
      <GapActionPlan cobertura={data.cobertura} />
    </div>
  );
}

/* ── Gap items e plano de acção ── */

const GAP_CONFIG: Record<GapType, { label: string; color: string; borderColor: string; bgColor: string; icon: typeof CheckCircle2 }> = {
  tem_nao_mostrou: {
    label: "Tens — falta destacar",
    color: "text-blue-700",
    borderColor: "border-blue-200",
    bgColor: "bg-blue-50",
    icon: CheckCircle2,
  },
  parcial_transferivel: {
    label: "Experiência adjacente",
    color: "text-amber-700",
    borderColor: "border-amber-200",
    bgColor: "bg-amber-50",
    icon: ArrowRight,
  },
  lacuna_real: {
    label: "Lacuna real",
    color: "text-red-700",
    borderColor: "border-red-200",
    bgColor: "bg-red-50",
    icon: XCircle,
  },
};

function GapItem({ gap }: { gap: GapDetail }) {
  const cfg = GAP_CONFIG[gap.tipo];
  const Icon = cfg.icon;

  return (
    <div className={`flex items-start gap-2 rounded-md border ${cfg.borderColor} ${cfg.bgColor} px-2.5 py-1.5 text-xs`}>
      <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${cfg.color}`} />
      <div className="min-w-0">
        <span className={`font-medium ${cfg.color}`}>{gap.requisito}</span>
        <span className={`ml-1.5 inline-flex items-center rounded px-1 py-px text-[10px] font-medium ${cfg.color} ${cfg.bgColor} border ${cfg.borderColor}`}>
          {cfg.label}
        </span>
      </div>
    </div>
  );
}

function GapActionPlan({ cobertura }: { cobertura: CoverageAnalysis["cobertura"] }) {
  const allGaps = cobertura.flatMap((c) =>
    c.emFalta.map((gap) => ({ ...gap, secao: c.secao })),
  );

  if (allGaps.length === 0) return null;

  const grouped: Record<GapType, typeof allGaps> = {
    tem_nao_mostrou: allGaps.filter((g) => g.tipo === "tem_nao_mostrou"),
    parcial_transferivel: allGaps.filter((g) => g.tipo === "parcial_transferivel"),
    lacuna_real: allGaps.filter((g) => g.tipo === "lacuna_real"),
  };

  const sections: { tipo: GapType; title: string; subtitle: string; icon: typeof Lightbulb; items: typeof allGaps }[] = [
    {
      tipo: "tem_nao_mostrou",
      title: "Reformula o que já tens",
      subtitle: "O teu CV tem evidência — só precisa de ser destacada",
      icon: CheckCircle2,
      items: grouped.tem_nao_mostrou,
    },
    {
      tipo: "parcial_transferivel",
      title: "Recontextualiza experiência adjacente",
      subtitle: "Tens experiência relacionada que pode ser reposicionada",
      icon: ArrowRight,
      items: grouped.parcial_transferivel,
    },
    {
      tipo: "lacuna_real",
      title: "Lacunas reais — vias legítimas",
      subtitle: "Sem evidência no CV — não adiciones o que não existe",
      icon: ShieldAlert,
      items: grouped.lacuna_real,
    },
  ];

  return (
    <div className="animate-result-fade-up space-y-4" style={{ animationDelay: "0.4s" }}>
      {sections
        .filter((s) => s.items.length > 0)
        .map((s) => {
          const cfg = GAP_CONFIG[s.tipo];
          return (
            <div key={s.tipo} className={`rounded-xl border ${cfg.borderColor} p-5`}>
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${cfg.bgColor}`}>
                  <s.icon className={`h-4 w-4 ${cfg.color}`} />
                </div>
                <div>
                  <h3 className="font-serif text-base text-foreground">{s.title}</h3>
                  <p className="text-xs text-muted-foreground">{s.subtitle}</p>
                </div>
              </div>
              <div className="space-y-2.5">
                {s.items.map((gap, i) => (
                  <div key={i} className={`rounded-lg ${cfg.bgColor}/60 border ${cfg.borderColor}/60 p-3`}>
                    <p className="text-sm font-medium text-foreground">
                      <span className="text-muted-foreground">{gap.secao} →</span> {gap.requisito}
                    </p>
                    <p className="mt-1.5 text-sm text-ink-soft flex items-start gap-1.5">
                      <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                      {gap.accao_sugerida}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
    </div>
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
              <span className="inline-block w-[4px] h-[4px] rounded-full" style={{ backgroundColor: `${sidebarColor}40` }} />
              {email}
            </span>
            <span className="text-[5px] text-gray-400">{location}</span>
          </div>
        </div>

        <div className="w-full h-[1px] my-1.5" style={{ backgroundColor: `${sidebarColor}20` }} />

        <div>
          <p className="text-[5.5px] font-bold uppercase tracking-[0.12em]" style={{ color: sidebarColor }}>
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
          <p className="text-[5.5px] font-bold uppercase tracking-[0.12em]" style={{ color: sidebarColor }}>
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
          <p className="text-[5.5px] font-bold uppercase tracking-[0.12em]" style={{ color: sidebarColor }}>
            Formação Académica
          </p>
          <div className="mt-1 space-y-1">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[5.5px] font-semibold text-gray-600">
                  {variant === 1 ? "Mestrado em Gestão" : variant === 2 ? "Mestrado em Estatística" : "Licenciatura em RI"}
                </p>
                <p className="text-[4.5px] text-gray-400">
                  {variant === 1 ? "2014" : variant === 2 ? "2016" : "2015"}
                </p>
              </div>
              <p className="text-[4.5px] text-gray-400">
                {variant === 1 ? "Universidade Eduardo Mondlane" : variant === 2 ? "Universidade Pedagógica" : "ISCTEM"}
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[5.5px] font-semibold text-gray-600">
                  {variant === 1 ? "Licenciatura em Economia" : variant === 2 ? "Lic. Matemática Aplicada" : "Cert. Gestão de Projectos"}
                </p>
                <p className="text-[4.5px] text-gray-400">
                  {variant === 1 ? "2011" : variant === 2 ? "2012" : "2017"}
                </p>
              </div>
              <p className="text-[4.5px] text-gray-400">
                {variant === 1 ? "UEM — Faculdade de Economia" : variant === 2 ? "Universidade Lúrio" : "PMI / Online"}
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
                style={{ backgroundColor: `${sidebarColor}${i === 0 ? "30" : i === 1 ? "20" : "15"}` }}
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
        <h3 className="font-serif text-base leading-snug text-foreground group-hover:text-[var(--hover-color)] transition-colors duration-300"
          style={{ "--hover-color": acao.color } as React.CSSProperties}
        >
          {acao.titulo}
        </h3>
        <p className="mt-1 text-sm text-ink-soft leading-relaxed">{acao.descricao}</p>
      </div>

      <div
        className="relative mt-2.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 group-hover:translate-x-1"
      >
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
