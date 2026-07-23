import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { InterviewPrepDraft } from "@/lib/interview-types";
import { updateInterviewPrep } from "@/lib/interview-preps.functions";

export type InterviewPrepAutosaveStatus = "idle" | "saving" | "saved" | "error";

// Fase 3A: assinatura de "mudança real" cobre questions (conteúdo editável) e
// template (afecta a pré-visualização/exportação) — mesmos dois campos que o
// draft realmente tem hoje. jobTdr fica de fora de propósito: não é editável
// nesta fase, só o Q&A e o tema. `interview_preps` não tem coluna `template`
// (é só estado efémero da pré-visualização, ver InterviewPrepView.tsx) — uma
// mudança de template ainda assim dispara um save (grava questions/jobTdr
// inalterados), inofensivo, só para o dia em que `template` passar a ser
// persistido não exigir tocar aqui outra vez.
function draftSignature(draft: InterviewPrepDraft) {
  return JSON.stringify({ questions: draft.questions, template: draft.template });
}

/**
 * Grava a preparação de entrevista inteira no Supabase (com debounce) sempre
 * que muda, enquanto houver sessão iniciada — mesmo padrão de
 * useCvAutosave.ts, usando updateInterviewPrep (upsert por id) em vez de
 * updateCv. Fase 3A: hook criado mas ainda não ligado a nenhuma UI.
 */
export function useInterviewPrepAutosave({
  draft,
  prepId,
  cvId,
  onSaved,
  enabled,
  skip,
}: {
  draft: InterviewPrepDraft;
  /** Id da linha em `interview_preps` a actualizar; ausente até ao 1.º save. */
  prepId?: string;
  /** FK opcional para um CV associado (coluna `cv_id`) — passada tal e qual
   * em cada update para não a apagar; não faz parte do draft. */
  cvId?: string | null;
  onSaved: (id: string) => void;
  enabled: boolean;
  /** Enquanto true (ex.: a carregar uma preparação existente), não grava nem re-arma. */
  skip: boolean;
}) {
  const save = useServerFn(updateInterviewPrep);
  const lastSaved = useRef<string | null>(null);
  const prepIdRef = useRef(prepId);
  prepIdRef.current = prepId;
  const cvIdRef = useRef(cvId);
  cvIdRef.current = cvId;
  const [status, setStatus] = useState<InterviewPrepAutosaveStatus>("idle");

  // Ao terminar uma carga (skip: true -> false), "semeia" a assinatura para
  // não disparar um save espúrio do que acabou de vir do servidor.
  const prevSkip = useRef(skip);
  useEffect(() => {
    if (prevSkip.current && !skip) {
      lastSaved.current = draftSignature(draft);
    }
    prevSkip.current = skip;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);

  useEffect(() => {
    if (!enabled || skip) return;
    const sig = draftSignature(draft);
    if (sig === lastSaved.current) return;

    setStatus("saving");
    const timer = setTimeout(async () => {
      try {
        const res = await save({
          data: {
            id: prepIdRef.current,
            cvId: cvIdRef.current,
            jobTdr: draft.jobTdr ?? "",
            questions: draft.questions,
          },
        });
        lastSaved.current = sig;
        if (!prepIdRef.current) onSaved(res.id);
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, 900);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, enabled, skip]);

  return status;
}
