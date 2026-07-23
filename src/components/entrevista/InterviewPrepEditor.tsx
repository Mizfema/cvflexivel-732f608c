// Editor real das perguntas/respostas de uma preparação de entrevista — a
// coluna esquerda do layout 50/50 (Fase 3C, ver InterviewPrepView.tsx).
// Modelado em EditorForm.tsx (CV), mas simplificado: 4 categorias FIXAS
// (CATEGORY_ORDER), nunca reordenáveis entre si — só as perguntas DENTRO de
// cada categoria são arrastáveis (confirmado com o dono). Reutiliza
// ItemCard/ItemSummary/useItemDragAndDrop de ItemAccordion.tsx (Fase 3B).
//
// `draft.questions` é um único array plano (categoria é um campo de cada
// pergunta, não há um array por categoria — mesmo padrão de
// InterviewPrepResult.tsx/useInterviewBlocks.tsx, que também filtram por
// categoria em vez de assumir uma estrutura agrupada). Arrastar dentro de uma
// categoria reordena só o subconjunto filtrado; reorderCategoryQuestions
// reconstrói o array completo substituindo, pela ordem original, apenas as
// posições que já pertenciam a essa categoria — as restantes ficam intocadas.

import { useState } from "react";
import { Info } from "lucide-react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ItemCard, ItemSummary, useItemDragAndDrop } from "@/components/editor/ItemAccordion";
import { RichTextField } from "@/components/ui/RichTextField";
import { CATEGORY_ORDER, CATEGORY_LABELS } from "@/lib/interview-types";
import type {
  InterviewPrepDraft,
  InterviewQuestion,
  InterviewQuestionCategoria,
} from "@/lib/interview-types";

type Updater = (updater: (prev: InterviewPrepDraft) => InterviewPrepDraft) => void;

function reorderCategoryQuestions(
  questions: InterviewQuestion[],
  categoria: InterviewQuestionCategoria,
  newIds: string[],
): InterviewQuestion[] {
  const byId = new Map(questions.map((q) => [q.id, q] as const));
  let cursor = 0;
  return questions.map((q) => {
    if (q.categoria !== categoria) return q;
    const nextId = newIds[cursor++];
    return byId.get(nextId) ?? q;
  });
}

function CategoryCard({
  categoria,
  items,
  onReorder,
  onAnswerChange,
  onRemove,
}: {
  categoria: InterviewQuestionCategoria;
  items: InterviewQuestion[];
  onReorder: (newIds: string[]) => void;
  onAnswerChange: (id: string, html: string) => void;
  onRemove: (id: string) => void;
}) {
  // Acordeão local a esta categoria — só uma pergunta aberta de cada vez
  // dentro dela, tal como cada secção do CV gere o seu próprio `openId`
  // (ver ExperienciaSection/FormacaoSection em EditorForm.tsx).
  const [openId, setOpenId] = useState<string | null>(null);
  const ids = items.map((q) => q.id);
  const { sensors, handleDragEnd } = useItemDragAndDrop(ids, onReorder);

  return (
    <div className="rounded-lg border border-navy-rule bg-card">
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="font-serif text-base text-foreground">{CATEGORY_LABELS[categoria]}</span>
        <span className="font-mono text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div className="border-t border-navy-rule p-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem perguntas nesta categoria.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {items.map((q) => (
                  <ItemCard
                    key={q.id}
                    id={q.id}
                    open={openId === q.id}
                    onToggle={() => setOpenId((cur) => (cur === q.id ? null : q.id))}
                    onRemove={() => {
                      onRemove(q.id);
                      setOpenId((cur) => (cur === q.id ? null : cur));
                    }}
                    summary={<ItemSummary primary={q.pergunta} />}
                  >
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Pergunta
                        </p>
                        <p className="text-sm text-foreground">{q.pergunta}</p>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Resposta sugerida
                        </p>
                        <RichTextField
                          value={q.resposta_sugerida}
                          onChange={(html) => onAnswerChange(q.id, html)}
                          placeholder="Sugestão de discurso para adaptares com as tuas próprias palavras…"
                          minHeight={140}
                          aiSuggestions={{
                            sectionType: "interview_answer",
                            interviewContext: { pergunta: q.pergunta, categoria: q.categoria },
                          }}
                        />
                      </div>
                    </div>
                  </ItemCard>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

export function InterviewPrepEditor({
  draft,
  update,
}: {
  draft: InterviewPrepDraft;
  update: Updater;
}) {
  const setQuestions = (next: InterviewQuestion[]) =>
    update((prev) => ({ ...prev, questions: next }));

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p>
          Estas respostas são <strong>sugestões de discurso</strong> para preparares e adaptares com
          as tuas próprias palavras — não são factos objectivos. Onde o teu CV não tiver evidência
          suficiente, dizemos isso claramente em vez de inventar um exemplo.
        </p>
      </div>

      {CATEGORY_ORDER.map((categoria) => {
        const items = draft.questions.filter((q) => q.categoria === categoria);
        return (
          <CategoryCard
            key={categoria}
            categoria={categoria}
            items={items}
            onReorder={(newIds) =>
              setQuestions(reorderCategoryQuestions(draft.questions, categoria, newIds))
            }
            onAnswerChange={(id, html) =>
              setQuestions(
                draft.questions.map((q) => (q.id === id ? { ...q, resposta_sugerida: html } : q)),
              )
            }
            onRemove={(id) => setQuestions(draft.questions.filter((q) => q.id !== id))}
          />
        );
      })}
    </div>
  );
}
