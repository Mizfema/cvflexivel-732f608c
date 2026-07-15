import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  Loader2,
  Lock,
} from "lucide-react";
import { FileTextInput } from "@/components/ui/file-text-input";
import { ScannerAnimation } from "@/components/ScannerAnimation";
import { InterviewPrepResult } from "@/components/InterviewPrepResult";
import { InterviewPrepExport } from "@/components/entrevista/InterviewPrepExport";
import { generateInterviewPrep } from "@/lib/llm.functions";
import { saveInterviewPrep } from "@/lib/interview-preps.functions";
import { getMyPlanStatus } from "@/lib/subscription.functions";
import { useAuth } from "@/hooks/use-auth";
import type { InterviewQuestion } from "@/lib/interview-types";
import { parseLimitError } from "@/lib/usage-error";
import { UsageLimitNotice } from "@/components/UsageLimitNotice";

const PREP_MESSAGES = [
  "A ler os Termos de Referência…",
  "A analisar a tua carta de apresentação…",
  "A cruzar a tua experiência com a vaga…",
  "A preparar perguntas comportamentais…",
  "A preparar perguntas técnicas…",
  "A identificar requisitos eliminatórios…",
  "A ancorar respostas no que realmente fizeste…",
  "Quase pronto — últimos ajustes…",
];

const PRIMARY_BTN =
  "inline-flex min-w-[140px] items-center justify-center gap-2 rounded-[10px] bg-[#1b1b19] px-5 py-2.5 text-sm font-medium text-[#F1EFE8] transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40";
const SECONDARY_BTN =
  "inline-flex items-center gap-2 rounded-[10px] border border-[#E3DFD7] px-4 py-2.5 text-sm text-[#5F5E5A] transition-colors hover:bg-black/4 hover:text-[#2C2C2A]";

export const Route = createFileRoute("/preparar-entrevista")({
  head: () => ({
    meta: [
      { title: "Preparar Entrevista — CVelite" },
      {
        name: "description",
        content:
          "Simulação de entrevista específica para a vaga: perguntas prováveis e respostas sugeridas, ancoradas apenas no teu CV e carta de apresentação.",
      },
    ],
  }),
  component: PrepararEntrevistaPage,
});

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      {msg}
    </div>
  );
}

/** Fase 1.3: interview_prep está desabilitado para anónimo e grátis na matriz
 * de acesso (access_policies) — só "premium" está habilitado. A Fase 1.4a liga
 * hasActivePlan() ao cálculo de tier; aqui só refletimos esse estado no
 * cliente para decidir entre vitrine e stepper (a verificação que importa
 * continua server-side em requireUsageAllowed). */
function PrepararEntrevistaPage() {
  const getPlanStatus = useServerFn(getMyPlanStatus);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);

  useEffect(() => {
    getPlanStatus()
      .then((r) => setIsPremium(r.isPremium))
      .catch(() => setIsPremium(false));
  }, [getPlanStatus]);

  if (isPremium === null) return null;
  return isPremium ? <InterviewPrepStepper /> : <InterviewPrepVitrine />;
}

function InterviewPrepVitrine() {
  const sampleQuestions: InterviewQuestion[] = [
    {
      categoria: "comportamental",
      pergunta: "Conta-me sobre uma vez em que tiveste de gerir prioridades conflituantes.",
      resposta_sugerida:
        "Descreve uma situação real do teu CV: o contexto, a decisão que tomaste e o resultado — ancorado no que já fizeste.",
    },
    {
      categoria: "tecnica",
      pergunta: "Que ferramentas ou metodologias usaste no projeto mais recente?",
      resposta_sugerida:
        "Liga a tua resposta a competências e ferramentas específicas já mencionadas no teu CV.",
    },
    {
      categoria: "eliminatoria",
      pergunta: "Cumpres o requisito mínimo de experiência exigido no anúncio?",
      resposta_sugerida:
        "Confirma com base nas datas reais do teu CV; se não cumprires, destaca experiência adjacente com honestidade.",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy-mid">
          Preparação de entrevista
        </p>
        <h1 className="mt-2 font-serif text-3xl text-foreground sm:text-4xl">
          Simula a tua entrevista para esta vaga
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Cola os Termos de Referência, a tua carta de apresentação e o teu CV. Recebes perguntas
          prováveis com respostas sugeridas — ancoradas apenas no que já fizeste. Esta
          funcionalidade faz parte do plano pago.
        </p>
      </header>

      <div className="relative overflow-hidden rounded-2xl border border-[#E3DFD7] bg-[#FBFAF7] p-6 sm:p-8">
        <div aria-hidden className="pointer-events-none select-none blur-[3px]">
          <InterviewPrepResult questions={sampleQuestions} />
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#FBFAF7]/40 to-[#FBFAF7] p-6 text-center">
          <Lock className="h-8 w-8 text-[#5F5E5A]" />
          <p className="max-w-sm font-serif text-lg text-foreground">
            Disponível para assinantes do plano pago
          </p>
          <Link
            to="/planos"
            className="inline-flex items-center gap-2 rounded-[10px] bg-[#1b1b19] px-5 py-2.5 text-sm font-medium text-[#F1EFE8] transition-opacity hover:opacity-90"
          >
            <Sparkles className="h-4 w-4" />
            Ver planos
          </Link>
        </div>
      </div>
    </div>
  );
}

function InterviewPrepStepper() {
  const { session } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [tdrText, setTdrText] = useState("");
  const [cartaText, setCartaText] = useState("");
  const [cvText, setCvText] = useState("");
  const [tdrFileName, setTdrFileName] = useState<string | null>(null);
  const [cartaFileName, setCartaFileName] = useState<string | null>(null);
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [processingFile, setProcessingFile] = useState(false);

  const generate = useServerFn(generateInterviewPrep);
  const mutation = useMutation<
    InterviewQuestion[],
    Error,
    { jobTdr: string; coverLetter: string; cv: string }
  >({
    mutationFn: (vars) => generate({ data: vars }) as Promise<InterviewQuestion[]>,
    onSuccess: (questions) => {
      if (session) {
        save.mutate({ cvId: null, jobTdr: tdrText, questions });
      }
    },
  });

  const saveFn = useServerFn(saveInterviewPrep);
  const save = useMutation<
    { id: string },
    Error,
    { cvId: string | null; jobTdr: string; questions: InterviewQuestion[] }
  >({
    mutationFn: (vars) => saveFn({ data: vars }) as Promise<{ id: string }>,
  });

  function resetAll() {
    setStep(1);
    setTdrText("");
    setCartaText("");
    setCvText("");
    setTdrFileName(null);
    setCartaFileName(null);
    setCvFileName(null);
    setFileError(null);
    mutation.reset();
    save.reset();
  }

  function handleSubmit() {
    const guard = (s: string) => s.startsWith("PK") || s.includes("[Content_Types].xml");
    if (guard(tdrText) || guard(cartaText) || guard(cvText)) {
      setFileError("Um dos textos contém dados binários. Remove e carrega de novo.");
      return;
    }
    setFileError(null);
    setStep(4);
    mutation.mutate({ jobTdr: tdrText, coverLetter: cartaText, cv: cvText });
  }

  const canNext1 = tdrText.trim().length >= 20 && !processingFile;
  const canNext2 = cartaText.trim().length >= 10 && !processingFile;
  const canSubmit = cvText.trim().length >= 20 && !processingFile;

  const stepLabels = ["TdR da vaga", "Carta de apresentação", "O teu CV", "Simulação"];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy-mid">
          Preparação de entrevista
        </p>
        <h1 className="mt-2 font-serif text-3xl text-foreground sm:text-4xl">
          Simula a tua entrevista para esta vaga
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Cola os Termos de Referência, a tua carta de apresentação e o teu CV. Vais receber
          perguntas prováveis com respostas sugeridas — ancoradas apenas no que já fizeste.
        </p>
      </header>

      {/* Stepper indicator */}
      <div className="mb-8 flex items-start">
        {stepLabels.map((label, i) => {
          const stepNum = (i + 1) as 1 | 2 | 3 | 4;
          const isActive = step === stepNum;
          const isDone = step > stepNum;
          return (
            <div
              key={i}
              className={`flex items-start ${i < stepLabels.length - 1 ? "flex-1" : ""}`}
            >
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 ${
                    isDone
                      ? "bg-[#1D9E75] text-white"
                      : isActive
                        ? "bg-[#1D9E75] text-white shadow-sm"
                        : "border-2 border-[#E3DFD7] bg-transparent text-[#B8B4AC]"
                  }`}
                >
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : stepNum}
                </div>
                <span
                  className={`text-[11px] font-medium whitespace-nowrap transition-colors ${
                    isActive ? "text-[#2C2C2A]" : "text-[#B8B4AC]"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < stepLabels.length - 1 && (
                <div className="flex-1 pt-4 px-3">
                  <div
                    className={`h-[1.5px] w-full rounded-full transition-colors duration-300 ${
                      isDone ? "bg-[#1D9E75]" : "bg-[#E3DFD7]"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[#E3DFD7] bg-[#FBFAF7] p-6 sm:p-8">
        {step === 1 && (
          <div className="animate-stepper-in space-y-5">
            <div>
              <h2 className="font-serif text-[20px] font-semibold text-[#2C2C2A]">
                <span className="text-[#1D9E75]">Etapa 1</span> — Termos de Referência
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#5F5E5A]">
                Cola ou carrega o anúncio completo da vaga: responsabilidades, qualificações,
                requisitos, competências desejadas.
              </p>
            </div>

            <FileTextInput
              label="TdR / anúncio da vaga"
              value={tdrText}
              onChange={(v) => {
                setTdrText(v);
                setTdrFileName(null);
                setFileError(null);
              }}
              placeholder="Cola aqui o anúncio completo da vaga: contexto, responsabilidades, qualificações exigidas, requisitos eliminatórios, competências desejadas…"
              rows={10}
              fileName={tdrFileName}
              onFileLoad={(text, name) => {
                setTdrText(text);
                setTdrFileName(name);
                setFileError(null);
              }}
              onFileClear={() => {
                setTdrFileName(null);
                setTdrText("");
              }}
              onError={setFileError}
              onLoadingChange={setProcessingFile}
            />

            {fileError && <ErrorBox msg={fileError} />}

            <div className="flex justify-end">
              <button
                disabled={!canNext1}
                onClick={() => {
                  setFileError(null);
                  setStep(2);
                }}
                className={PRIMARY_BTN}
              >
                Próximo
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-stepper-in space-y-5">
            <div>
              <h2 className="font-serif text-[20px] font-semibold text-[#2C2C2A]">
                <span className="text-[#1D9E75]">Etapa 2</span> — Carta de apresentação
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#5F5E5A]">
                Cola ou carrega a carta que vais (ou pretendes) submeter para esta vaga.
              </p>
            </div>

            <FileTextInput
              label="Carta de apresentação"
              value={cartaText}
              onChange={(v) => {
                setCartaText(v);
                setCartaFileName(null);
                setFileError(null);
              }}
              placeholder="Cola aqui o conteúdo completo da tua carta de apresentação…"
              rows={10}
              fileName={cartaFileName}
              onFileLoad={(text, name) => {
                setCartaText(text);
                setCartaFileName(name);
                setFileError(null);
              }}
              onFileClear={() => {
                setCartaFileName(null);
                setCartaText("");
              }}
              onError={setFileError}
              onLoadingChange={setProcessingFile}
            />

            {fileError && <ErrorBox msg={fileError} />}

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className={SECONDARY_BTN}>
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>
              <button
                disabled={!canNext2}
                onClick={() => {
                  setFileError(null);
                  setStep(3);
                }}
                className={PRIMARY_BTN}
              >
                Próximo
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-stepper-in space-y-5">
            <div>
              <h2 className="font-serif text-[20px] font-semibold text-[#2C2C2A]">
                <span className="text-[#1D9E75]">Etapa 3</span> — O teu CV
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#5F5E5A]">
                Cola ou carrega o teu CV actual. As respostas sugeridas só vão usar o que estiver
                aqui e na carta — nunca inventamos experiência.
              </p>
            </div>

            <FileTextInput
              label="O teu CV"
              value={cvText}
              onChange={(v) => {
                setCvText(v);
                setCvFileName(null);
                setFileError(null);
              }}
              placeholder="Cola aqui o conteúdo completo do teu CV: dados pessoais, resumo, experiência, formação, competências…"
              rows={10}
              fileName={cvFileName}
              onFileLoad={(text, name) => {
                setCvText(text);
                setCvFileName(name);
                setFileError(null);
              }}
              onFileClear={() => {
                setCvFileName(null);
                setCvText("");
              }}
              onError={setFileError}
              onLoadingChange={setProcessingFile}
            />

            {fileError && <ErrorBox msg={fileError} />}
            {mutation.isError &&
              (parseLimitError(mutation.error) ? (
                <UsageLimitNotice feature="interview_prep" {...parseLimitError(mutation.error)!} />
              ) : (
                <ErrorBox msg={mutation.error.message} />
              ))}

            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className={SECONDARY_BTN}>
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>
              <button disabled={!canSubmit} onClick={handleSubmit} className={PRIMARY_BTN}>
                Gerar simulação
                <Sparkles className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="animate-stepper-in">
            {mutation.isError ? (
              <div className="flex flex-col items-center py-8 px-4 text-center space-y-4">
                <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-destructive/10">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
                <div className="w-full max-w-md">
                  <p className="font-serif text-lg text-foreground">Falha ao gerar a simulação</p>
                  {parseLimitError(mutation.error) ? (
                    <div className="mt-2 text-left">
                      <UsageLimitNotice
                        feature="interview_prep"
                        {...parseLimitError(mutation.error)!}
                      />
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">{mutation.error.message}</p>
                  )}
                </div>
                <div className="flex gap-2 justify-center pt-2">
                  <button
                    onClick={() => {
                      setStep(3);
                      mutation.reset();
                    }}
                    className={SECONDARY_BTN}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </button>
                  <button
                    onClick={() => {
                      mutation.reset();
                      mutation.mutate({ jobTdr: tdrText, coverLetter: cartaText, cv: cvText });
                    }}
                    className="inline-flex items-center justify-center rounded-[10px] bg-[#1b1b19] px-4 py-2 text-sm font-medium text-[#F1EFE8] transition-opacity hover:opacity-90"
                  >
                    Tentar de novo
                  </button>
                </div>
              </div>
            ) : mutation.isPending || !mutation.data ? (
              <ScannerAnimation title="A preparar a tua entrevista" messages={PREP_MESSAGES} />
            ) : (
              <div className="space-y-6">
                {session ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {save.isPending && (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> A guardar na tua conta…
                      </>
                    )}
                    {save.isSuccess && (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Guardado na tua
                        conta.
                      </>
                    )}
                    {save.isError && (
                      <>
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                        Não foi possível guardar: {save.error.message}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-lg border border-[#E3DFD7] bg-white px-3 py-2.5 text-xs text-[#5F5E5A]">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      <Link to="/auth" className="font-medium underline">
                        Inicia sessão
                      </Link>{" "}
                      para guardares esta preparação na tua conta.
                    </span>
                  </div>
                )}

                <InterviewPrepResult questions={mutation.data} />

                <div className="flex flex-wrap justify-end gap-2 border-t border-[#E3DFD7] pt-4">
                  <InterviewPrepExport questions={mutation.data} jobTdr={tdrText} />
                  <button onClick={resetAll} className={SECONDARY_BTN}>
                    Nova simulação
                  </button>
                  {session && (
                    <Link
                      to="/entrevistas"
                      className="inline-flex items-center justify-center rounded-[10px] bg-[#1b1b19] px-4 py-2 text-sm font-medium text-[#F1EFE8] transition-opacity hover:opacity-90"
                    >
                      Ver preparações guardadas
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
