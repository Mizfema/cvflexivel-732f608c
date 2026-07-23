import { ChevronDown, ChevronRight, GripVertical, Trash2 } from "lucide-react";
import {
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";

/** Pega de arrastar: sempre visível em ecrã táctil (sem "hover"); em ecrã com
 * rato só aparece ao passar por cima do cartão (`group-hover`). Usada tanto
 * nas secções (D1, ver EditorForm.tsx) como nos itens dentro delas (D2). */
export const DRAG_HANDLE_VISIBILITY_CLASS =
  "opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100";

/** D2: sensores + handler de drag-end partilhados por cada secção repetível —
 * cada chamada gere só a sua própria lista de ids (independente das outras
 * secções). `onReorder` recebe a nova ordem de ids; quem chama traduz isso
 * para a nova ordem do array de itens. Genérico: não sabe nada sobre
 * CvExperience/CvFormacao/etc, só mexe em `ids: string[]`. */
export function useItemDragAndDrop(ids: string[], onReorder: (newIds: string[]) => void) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const activeId = String(e.active.id);
    if (!e.over) return;
    const overId = String(e.over.id);
    if (activeId === overId) return;

    const oldIndex = ids.indexOf(activeId);
    const newIndex = ids.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const newIds = [...ids];
    newIds.splice(oldIndex, 1);
    newIds.splice(newIndex, 0, activeId);
    onReorder(newIds);
  };

  return { sensors, handleDragEnd };
}

/** Linha de resumo de um item fechado — campo principal a negrito, secundário
 * mais claro, separados por "·"; "Sem título" quando ambos estão vazios. */
export function ItemSummary({ primary, secondary }: { primary?: string; secondary?: string }) {
  const hasPrimary = !!primary?.trim();
  const hasSecondary = !!secondary?.trim();
  if (!hasPrimary && !hasSecondary) {
    return <span className="text-sm text-muted-foreground">Sem título</span>;
  }
  return (
    <span className="text-sm">
      {hasPrimary && <span className="font-medium text-foreground">{primary}</span>}
      {hasPrimary && hasSecondary && <span className="text-muted-foreground"> · </span>}
      {hasSecondary && <span className="text-muted-foreground">{secondary}</span>}
    </span>
  );
}

/** Cartão de um item dentro de uma secção repetível — equivalente ao
 * SectionCard, mas para o item: fechado por defeito, mostra só o resumo do
 * cabeçalho; clicar expande o formulário completo (comportamento acordeão
 * gerido pelo `open`/`onToggle` do chamador, um por secção). D2: `id` activa
 * a pega de arrastar (reordena dentro da secção — ver useItemDragAndDrop). */
export function ItemCard({
  id,
  open,
  onToggle,
  onRemove,
  summary,
  children,
}: {
  id: string;
  open: boolean;
  onToggle: () => void;
  onRemove: () => void;
  summary: React.ReactNode;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group rounded-md border border-navy-rule/60 bg-surface/40"
    >
      <div className="flex items-center gap-1 px-1.5 py-1.5">
        <button
          type="button"
          className={`flex h-10 w-10 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-black/[0.04] hover:text-foreground active:cursor-grabbing touch-none ${DRAG_HANDLE_VISIBILITY_CLASS}`}
          aria-label="Arrastar item"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 px-1.5 py-2.5 text-left"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1 truncate">{summary}</span>
        </button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onRemove}
          aria-label="Remover"
          className="h-10 w-10 shrink-0"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {open && <div className="border-t border-navy-rule/60 p-3">{children}</div>}
    </div>
  );
}
