const SUB_DAY_THRESHOLD_MINUTES = 1440; // 24h — mesmo limiar de N1 (Guia B0-B5)

/** Formata minutos restantes de um plano ativo para a UI do utilizador (Fase
 * B4 do Guia B0-B5): "X dias" para planos normais, "Xh Ym" para planos
 * sub-diários — um comprador do "ilimitado 12h" nunca deve ver "0 dias". */
export function formatPlanTimeLeft(minutesLeft: number): string {
  if (minutesLeft >= SUB_DAY_THRESHOLD_MINUTES) {
    const days = Math.ceil(minutesLeft / SUB_DAY_THRESHOLD_MINUTES);
    return `${days} ${days === 1 ? "dia" : "dias"}`;
  }
  const hours = Math.floor(minutesLeft / 60);
  const minutes = minutesLeft % 60;
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
}

/** Duração formatada de um plano ("12h", "30 dias") a partir de period_minutes
 * — usada em /planos para mostrar a duração de qualquer plano dinamicamente. */
export function formatPlanDuration(periodMinutes: number | null): string {
  if (periodMinutes == null) return "";
  if (periodMinutes % SUB_DAY_THRESHOLD_MINUTES === 0) {
    const days = periodMinutes / SUB_DAY_THRESHOLD_MINUTES;
    return `${days} ${days === 1 ? "dia" : "dias"}`;
  }
  const hours = Math.round(periodMinutes / 60);
  return `${hours}h`;
}
