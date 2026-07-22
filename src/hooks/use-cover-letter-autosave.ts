import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { CoverLetterEditorState } from "@/lib/cover-letter-types";
import { saveCoverLetter } from "@/lib/cover_letters.functions";

export type CoverLetterAutosaveStatus = "idle" | "saving" | "saved" | "error";

function draftSignature(draft: CoverLetterEditorState) {
  return JSON.stringify({
    title: draft.title,
    content: draft.content,
    cvId: draft.cvId,
    jobTdr: draft.jobTdr,
    template: draft.template,
    design: draft.design,
    photo: draft.photo,
    perfil: draft.perfil,
  });
}

/**
 * Grava a carta inteira no Supabase (com debounce) sempre que muda — mesmo
 * mecanismo do CV (ver use-cv-autosave.ts): qualquer alteração (texto,
 * template, design) é persistida automaticamente.
 */
export function useCoverLetterAutosave({
  draft,
  letterId,
  onSaved,
  enabled,
  skip,
}: {
  draft: CoverLetterEditorState;
  letterId?: string;
  onSaved: (id: string) => void;
  enabled: boolean;
  /** Enquanto true (ex.: a carregar uma carta existente), não grava nem re-arma. */
  skip: boolean;
}) {
  const save = useServerFn(saveCoverLetter);
  const lastSaved = useRef<string | null>(null);
  const letterIdRef = useRef(letterId);
  letterIdRef.current = letterId;
  const [status, setStatus] = useState<CoverLetterAutosaveStatus>("idle");

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
            id: letterIdRef.current,
            title: draft.title.trim() || "Carta sem título",
            cvId: draft.cvId,
            jobTdr: draft.jobTdr,
            content: draft.content,
            template: draft.template,
            design: draft.design,
            photo: draft.photo,
            perfil: draft.perfil,
          },
        });
        lastSaved.current = sig;
        if (!letterIdRef.current) onSaved(res.id);
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
