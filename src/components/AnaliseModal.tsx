import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lightbulb,
  ShieldAlert,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Modal, ModalTitle } from "@/components/ui/modal";
import { FileTextInput } from "@/components/ui/file-text-input";
import { ScannerAnimation } from "@/components/ScannerAnimation";
import { analyzeCoverage } from "@/lib/llm.functions";
import type { CoverageAnalysis, GapDetail, GapType } from "@/lib/coverage-types";
import { parseLimitError } from "@/lib/usage-error";
import { UsageLimitNotice } from "@/components/UsageLimitNotice";
import { SIDEBAR_STATUS_QUERY_KEY } from "@/components/AppSidebar";

/* ── Tipos de gap ── */

const GAP_CONFIG: Record<
  GapType,
  {
    label: string;
    color: string;
    borderColor: string;
    bgColor: string;
    icon: typeof CheckCircle2;
  }
> = {
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
    <div
      className={`flex items-start gap-2 rounded-md border ${cfg.borderColor} ${cfg.bgColor} px-2.5 py-1.5 text-xs`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${cfg.color}`} />
      <div className="min-w-0">
        <span className={`font-medium ${cfg.color}`}>{gap.requisito}</span>
        <span
          className={`ml-1.5 inline-flex items-center rounded px-1 py-px text-[10px] font-medium ${cfg.color} ${cfg.bgColor} border ${cfg.borderColor}`}
        >
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

  const sections: {
    tipo: GapType;
    title: string;
    subtitle: string;
    icon: typeof Lightbulb;
    items: typeof allGaps;
  }[] = [
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
                  <div
                    key={i}
                    className={`rounded-lg ${cfg.bgColor}/60 border ${cfg.borderColor}/60 p-3`}
                  >
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

function SectionCoverageRow({ c }: { c: CoverageAnalysis["cobertura"][number] }) {
  const barPct = Math.round((c.score / 3) * 100);
  const barColor =
    c.score === 3 ? "bg-emerald-500" : c.score === 2 ? "bg-amber-400" : c.score === 1 ? "bg-amber-500" : "bg-red-400";
  const label = ["Ausente", "Fraco", "Parcial", "Coberto"][c.score];
  const labelColor =
    c.score === 3
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : c.score === 2
        ? "text-amber-700 bg-amber-50 border-amber-200"
        : c.score === 1
          ? "text-amber-800 bg-amber-100 border-amber-300"
          : "text-red-700 bg-red-50 border-red-200";

  return (
    <div>
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
}

function ResultadoCompleto({ data }: { data: CoverageAnalysis }) {
  const pct = data.totalRequisitos
    ? Math.round((data.requisitosCobertos / data.totalRequisitos) * 100)
    : 0;
  const pctColor =
    pct >= 70 ? "text-emerald-600" : pct >= 40 ? "text-amber-600" : "text-destructive";
  const ringColor =
    pct >= 70 ? "stroke-emerald-600" : pct >= 40 ? "stroke-amber-600" : "stroke-destructive";

  return (
    <div className="space-y-5">
      <div
        className="animate-result-fade-up flex flex-col items-center text-center pt-4 pb-2"
      >
        <div className="relative w-28 h-28">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r="52" fill="none" strokeWidth="8" className="stroke-paper-deep" />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
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

      {data.requisitosEliminatoriosNaoCumpridos.length > 0 && (
        <div
          className="animate-result-fade-up rounded-xl border border-destructive/25 bg-gradient-to-br from-destructive/5 to-transparent p-5"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
              <ShieldAlert className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <h3 className="font-serif text-base text-foreground">
                Requisitos eliminatórios não cumpridos
              </h3>
              <p className="text-xs text-muted-foreground">
                Atenção obrigatória antes de candidatar
              </p>
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

      <div
        className="animate-result-fade-up rounded-xl border border-navy-rule bg-card p-5"
        style={{ animationDelay: "0.2s" }}
      >
        <h3 className="font-serif text-base text-foreground mb-4">Cobertura por secção</h3>
        <div className="space-y-4">
          {data.cobertura.slice(0, data.hasMore ? 2 : undefined).map((c, i) => (
            <SectionCoverageRow key={i} c={c} />
          ))}
        </div>
        {data.hasMore && (
          <div className="relative mt-4 -mx-5 -mb-5 overflow-hidden rounded-b-xl">
            <div aria-hidden className="pointer-events-none select-none space-y-4 p-5 blur-[4px]">
              {data.cobertura.slice(2).map((c, i) => (
                <SectionCoverageRow key={i} c={c} />
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-card/50 to-card p-6 text-center">
              <p className="text-sm font-medium text-foreground">
                Cria uma conta grátis para ver a análise completa
              </p>
              <Link
                to="/auth"
                className="rounded-md bg-[#1b1b19] px-4 py-2 text-sm font-medium text-[#F1EFE8] transition-opacity hover:opacity-90"
              >
                Criar conta grátis
              </Link>
            </div>
          </div>
        )}
      </div>

      <div
        className="animate-result-fade-up grid gap-4 sm:grid-cols-2"
        style={{ animationDelay: "0.3s" }}
      >
        <div className="rounded-xl border border-navy-rule bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Keywords encontradas
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.keywords.presentes.length === 0 ? (
              <span className="text-sm text-muted-foreground">Nenhuma keyword identificada</span>
            ) : (
              data.keywords.presentes.map((k, i) => (
                <span
                  key={i}
                  className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800"
                >
                  {k}
                </span>
              ))
            )}
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
            {data.keywords.emFalta.length === 0 ? (
              <span className="text-sm text-muted-foreground">Nenhuma keyword em falta</span>
            ) : (
              data.keywords.emFalta.map((k, i) => (
                <span
                  key={i}
                  className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800"
                >
                  {k}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <GapActionPlan cobertura={data.cobertura} />
    </div>
  );
}

/* ── Modal principal ── */

interface AnaliseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AnaliseModal({ open, onOpenChange }: AnaliseModalProps) {
  const [cvText, setCvText] = useState("");
  const [tdrText, setTdrText] = useState("");
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [tdrFileName, setTdrFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const analyze = useServerFn(analyzeCoverage);
  const queryClient = useQueryClient();
  const mutation = useMutation<CoverageAnalysis, Error, { cv: string; jobTdr: string }>({
    mutationFn: (vars) => analyze({ data: vars }) as Promise<CoverageAnalysis>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SIDEBAR_STATUS_QUERY_KEY });
    },
  });

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

  const canSubmit =
    cvText.trim().length >= 20 &&
    tdrText.trim().length >= 20 &&
    !mutation.isPending &&
    !processing;

  return (
    <Modal
      open={open}
      onOpenChange={handleClose}
      className={mutation.isPending || mutation.data ? "max-w-3xl" : "max-w-[560px]"}
    >
      {mutation.isPending ? (
        <ScannerAnimation />
      ) : mutation.data ? (
        <>
          <ResultadoCompleto data={mutation.data} />
          <div className="mt-4 flex justify-end gap-2 border-t border-[#E3DFD7] pt-4">
            <button
              onClick={() => mutation.reset()}
              className="rounded-[10px] border border-[#E3DFD7] px-4 py-2 text-sm text-[#5F5E5A] transition-colors hover:bg-black/4 hover:text-[#2C2C2A]"
            >
              Nova análise
            </button>
            <button
              onClick={() => handleClose(false)}
              className="rounded-[10px] bg-[#1b1b19] px-4 py-2 text-sm font-medium text-[#F1EFE8] transition-opacity hover:opacity-90"
            >
              Fechar
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <div>
            <ModalTitle className="font-serif text-[22px] font-semibold leading-snug text-[#2C2C2A] pr-8">
              Analisar cobertura do CV
            </ModalTitle>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#5F5E5A]">
              Cola ou carrega o teu CV e os Termos de Referência da vaga. A análise compara
              ambos e mostra requisitos cobertos e em falta.
            </p>
          </div>

          <div className="space-y-5">
            <FileTextInput
              label="O teu CV"
              value={cvText}
              onChange={(v) => {
                setCvText(v);
                setCvFileName(null);
                setFileError(null);
              }}
              placeholder="Cola aqui o conteúdo completo do teu CV: dados pessoais, resumo, experiência, formação, competências…"
              rows={6}
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

            <FileTextInput
              label="Termos de Referência (TdR)"
              value={tdrText}
              onChange={(v) => {
                setTdrText(v);
                setTdrFileName(null);
                setFileError(null);
              }}
              placeholder="Cola aqui o anúncio completo da vaga: contexto, responsabilidades, qualificações exigidas, requisitos eliminatórios, competências desejadas…"
              rows={6}
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

            {mutation.isError &&
              (parseLimitError(mutation.error) ? (
                <UsageLimitNotice feature="cv_analysis" {...parseLimitError(mutation.error)!} />
              ) : (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {mutation.error.message}
                </div>
              ))}

            <div className="flex justify-end">
              <button
                disabled={!canSubmit}
                onClick={() => {
                  const guard = (s: string) =>
                    s.startsWith("PK") || s.includes("[Content_Types].xml");
                  if (guard(cvText) || guard(tdrText)) {
                    setFileError(
                      "Um dos textos contém dados binários em vez de texto legível. Remove e carrega de novo como .txt ou .docx.",
                    );
                    return;
                  }
                  setFileError(null);
                  mutation.mutate({ cv: cvText, jobTdr: tdrText });
                }}
                className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-[10px] bg-[#1b1b19] px-5 py-2.5 text-sm font-medium text-[#F1EFE8] transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
              >
                Analisar
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
