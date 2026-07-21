import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { CvDraft } from "@/lib/cv-types";
import { saveCv } from "@/lib/cvs.functions";

export type CvAutosaveStatus = "idle" | "saving" | "saved" | "error";

function draftSignature(draft: CvDraft) {
  return JSON.stringify({
    title: draft.title,
    sections: draft.sections,
    template: draft.template,
    design: draft.design,
    sectionLayout: draft.sectionLayout,
  });
}

/**
 * Grava o rascunho inteiro no Supabase (com debounce) sempre que muda,
 * enquanto houver sessão iniciada. Substitui/complementa a gravação que só
 * acontecia no clique de "Exportar" — aqui qualquer alteração (texto, design,
 * template) é persistida automaticamente para nunca perder trabalho.
 */
export function useCvAutosave({
  draft,
  cvId,
  onSaved,
  enabled,
  skip,
}: {
  draft: CvDraft;
  cvId?: string;
  onSaved: (id: string) => void;
  enabled: boolean;
  /** Enquanto true (ex.: a carregar um CV existente), não grava nem re-arma. */
  skip: boolean;
}) {
  const save = useServerFn(saveCv);
  const lastSaved = useRef<string | null>(null);
  const cvIdRef = useRef(cvId);
  cvIdRef.current = cvId;
  const [status, setStatus] = useState<CvAutosaveStatus>("idle");

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
            id: cvIdRef.current,
            title: draft.sections.perfil.nome || draft.title || "CV sem título",
            sections: draft.sections,
            template: draft.template,
            design: draft.design,
            sectionLayout: draft.sectionLayout,
          },
        });
        lastSaved.current = sig;
        if (!cvIdRef.current) onSaved(res.id);
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
