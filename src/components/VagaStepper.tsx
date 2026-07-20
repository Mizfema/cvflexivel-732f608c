import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
} from "lucide-react";
import { Modal, ModalTitle } from "@/components/ui/modal";
import { FileTextInput } from "@/components/ui/file-text-input";
import { ScannerAnimation } from "@/components/ScannerAnimation";
import { alignCvToTdr } from "@/lib/llm.functions";
import { DRAFT_KEY } from "@/hooks/use-draft-cv";
import { EMPTY_CV } from "@/lib/cv-types";
import type { AlignmentResult } from "@/lib/cv-types";
import { parseLimitError } from "@/lib/usage-error";
import { UsageLimitNotice } from "@/components/UsageLimitNotice";
import { SIDEBAR_STATUS_QUERY_KEY } from "@/components/AppSidebar";

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

interface VagaStepperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VagaStepper({ open, onOpenChange }: VagaStepperProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [tdrText, setTdrText] = useState("");
  const [cvText, setCvText] = useState("");
  const [tdrFileName, setTdrFileName] = useState<string | null>(null);
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const align = useServerFn(alignCvToTdr);
  const queryClient = useQueryClient();
  const mutation = useMutation<AlignmentResult, Error, { cv: string; jobTdr: string }>({
    mutationFn: (vars) => align({ data: vars }) as Promise<AlignmentResult>,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: SIDEBAR_STATUS_QUERY_KEY });
      const draft = {
        ...EMPTY_CV,
        title: "CV alinhado à vaga",
        sections: { ...EMPTY_CV.sections, ...result.sections },
        updatedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      if (result.alteracoes.length > 0) {
        window.localStorage.setItem(
          "cv-flexivel:align-changes",
          JSON.stringify(result.alteracoes),
        );
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

  const canNext1 = tdrText.trim().length >= 20 && !processing;
  const canNext2 = cvText.trim().length >= 20 && !processing;

  const stepLabels = ["TdR da vaga", "O teu CV", "Alinhamento"];

  return (
    <Modal open={open} onOpenChange={handleClose} className="max-w-2xl">
      {/* Stepper indicator */}
      <div className="mb-7 flex items-start">
        {stepLabels.map((label, i) => {
          const stepNum = (i + 1) as 1 | 2 | 3;
          const isActive = step === stepNum;
          const isDone = step > stepNum;
          return (
            <div key={i} className={`flex items-start ${i < 2 ? "flex-1" : ""}`}>
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
              {i < 2 && (
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

      {/* Step 1: TdR */}
      {step === 1 && (
        <div className="animate-stepper-in space-y-5">
          <div>
            <ModalTitle className="font-serif text-[20px] font-semibold text-[#2C2C2A]">
              <span className="text-[#1D9E75]">Etapa 1</span> — Termos de Referência
            </ModalTitle>
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
            onLoadingChange={setProcessing}
          />

          {fileError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {fileError}
            </div>
          )}

          <div className="flex justify-end">
            <button
              disabled={!canNext1}
              onClick={() => {
                setFileError(null);
                setStep(2);
              }}
              className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-[10px] bg-[#1b1b19] px-5 py-2.5 text-sm font-medium text-[#F1EFE8] transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
            >
              Próximo
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: CV */}
      {step === 2 && (
        <div className="animate-stepper-in space-y-5">
          <div>
            <ModalTitle className="font-serif text-[20px] font-semibold text-[#2C2C2A]">
              <span className="text-[#1D9E75]">Etapa 2</span> — O teu CV actual
            </ModalTitle>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#5F5E5A]">
              Cola ou carrega o teu CV actual. A IA vai reescrevê-lo para casar com os
              requisitos da vaga — sem inventar experiência.
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
            onLoadingChange={setProcessing}
          />

          {fileError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {fileError}
            </div>
          )}

          {mutation.isError &&
            (parseLimitError(mutation.error) ? (
              <UsageLimitNotice feature="align_cv_tdr" {...parseLimitError(mutation.error)!} />
            ) : (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {mutation.error.message}
              </div>
            ))}

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 rounded-[10px] border border-[#E3DFD7] px-4 py-2.5 text-sm text-[#5F5E5A] transition-colors hover:bg-black/4 hover:text-[#2C2C2A]"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </button>
            <button
              disabled={!canNext2}
              onClick={handleSubmit}
              className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-[10px] bg-[#1b1b19] px-5 py-2.5 text-sm font-medium text-[#F1EFE8] transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
            >
              Alinhar CV
              <Sparkles className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: processamento / erro */}
      {step === 3 && (
        <div className="animate-stepper-in">
          {mutation.isError ? (
            <div className="flex flex-col items-center py-8 px-4 text-center space-y-4">
              <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-destructive/10">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
              <div className="w-full max-w-md">
                <p className="font-serif text-lg text-foreground">Falha no alinhamento</p>
                {parseLimitError(mutation.error) ? (
                  <div className="mt-2 text-left">
                    <UsageLimitNotice
                      feature="align_cv_tdr"
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
                    setStep(2);
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
                    mutation.mutate({ cv: cvText, jobTdr: tdrText });
                  }}
                  className="inline-flex items-center justify-center rounded-[10px] bg-[#1b1b19] px-4 py-2 text-sm font-medium text-[#F1EFE8] transition-opacity hover:opacity-90"
                >
                  Tentar de novo
                </button>
              </div>
            </div>
          ) : (
            <ScannerAnimation title="A alinhar o teu CV" messages={ALIGN_MESSAGES} />
          )}
        </div>
      )}
    </Modal>
  );
}
