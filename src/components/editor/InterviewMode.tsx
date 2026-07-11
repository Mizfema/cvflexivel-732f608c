import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateCvFromInterview } from "@/lib/llm.functions";
import type { CvDraft } from "@/lib/cv-types";
import { parseLimitError } from "@/lib/usage-error";
import { UsageLimitNotice } from "@/components/UsageLimitNotice";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

type Step =
  | { kind: "tdr"; pergunta: string; ajuda?: string }
  | {
      kind: "pergunta";
      id: string;
      pergunta: string;
      ajuda?: string;
      placeholder?: string;
      tipo?: "texto" | "input";
    };

type InterviewCvResult = {
  perfil: CvDraft["sections"]["perfil"];
  experiencia: Array<Omit<CvDraft["sections"]["experiencia"][number], "id">>;
  formacao: Array<Omit<CvDraft["sections"]["formacao"][number], "id">>;
  competencias: Array<Omit<CvDraft["sections"]["competencias"][number], "id">>;
  idiomas: Array<Omit<CvDraft["sections"]["idiomas"][number], "id">>;
};

type InterviewMutationInput = {
  answers: { pergunta: string; resposta: string }[];
  jobTdr?: string;
};

const PERGUNTAS_BASE: Step[] = [
  {
    kind: "pergunta",
    id: "nome",
    pergunta: "Qual é o teu nome completo?",
    tipo: "input",
    placeholder: "Ex.: Ana Macuácua",
  },
  {
    kind: "pergunta",
    id: "contacto",
    pergunta: "Indica o teu email, telefone e cidade.",
    ajuda: "Numa só resposta — ex.: ana@exemplo.mz, +258 84 000 0000, Maputo.",
  },
  {
    kind: "pergunta",
    id: "headline",
    pergunta: "Como te apresentas profissionalmente em uma linha?",
    tipo: "input",
    placeholder: "Coordenadora de programa · 8 anos em saúde pública",
  },
  {
    kind: "pergunta",
    id: "experiencia",
    pergunta:
      "Conta-me, por ordem, os trabalhos/funções que tiveste. Para cada um: cargo, organização, datas (início–fim) e 2-3 coisas concretas que fizeste.",
    ajuda:
      "Foca em factos verificáveis: o que coordenaste, número de pessoas, resultados que tu próprio podes mostrar.",
  },
  {
    kind: "pergunta",
    id: "formacao",
    pergunta:
      "Que formação tens? (cursos, licenciaturas, mestrados, certificados) — com instituição e ano.",
  },
  {
    kind: "pergunta",
    id: "competencias",
    pergunta:
      "Que competências técnicas e ferramentas dominas? (ex.: M&E, gestão de orçamento, Excel, KoboToolbox, gestão de equipa, etc.)",
  },
  {
    kind: "pergunta",
    id: "idiomas",
    pergunta:
      "Que idiomas falas e em que nível? (básico, intermédio, avançado, fluente, nativo)",
  },
  {
    kind: "pergunta",
    id: "extras",
    pergunta:
      "Há mais algo relevante? Voluntariado, projetos, publicações, prémios — só se for verdadeiro e teu.",
    ajuda: "Pode ficar em branco.",
  },
];

export function InterviewMode({
  modo,
  onComplete,
  onCancel,
}: {
  modo: "entrevista-vaga" | "entrevista-zero";
  onComplete: (sections: CvDraft["sections"]) => void;
  onCancel: () => void;
}) {
  const needsTdr = modo === "entrevista-vaga";
  const steps = useMemo<Step[]>(
    () =>
      needsTdr
        ? [
            {
              kind: "tdr",
              pergunta: "Cola os Termos de Referência da vaga.",
              ajuda:
                "As próximas perguntas vão ser direcionadas aos requisitos desta vaga — sem nunca inventar experiência tua.",
            },
            ...PERGUNTAS_BASE,
          ]
        : PERGUNTAS_BASE,
    [needsTdr],
  );

  const [idx, setIdx] = useState(0);
  const [tdr, setTdr] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState("");

  const gen = useServerFn(generateCvFromInterview);
  const mut = useMutation<InterviewCvResult, Error, InterviewMutationInput>({
    mutationFn: (input) => gen({ data: input }) as Promise<InterviewCvResult>,

    onSuccess: (data) => {
      const sections: CvDraft["sections"] = {
        perfil: {
          nome: data.perfil.nome ?? "",
          headline: data.perfil.headline ?? "",
          email: data.perfil.email ?? "",
          telefone: data.perfil.telefone ?? "",
          cidade: data.perfil.cidade ?? "",
          pais: data.perfil.pais ?? "Moçambique",
          linkedin: data.perfil.linkedin,
          website: data.perfil.website,
          resumo: data.perfil.resumo,
        },
        experiencia: data.experiencia.map((e) => ({ id: uid(), ...e })),
        formacao: data.formacao.map((f) => ({ id: uid(), ...f })),
        competencias: data.competencias.map((c) => ({ id: uid(), nome: c.nome })),
        idiomas: data.idiomas.map((i) => ({ id: uid(), ...i })),
        extras: [],
      };
      onComplete(sections);
    },
  });

  const step = steps[idx];
  const isLast = idx === steps.length - 1;
  const total = steps.length;

  const goNext = () => {
    if (step.kind === "tdr") {
      setTdr(current);
    } else {
      setAnswers((a) => ({ ...a, [step.id]: current }));
    }
    setCurrent("");
    if (isLast) {
      // submeter
      const finalAnswers =
        step.kind === "tdr"
          ? []
          : [
              ...Object.entries({ ...answers, [step.id]: current }).map(
                ([id, resposta]) => {
                  const s = steps.find(
                    (s) => s.kind === "pergunta" && s.id === id,
                  );
                  return {
                    pergunta:
                      s && s.kind === "pergunta" ? s.pergunta : id,
                    resposta,
                  };
                },
              ),
            ];
      mut.mutate({
        answers: finalAnswers,
        jobTdr: needsTdr ? tdr : undefined,
      });
    } else {
      setIdx((i) => i + 1);
    }
  };

  const goBack = () => {
    if (idx === 0) {
      onCancel();
      return;
    }
    const prev = steps[idx - 1];
    const prevValue =
      prev.kind === "tdr" ? tdr : answers[prev.id] ?? "";
    setCurrent(prevValue);
    setIdx((i) => i - 1);
  };

  const canAdvance = current.trim().length > 0 || step.kind === "pergunta" && step.id === "extras";

  if (mut.isPending) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-navy-rule bg-card p-10 text-center">
        <Sparkles className="mx-auto h-8 w-8 animate-pulse text-navy" />
        <h2 className="mt-4 font-serif text-2xl">A estruturar o teu CV…</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A transformar respostas em conteúdo de CV. Nunca inventamos —
          apenas reorganizamos o que disseste.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between text-xs font-mono text-muted-foreground">
        <span>
          Pergunta {idx + 1} de {total}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="underline-offset-4 hover:underline"
        >
          Saltar entrevista
        </button>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-navy-rule">
        <div
          className="h-full bg-navy transition-all"
          style={{ width: `${((idx + 1) / total) * 100}%` }}
        />
      </div>

      <div className="mt-8 rounded-lg border border-navy-rule bg-card p-6 sm:p-8">
        <Label className="text-xs font-medium uppercase tracking-[0.18em] text-navy-mid">
          {step.kind === "tdr" ? "Vaga alvo" : "Pergunta"}
        </Label>
        <h2 className="mt-3 font-serif text-xl text-foreground sm:text-2xl">
          {step.pergunta}
        </h2>
        {step.ajuda && (
          <p className="mt-2 text-sm text-muted-foreground">{step.ajuda}</p>
        )}

        <div className="mt-5">
          {step.kind === "pergunta" && step.tipo === "input" ? (
            <Input
              autoFocus
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder={step.placeholder}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canAdvance) {
                  e.preventDefault();
                  goNext();
                }
              }}
            />
          ) : (
            <Textarea
              autoFocus
              rows={step.kind === "tdr" ? 10 : 6}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder={
                step.kind === "tdr"
                  ? "Cola aqui o texto integral dos TdR…"
                  : "Escreve com as tuas palavras."
              }
            />
          )}
        </div>

        {mut.isError &&
          (parseLimitError(mut.error) ? (
            <div className="mt-4">
              <UsageLimitNotice feature="generate_cv_interview" {...parseLimitError(mut.error)!} />
            </div>
          ) : (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
              <span>{(mut.error as Error).message}</span>
            </div>
          ))}

        <div className="mt-6 flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={goBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {idx === 0 ? "Cancelar" : "Anterior"}
          </Button>
          <Button type="button" onClick={goNext} disabled={!canAdvance}>
            {isLast ? "Gerar CV" : "Próxima"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Nunca inventamos experiência. Se faltar informação, voltamos a
        perguntar.
      </p>
    </div>
  );
}
