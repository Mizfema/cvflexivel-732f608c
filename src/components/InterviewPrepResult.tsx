import { useState } from "react";
import { ChevronDown, Users, Wrench, Building2, ShieldAlert, Info } from "lucide-react";
import { CATEGORY_ORDER } from "@/lib/interview-types";
import type { InterviewQuestion, InterviewQuestionCategoria } from "@/lib/interview-types";

const CATEGORY_CONFIG: Record<
  InterviewQuestionCategoria,
  {
    label: string;
    subtitle: string;
    icon: typeof Users;
    color: string;
    borderColor: string;
    bgColor: string;
  }
> = {
  comportamental: {
    label: "Comportamentais",
    subtitle: "Situações passadas e forma de trabalhar",
    icon: Users,
    color: "text-blue-700",
    borderColor: "border-blue-200",
    bgColor: "bg-blue-50",
  },
  tecnica: {
    label: "Técnicas",
    subtitle: "Conhecimento e ferramentas exigidas no TdR",
    icon: Wrench,
    color: "text-emerald-700",
    borderColor: "border-emerald-200",
    bgColor: "bg-emerald-50",
  },
  sobre_empresa: {
    label: "Sobre a organização",
    subtitle: "Motivação e conhecimento do sector",
    icon: Building2,
    color: "text-amber-700",
    borderColor: "border-amber-200",
    bgColor: "bg-amber-50",
  },
  eliminatoria: {
    label: "Eliminatórias",
    subtitle: "Requisitos obrigatórios que funcionam como filtro",
    icon: ShieldAlert,
    color: "text-red-700",
    borderColor: "border-red-200",
    bgColor: "bg-red-50",
  },
};

function QuestionCard({
  q,
  color,
  borderColor,
  bgColor,
}: {
  q: InterviewQuestion;
  color: string;
  borderColor: string;
  bgColor: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`overflow-hidden rounded-lg border ${borderColor} bg-white`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-foreground">{q.pergunta}</span>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className={`border-t ${borderColor} ${bgColor}/50 px-4 py-3`}>
          <p className={`mb-1.5 text-[11px] font-semibold uppercase tracking-wider ${color}`}>
            Sugestão de discurso
          </p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">
            {q.resposta_sugerida}
          </p>
        </div>
      )}
    </div>
  );
}

export function InterviewPrepResult({ questions }: { questions: InterviewQuestion[] }) {
  const grouped = CATEGORY_ORDER.map((categoria) => ({
    categoria,
    items: questions.filter((q) => q.categoria === categoria),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p>
          Estas respostas são <strong>sugestões de discurso</strong> para preparares e adaptares com
          as tuas próprias palavras — não são factos objectivos. Onde o teu CV não tiver evidência
          suficiente, dizemos isso claramente em vez de inventar um exemplo.
        </p>
      </div>

      {grouped.map(({ categoria, items }) => {
        const cfg = CATEGORY_CONFIG[categoria];
        const Icon = cfg.icon;
        return (
          <div key={categoria} className={`rounded-xl border ${cfg.borderColor} p-5`}>
            <div className="mb-3 flex items-center gap-2.5">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${cfg.bgColor}`}>
                <Icon className={`h-4 w-4 ${cfg.color}`} />
              </div>
              <div>
                <h3 className="font-serif text-base text-foreground">{cfg.label}</h3>
                <p className="text-xs text-muted-foreground">{cfg.subtitle}</p>
              </div>
            </div>
            <div className="space-y-2.5">
              {items.map((q, i) => (
                <QuestionCard
                  key={i}
                  q={q}
                  color={cfg.color}
                  borderColor={cfg.borderColor}
                  bgColor={cfg.bgColor}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
