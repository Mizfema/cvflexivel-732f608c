// Snapshot genérico de "onde o utilizador parou" para qualquer fluxo (wizard,
// modal, formulário) que possa ser interrompido por uma navegação completa de
// página para /auth. Mesma ideia de ponte via localStorage de
// cover-letter-draft.ts, generalizada por chave de fluxo.

const PREFIX = "cv-flexivel:resume:";
const DEFAULT_MAX_AGE_MS = 30 * 60 * 1000;

type ResumeEnvelope<T> = { savedAt: number; data: T };

export function saveResumeState<T>(flow: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const envelope: ResumeEnvelope<T> = { savedAt: Date.now(), data };
    window.localStorage.setItem(PREFIX + flow, JSON.stringify(envelope));
  } catch {
    /* ignore (quota, etc.) */
  }
}

export function hasResumeState(flow: string, maxAgeMs = DEFAULT_MAX_AGE_MS): boolean {
  return readResumeState(flow, maxAgeMs) !== null;
}

export function readResumeState<T>(flow: string, maxAgeMs = DEFAULT_MAX_AGE_MS): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + flow);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as ResumeEnvelope<T>;
    if (Date.now() - envelope.savedAt > maxAgeMs) {
      window.localStorage.removeItem(PREFIX + flow);
      return null;
    }
    return envelope.data;
  } catch {
    return null;
  }
}

export function clearResumeState(flow: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PREFIX + flow);
}
