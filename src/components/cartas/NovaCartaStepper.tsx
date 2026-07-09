import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  XCircle,
  Sparkles,
  PenLine,
  Target,
  Copy,
  FileText,
  Clock,
} from "lucide-react";
import { Modal, ModalTitle } from "@/components/ui/modal";
import { FileTextInput } from "@/components/ui/file-text-input";
import { ScannerAnimation } from "@/components/ScannerAnimation";
import { listCvs, getCv } from "@/lib/cvs.functions";
import { listRecentTdrs } from "@/lib/recent-tdrs.functions";
import { generateCoverLetter } from "@/lib/llm.functions";
import { writePendingCoverLetterDraft } from "@/lib/cover-letter-draft";
import type { CoverLetterMode, GeneratedCoverLetter, RecentTdr } from "@/lib/cover-letter-types";
import { toSafeHtml } from "@/lib/rich-text";
import { parseLimitError } from "@/lib/usage-error";
import { UsageLimitNotice } from "@/components/UsageLimitNotice";

type Path = "zero" | "targeted" | "generic";
type Step = "path" | "cv" | "tdr" | "generating" | "amostra";

type CvRow = { id: string; title: string; template: string; updated_at: string };
type CvChoice =
  | { kind: "saved"; id: string; title: string }
  | { kind: "pasted"; text: string; fileName: string | null };

const GENERATE_MESSAGES = [
  "A ler o teu CV…",
  "A identificar experiência relevante…",
  "A verificar que nada é inventado…",
  "A redigir o corpo da carta…",
  "A rever o tom e a estrutura…",
  "Quase pronto — últimos ajustes…",
];

function deriveTitleFromTdr(tdr: string): string {
  const firstLine = tdr
    .split("\n")
    .find((l) => l.trim())
    ?.trim();
  if (!firstLine) return "Carta de motivação";
  return firstLine.length > 60 ? `Carta — ${firstLine.slice(0, 60)}…` : `Carta — ${firstLine}`;
}

interface NovaCartaStepperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NovaCartaStepper({ open, onOpenChange }: NovaCartaStepperProps) {
  const navigate = useNavigate();
  const [path, setPath] = useState<Path | null>(null);
  const [step, setStep] = useState<Step>("path");
  const [cvChoice, setCvChoice] = useState<CvChoice | null>(null);
  const [processingFile, setProcessingFile] = useState(false);
  const [tdrText, setTdrText] = useState("");
  const [tdrFileName, setTdrFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const [cvRows, setCvRows] = useState<CvRow[] | null>(null);
  const [cvListError, setCvListError] = useState<string | null>(null);
  const [recentTdrs, setRecentTdrs] = useState<RecentTdr[] | null>(null);

  const fetchCvList = useServerFn(listCvs);
  const fetchCv = useServerFn(getCv);
  const fetchRecentTdrs = useServerFn(listRecentTdrs);
  const generate = useServerFn(generateCoverLetter);

  useEffect(() => {
    if (step !== "cv" || cvRows !== null) return;
    fetchCvList()
      .then((res) => setCvRows(res.cvs as CvRow[]))
      .catch((e) => setCvListError(e instanceof Error ? e.message : "Erro a carregar CVs"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (step !== "tdr" || recentTdrs !== null) return;
    fetchRecentTdrs()
      .then((res) => setRecentTdrs(res.tdrs))
      .catch(() => setRecentTdrs([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const mutation = useMutation<GeneratedCoverLetter, Error, void>({
    mutationFn: async () => {
      let cvContent: unknown = "";
      if (cvChoice?.kind === "saved") {
        cvContent = await fetchCv({ data: { id: cvChoice.id } });
      } else if (cvChoice?.kind === "pasted") {
        cvContent = cvChoice.text;
      }
      const mode: CoverLetterMode = path === "targeted" ? "targeted" : "generic";
      return generate({
        data: {
          cvContent,
          jobTdr: mode === "targeted" ? tdrText : undefined,
          mode,
        },
      }) as Promise<GeneratedCoverLetter>;
    },
    onSuccess: (result) => {
      if (result.hasMore) {
        setStep("amostra");
        return;
      }
      writePendingCoverLetterDraft({
        title: path === "targeted" ? deriveTitleFromTdr(tdrText) : "Carta genérica",
        content: result.content,
        jobTdr: path === "targeted" ? tdrText : null,
        cvId: cvChoice?.kind === "saved" ? cvChoice.id : null,
      });
      navigate({ to: "/carta-editor" });
      handleClose(false);
    },
  });

  function handleUseSample() {
    if (!mutation.data) return;
    writePendingCoverLetterDraft({
      title: path === "targeted" ? deriveTitleFromTdr(tdrText) : "Carta genérica",
      content: mutation.data.content,
      jobTdr: path === "targeted" ? tdrText : null,
      cvId: cvChoice?.kind === "saved" ? cvChoice.id : null,
    });
    navigate({ to: "/carta-editor" });
    handleClose(false);
  }

  function resetAll() {
    setPath(null);
    setStep("path");
    setCvChoice(null);
    setProcessingFile(false);
    setTdrText("");
    setTdrFileName(null);
    setFileError(null);
    setCvRows(null);
    setCvListError(null);
    setRecentTdrs(null);
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

  function handlePathChoice(p: Path) {
    if (p === "zero") {
      writePendingCoverLetterDraft({
        title: "Carta sem título",
        content: "",
        jobTdr: null,
        cvId: null,
      });
      navigate({ to: "/carta-editor" });
      handleClose(false);
      return;
    }
    setPath(p);
    setStep("cv");
  }

  function handleCvContinue() {
    if (path === "generic") {
      setStep("generating");
      mutation.mutate();
    } else {
      setStep("tdr");
    }
  }

  function handleGenerate() {
    const guard = (s: string) => s.startsWith("PK") || s.includes("[Content_Types].xml");
    if (guard(tdrText)) {
      setFileError("O texto do TdR contém dados binários. Remove e carrega de novo.");
      return;
    }
    setFileError(null);
    setStep("generating");
    mutation.mutate();
  }

  const canContinueCv =
    !processingFile &&
    (cvChoice?.kind === "saved" ||
      (cvChoice?.kind === "pasted" && cvChoice.text.trim().length >= 20));
  const canGenerate = tdrText.trim().length >= 20 && !processingFile;

  return (
    <Modal open={open} onOpenChange={handleClose} className="max-w-2xl">
      {step === "path" && (
        <div className="animate-stepper-in space-y-5">
          <div>
            <ModalTitle className="font-serif text-[22px] font-semibold text-[#2C2C2A]">
              Nova carta de apresentação
            </ModalTitle>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#5F5E5A]">
              Escolhe como queres começar.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <PathCard
              Icon={PenLine}
              color="#3d4f1e"
              title="Escrever do zero"
              description="Abre um editor de carta em branco."
              onClick={() => handlePathChoice("zero")}
            />
            <PathCard
              Icon={Target}
              color="#1a5454"
              title="Para uma vaga específica"
              description="Ancorada num TdR e no teu CV."
              onClick={() => handlePathChoice("targeted")}
            />
            <PathCard
              Icon={Copy}
              color="#6b2142"
              title="Carta genérica"
              description="Adaptável a qualquer vaga, a partir do teu CV."
              onClick={() => handlePathChoice("generic")}
            />
          </div>
        </div>
      )}

      {step === "cv" && (
        <div className="animate-stepper-in space-y-5">
          <div>
            <ModalTitle className="font-serif text-[20px] font-semibold text-[#2C2C2A]">
              <span className="text-[#1D9E75]">Etapa 1</span> — O teu CV
            </ModalTitle>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#5F5E5A]">
              Escolhe um CV guardado na tua conta ou carrega/cola outro do teu dispositivo.
            </p>
          </div>

          {cvListError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {cvListError}
            </div>
          )}

          {cvRows === null ? (
            <p className="text-sm text-muted-foreground">A carregar os teus CVs…</p>
          ) : cvRows.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {cvRows.map((cv) => {
                const selected = cvChoice?.kind === "saved" && cvChoice.id === cv.id;
                return (
                  <button
                    key={cv.id}
                    type="button"
                    onClick={() => setCvChoice({ kind: "saved", id: cv.id, title: cv.title })}
                    className={`rounded-[10px] border px-3.5 py-3 text-left transition-colors ${
                      selected
                        ? "border-[#1D9E75] bg-[#1D9E75]/8"
                        : "border-[#E3DFD7] bg-white hover:border-[#C5C0B8]"
                    }`}
                  >
                    <p className="truncate font-serif text-sm text-[#2C2C2A]">{cv.title}</p>
                    <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-[#9E9A94]">
                      {new Date(cv.updated_at).toLocaleDateString("pt-PT", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Ainda não tens CVs guardados.</p>
          )}

          <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
            <div className="h-px flex-1 bg-navy-rule" />
            ou carrega/cola um CV
            <div className="h-px flex-1 bg-navy-rule" />
          </div>

          <FileTextInput
            label="CV do dispositivo"
            value={cvChoice?.kind === "pasted" ? cvChoice.text : ""}
            onChange={(v) => {
              setCvChoice(v ? { kind: "pasted", text: v, fileName: null } : null);
              setFileError(null);
            }}
            placeholder="Cola aqui o conteúdo completo do teu CV…"
            rows={6}
            fileName={cvChoice?.kind === "pasted" ? cvChoice.fileName : null}
            onFileLoad={(text, name) => {
              setCvChoice({ kind: "pasted", text, fileName: name });
              setFileError(null);
            }}
            onFileClear={() => setCvChoice(null)}
            onError={setFileError}
            onLoadingChange={setProcessingFile}
          />

          {fileError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {fileError}
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={() => setStep("path")}
              className="inline-flex items-center gap-2 rounded-[10px] border border-[#E3DFD7] px-4 py-2.5 text-sm text-[#5F5E5A] transition-colors hover:bg-black/4 hover:text-[#2C2C2A]"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </button>
            <button
              disabled={!canContinueCv}
              onClick={handleCvContinue}
              className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-[10px] bg-[#1b1b19] px-5 py-2.5 text-sm font-medium text-[#F1EFE8] transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
            >
              {path === "generic" ? "Gerar carta" : "Próximo"}
              {path === "generic" ? (
                <Sparkles className="h-4 w-4" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      )}

      {step === "tdr" && (
        <div className="animate-stepper-in space-y-5">
          <div>
            <ModalTitle className="font-serif text-[20px] font-semibold text-[#2C2C2A]">
              <span className="text-[#1D9E75]">Etapa 2</span> — Termos de Referência
            </ModalTitle>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#5F5E5A]">
              Cola ou carrega o anúncio da vaga para a carta espelhar os requisitos-chave.
            </p>
          </div>

          {recentTdrs && recentTdrs.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8B84]">
                <Clock className="h-3 w-3" />
                TdRs recentes
              </p>
              <div className="max-h-[160px] space-y-1.5 overflow-y-auto">
                {recentTdrs.map((tdr, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setTdrText(tdr.texto);
                      setTdrFileName(null);
                      setFileError(null);
                    }}
                    className="w-full rounded-[10px] border border-[#E3DFD7] bg-white px-3 py-2 text-left transition-colors hover:border-[#C5C0B8]"
                  >
                    <p className="truncate text-[13px] text-[#2C2C2A]">{tdr.excerto}</p>
                    <p className="mt-0.5 text-[10.5px] uppercase tracking-[0.12em] text-[#9E9A94]">
                      {tdr.origem} ·{" "}
                      {new Date(tdr.data).toLocaleDateString("pt-PT", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <FileTextInput
            label="TdR / anúncio da vaga"
            value={tdrText}
            onChange={(v) => {
              setTdrText(v);
              setTdrFileName(null);
              setFileError(null);
            }}
            placeholder="Cola aqui o anúncio completo da vaga: contexto, responsabilidades, qualificações exigidas, requisitos eliminatórios, competências desejadas…"
            rows={8}
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

          {fileError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {fileError}
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={() => setStep("cv")}
              className="inline-flex items-center gap-2 rounded-[10px] border border-[#E3DFD7] px-4 py-2.5 text-sm text-[#5F5E5A] transition-colors hover:bg-black/4 hover:text-[#2C2C2A]"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </button>
            <button
              disabled={!canGenerate}
              onClick={handleGenerate}
              className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-[10px] bg-[#1b1b19] px-5 py-2.5 text-sm font-medium text-[#F1EFE8] transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
            >
              Gerar carta
              <Sparkles className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {step === "generating" && (
        <div className="animate-stepper-in">
          {mutation.isError ? (
            <div className="flex flex-col items-center py-8 px-4 text-center space-y-4">
              <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-destructive/10">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
              <div className="w-full max-w-md">
                <p className="font-serif text-lg text-foreground">Falha ao gerar a carta</p>
                {parseLimitError(mutation.error) ? (
                  <div className="mt-2 text-left">
                    <UsageLimitNotice
                      feature="cover_letter"
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
                    setStep(path === "targeted" ? "tdr" : "cv");
                    mutation.reset();
                  }}
                  className="inline-flex items-center gap-2 rounded-[10px] border border-[#E3DFD7] px-4 py-2 text-sm text-[#5F5E5A] transition-colors hover:bg-black/4"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </button>
                <button
                  onClick={() => {
                    mutation.reset();
                    mutation.mutate();
                  }}
                  className="inline-flex items-center justify-center rounded-[10px] bg-[#1b1b19] px-4 py-2 text-sm font-medium text-[#F1EFE8] transition-opacity hover:opacity-90"
                >
                  Tentar de novo
                </button>
              </div>
            </div>
          ) : (
            <ScannerAnimation title="A gerar a tua carta" messages={GENERATE_MESSAGES} />
          )}
        </div>
      )}

      {step === "amostra" && mutation.data && (
        <div className="animate-stepper-in space-y-5">
          <div>
            <ModalTitle className="font-serif text-[22px] font-semibold leading-snug text-[#2C2C2A] pr-8">
              A tua amostra grátis
            </ModalTitle>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#5F5E5A]">
              Contas grátis veem o primeiro parágrafo. O resto da carta faz parte do plano pago.
            </p>
          </div>

          <div className="rounded-[10px] border border-[#E3DFD7] bg-white p-4">
            <div
              className="prose-cv text-sm"
              dangerouslySetInnerHTML={{ __html: toSafeHtml(mutation.data.content) }}
            />
            <div className="relative mt-3 -mx-4 -mb-4 overflow-hidden rounded-b-[10px]">
              <div aria-hidden className="pointer-events-none select-none space-y-2 p-4 blur-[4px]">
                <div className="h-3 w-full rounded bg-[#EFEBE2]" />
                <div className="h-3 w-5/6 rounded bg-[#EFEBE2]" />
                <div className="h-3 w-4/6 rounded bg-[#EFEBE2]" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-white/40 to-white p-4">
                <span className="text-xs font-medium text-[#5F5E5A]">
                  + mais 2-3 parágrafos no plano pago
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-[#E3DFD7] pt-4 sm:flex-row sm:justify-end">
            <button
              onClick={handleUseSample}
              className="rounded-[10px] border border-[#E3DFD7] px-4 py-2 text-sm text-[#5F5E5A] transition-colors hover:bg-black/4 hover:text-[#2C2C2A]"
            >
              Usar esta amostra
            </button>
            <button
              onClick={() => navigate({ to: "/planos" })}
              className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#1b1b19] px-4 py-2 text-sm font-medium text-[#F1EFE8] transition-opacity hover:opacity-90"
            >
              <Sparkles className="h-4 w-4" />
              Assinar para gerar a carta completa
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function PathCard({
  Icon,
  color,
  title,
  description,
  onClick,
}: {
  Icon: typeof FileText;
  color: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-start gap-3 rounded-xl border border-navy-rule/60 bg-card p-5 text-left transition-all duration-300 hover:border-transparent hover:shadow-elevated hover:-translate-y-0.5 cursor-pointer overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 rounded-xl"
        style={{
          background: `linear-gradient(135deg, ${color}08, ${color}03)`,
          boxShadow: `inset 0 0 0 1.5px ${color}30`,
        }}
      />
      <div
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-md"
        style={{
          background: `linear-gradient(135deg, ${color}12, ${color}06)`,
          border: `1px solid ${color}18`,
        }}
      >
        <Icon className="h-5 w-5" style={{ color }} strokeWidth={1.75} />
      </div>
      <div className="relative">
        <h3 className="font-serif text-base leading-snug text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-ink-soft leading-relaxed">{description}</p>
      </div>
    </button>
  );
}
