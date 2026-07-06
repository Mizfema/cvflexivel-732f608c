import { useCallback, useEffect, useState } from "react";
import { type CvDraft, EMPTY_CV } from "@/lib/cv-types";
import { normalizeCvDesign } from "@/lib/cv-design-presets";

const DRAFT_KEY = "cv-flexivel:draft";

function readDraft(): CvDraft {
  if (typeof window === "undefined") return EMPTY_CV;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return EMPTY_CV;
    const parsed = JSON.parse(raw) as Partial<CvDraft>;
    return {
      ...EMPTY_CV,
      ...parsed,
      sections: { ...EMPTY_CV.sections, ...(parsed.sections ?? {}) },
      design: normalizeCvDesign(parsed.design),
    };
  } catch {
    return EMPTY_CV;
  }
}

function writeDraft(draft: CvDraft) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

/**
 * Rascunho do CV em localStorage. Persistência anónima — antes do login.
 * Ao fazer login (Etapa 7) será migrado para a tabela `cvs`.
 */
export function useDraftCv() {
  const [draft, setDraft] = useState<CvDraft>(EMPTY_CV);
  const [hydrated, setHydrated] = useState(false);

  // Hidratar do localStorage só no cliente (SSR-safe)
  useEffect(() => {
    setDraft(readDraft());
    setHydrated(true);
  }, []);

  // Sincronizar entre tabs
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === DRAFT_KEY && e.newValue) {
        try {
          setDraft(JSON.parse(e.newValue));
        } catch {
          // ignorar
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((updater: (prev: CvDraft) => CvDraft) => {
    setDraft((prev) => {
      const next = { ...updater(prev), updatedAt: new Date().toISOString() };
      writeDraft(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    writeDraft(EMPTY_CV);
    setDraft(EMPTY_CV);
  }, []);

  return { draft, update, reset, hydrated };
}

export { DRAFT_KEY };
