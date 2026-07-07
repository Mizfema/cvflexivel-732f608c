// Ponte entre o stepper "Nova carta" e /carta-editor: o resultado gerado (ou o
// arranque vazio de "escrever do zero") viaja por aqui, tal como o CV alinhado
// à vaga viaja de VagaStepper para /editor via localStorage (ver use-draft-cv.ts).

const PENDING_KEY = "cv-flexivel:pending-cover-letter";

export type PendingCoverLetterDraft = {
  title: string;
  content: string;
  jobTdr: string | null;
  cvId: string | null;
};

export function writePendingCoverLetterDraft(draft: PendingCoverLetterDraft) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PENDING_KEY, JSON.stringify(draft));
}

export function readPendingCoverLetterDraft(): PendingCoverLetterDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingCoverLetterDraft;
  } catch {
    return null;
  }
}

export function clearPendingCoverLetterDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PENDING_KEY);
}
