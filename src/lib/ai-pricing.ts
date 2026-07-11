/** Preço do google/gemini-3-flash-preview via Lovable AI Gateway: pass-through
 * do preço do Google, sem markup (US$0.50 / 1M tokens de entrada, US$3.00 / 1M
 * de saída). Se o modelo usado nas server functions mudar, actualizar aqui. */
export const INPUT_PRICE_PER_TOKEN_USD = 0.5 / 1_000_000;
export const OUTPUT_PRICE_PER_TOKEN_USD = 3 / 1_000_000;

export function computeCostUsd(tokensIn: number | null, tokensOut: number | null): number {
  return (tokensIn ?? 0) * INPUT_PRICE_PER_TOKEN_USD + (tokensOut ?? 0) * OUTPUT_PRICE_PER_TOKEN_USD;
}
