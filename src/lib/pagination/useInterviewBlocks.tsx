// Decompõe uma preparação de entrevista (InterviewPrepDraft) numa lista de
// blocos indivisíveis para o motor de paginação de coluna única — modelado em
// useCvBlocks.tsx, mas MUITO mais simples: sem sidebar, sem sectionLayout,
// sem placement (a entrevista não tem esses conceitos, é sempre um único
// documento corrido, coluna única).

import { useMemo } from "react";
import { Info } from "lucide-react";
import type { TemplateTheme } from "@/lib/templates/themes";
import { headerBorderStyle, sectionLabelClass } from "@/lib/templates/themes";
import { FIRST_ITEM_GAP, type PageMetrics } from "./metrics";
import type { CvBlock } from "./types";
import { CATEGORY_ORDER, CATEGORY_LABELS } from "@/lib/interview-types";
import type { InterviewPrepDraft } from "@/lib/interview-types";

function tdrFirstLine(tdr: string): string {
  const line =
    tdr
      .split("\n")
      .find((l) => l.trim())
      ?.trim() ?? "";
  return line.length > 140 ? line.slice(0, 140) + "…" : line;
}

export function useInterviewBlocks(
  draft: InterviewPrepDraft,
  theme: TemplateTheme,
  metrics: PageMetrics,
): CvBlock[] {
  return useMemo(() => {
    const blocks: CvBlock[] = [];
    const tdrLine = draft.jobTdr ? tdrFirstLine(draft.jobTdr) : "";

    // ── Cabeçalho — mesmo markup que InterviewPrepDocument já produzia ──
    blocks.push({
      id: "header",
      kind: "header",
      sectionId: "header",
      marginBefore: 0,
      node: (
        <header style={headerBorderStyle(theme.headerStyle)}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--cv-accent)" }}>
            Preparação de Entrevista
          </p>
          {tdrLine && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--cv-muted)" }}>{tdrLine}</p>
          )}
        </header>
      ),
    });

    // ── Aviso "sugestões de discurso" — conteúdo NOVO no documento exportado,
    // mesmo tratamento visual que já tem em InterviewPrepResult.tsx (ecrã). ──
    blocks.push({
      id: "aviso",
      kind: "item",
      sectionId: "aviso",
      marginBefore: metrics.sectionGap,
      node: (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>
            Estas respostas são <strong>sugestões de discurso</strong> para preparares e adaptares
            com as tuas próprias palavras — não são factos objectivos. Onde o teu CV não tiver
            evidência suficiente, dizemos isso claramente em vez de inventar um exemplo.
          </p>
        </div>
      ),
    });

    // ── Categorias + perguntas ──
    const grouped = CATEGORY_ORDER.map((categoria) => ({
      categoria,
      items: draft.questions.filter((q) => q.categoria === categoria),
    })).filter((g) => g.items.length > 0);

    grouped.forEach(({ categoria, items }) => {
      blocks.push({
        id: `title-${categoria}`,
        kind: "section-title",
        sectionId: categoria,
        marginBefore: metrics.sectionGap,
        node: (
          <h2
            className={sectionLabelClass(theme.headerStyle)}
            style={{ color: "var(--cv-accent)", borderColor: "var(--cv-rule)" }}
          >
            {CATEGORY_LABELS[categoria]}
          </h2>
        ),
      });

      // Pergunta + resposta sugerida: bloco indivisível (uma unidade só,
      // nunca é partida a meio pelo motor de paginação).
      items.forEach((q, i) => {
        blocks.push({
          id: `${categoria}-${i}`,
          kind: "item",
          sectionId: categoria,
          marginBefore: i === 0 ? FIRST_ITEM_GAP : metrics.itemGap,
          node: (
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: "var(--cv-text)" }}>{q.pergunta}</p>
              <p style={{ margin: "4px 0 0", color: "var(--cv-text)", whiteSpace: "pre-line" }}>
                {q.resposta_sugerida}
              </p>
            </div>
          ),
        });
      });
    });

    return blocks;
  }, [draft.questions, draft.jobTdr, theme, metrics.sectionGap, metrics.itemGap]);
}
