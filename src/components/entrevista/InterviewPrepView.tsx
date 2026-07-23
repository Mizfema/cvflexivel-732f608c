// Ecrã de resultado de uma preparação de entrevista: editor real das
// respostas (InterviewPrepEditor, Fase 3C) e pré-visualização paginada
// (InterviewPrepPagedPreview) lado a lado em ecrã largo — sem separadores em
// desktop, os dois painéis estão sempre montados e visíveis. Em mobile,
// mantém-se o padrão de separadores "Respostas" / "Ver como vai ficar".
//
// ⚠️ O separador inactivo em mobile usa visibility:hidden + position:absolute,
// NUNCA display:none (Tailwind `hidden`). Isto é deliberado sobretudo por
// causa do preview: InterviewPrepPagedPreview mede alturas reais no DOM
// (usePagination); um antepassado com display:none zera offsetHeight de tudo
// lá dentro, e a pré-visualização ficaria paginada com todas as alturas a 0
// sempre que o utilizador nunca tivesse aberto esse separador antes de
// exportar. Aplicamos o mesmo cuidado ao lado do editor por consistência,
// ainda que o editor não dependa de medição de altura como o preview.
//
// Scroll independente por coluna em desktop: `lg:flex` (nunca `lg:grid` — a
// lição da Fase A é que min-h-0 pode não propagar nos dois eixos dentro de um
// grid) + min-h-0/flex-1/overflow-y-auto em cada coluna, mesmo padrão do
// editor.tsx/carta-editor.tsx. A diferença é que aqui não há uma rota `h-full`
// dedicada por baixo (isto é montado dentro de páginas de scroll normal, não
// de um shell fixo ao viewport) — por isso a altura da faixa de duas colunas
// é ancorada directamente ao viewport (`lg:h-[...]`) em vez de herdada de um
// ecrã `h-full flex flex-col overflow-hidden`.

import { useEffect, useState } from "react";
import { InterviewPrepEditor } from "@/components/entrevista/InterviewPrepEditor";
import { InterviewPrepPagedPreview } from "@/components/entrevista/InterviewPrepPagedPreview";
import { InterviewPrepThemeToolbar } from "@/components/entrevista/InterviewPrepThemeToolbar";
import { InterviewPrepExport } from "@/components/entrevista/InterviewPrepExport";
import { useAuth } from "@/hooks/use-auth";
import { useInterviewPrepAutosave } from "@/hooks/use-interview-prep-autosave";
import type { InterviewPrepDraft, InterviewQuestion } from "@/lib/interview-types";

const DEFAULT_TEMPLATE = "classico";

export function InterviewPrepView({
  questions,
  jobTdr,
  prepId,
  cvId = null,
  onSaved,
}: {
  questions: InterviewQuestion[];
  jobTdr: string | null;
  /** Id da linha em `interview_preps`, quando já existe (ver entrevistas.tsx).
   * Ausente enquanto a preparação gerada em preparar-entrevista.tsx ainda não
   * tiver sido guardada. */
  prepId?: string;
  cvId?: string | null;
  /** Chamado quando o autosave cria a linha pela 1.ª vez (prepId ainda
   * ausente) — o chamador deve guardar o id devolvido e devolvê-lo como
   * `prepId` nas renderizações seguintes, para as próximas gravações
   * actualizarem a mesma linha em vez de criar uma nova a cada edição. */
  onSaved?: (id: string) => void;
}) {
  const { session, ready: authReady } = useAuth();
  const [tab, setTab] = useState<"respostas" | "preview">("respostas");
  const [draft, setDraft] = useState<InterviewPrepDraft>(() => ({
    template: DEFAULT_TEMPLATE,
    jobTdr,
    questions,
  }));

  // Um "tick" depois do 1.º render — dá tempo ao seeding interno de
  // useInterviewPrepAutosave (semeia a assinatura com o conteúdo inicial)
  // antes de permitir gravações, para não disparar um save espúrio ao montar
  // com perguntas já geradas/carregadas mas ainda sem qualquer edição.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => setSeeded(true), []);

  const update = (updater: (prev: InterviewPrepDraft) => InterviewPrepDraft) => setDraft(updater);

  const autosaveStatus = useInterviewPrepAutosave({
    draft,
    prepId,
    cvId,
    onSaved: onSaved ?? (() => {}),
    enabled: authReady && !!session,
    skip: !seeded,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-md border border-navy-rule bg-card p-1 lg:hidden">
          <button
            type="button"
            onClick={() => setTab("respostas")}
            className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "respostas"
                ? "bg-navy text-paper"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Respostas
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "preview"
                ? "bg-navy text-paper"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Ver como vai ficar
          </button>
        </div>
        <div className="flex items-center gap-2">
          {session && (
            <span className="text-xs text-muted-foreground">
              {autosaveStatus === "saving"
                ? "A guardar…"
                : autosaveStatus === "saved"
                  ? "Guardado"
                  : autosaveStatus === "error"
                    ? "Falha ao guardar"
                    : ""}
            </span>
          )}
          <InterviewPrepThemeToolbar
            template={draft.template}
            onTemplateChange={(id) => update((p) => ({ ...p, template: id }))}
          />
          <InterviewPrepExport draft={draft} />
        </div>
      </div>

      <div className="relative lg:flex lg:h-[calc(100vh-280px)] lg:min-h-[520px] lg:gap-4">
        <div
          className={`${
            tab === "respostas" ? "" : "invisible absolute inset-0 pointer-events-none"
          } lg:visible lg:static lg:pointer-events-auto lg:flex lg:min-h-0 lg:min-w-0 lg:flex-1 lg:flex-col`}
        >
          <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            <InterviewPrepEditor draft={draft} update={update} />
          </div>
        </div>
        <div
          className={`${
            tab === "preview" ? "" : "invisible absolute inset-0 pointer-events-none"
          } lg:visible lg:static lg:pointer-events-auto lg:flex lg:min-h-0 lg:min-w-0 lg:flex-1 lg:flex-col`}
        >
          <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            <InterviewPrepPagedPreview draft={draft} />
          </div>
        </div>
      </div>
    </div>
  );
}
