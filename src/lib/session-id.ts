const STORAGE_KEY = "cv-flexivel-session-id";

/** Id de sessão de navegador para o rate-limit de generateFieldSuggestions
 * (Fase 0 da Proposta V3 §6, item 3). Guardado em sessionStorage — morre com
 * o fecho do separador/janela, que é a semântica de "sessão" mais simples de
 * implementar sem infraestrutura de sessão própria no servidor. Devolve null
 * no SSR (sem window) — o guard aqui, e não o nome do ficheiro, é o que
 * mantém isto seguro para importar de código renderizado no servidor. */
export function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = window.sessionStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.sessionStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}
