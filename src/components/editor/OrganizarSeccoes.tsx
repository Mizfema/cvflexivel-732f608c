// Cartão "Organizar secções": permite ao utilizador reordenar as secções do CV
// e (em templates com sidebar) movê-las entre a coluna principal e a barra
// lateral. Escreve o resultado em draft.sectionLayout via update(), o que
// dispara o autosave já existente.
//
// Regras de produto (decididas com o utilizador):
//  • O cabeçalho da sidebar (foto + nome + "Informações pessoais") é FIXO e
//    NÃO aparece nesta UI — só as secções de conteúdo são movíveis.
//  • Em templates sem sidebar: aparece uma só lista (só se reordena).
//  • O cartão está fechado por defeito (mais discreto).

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, GripVertical, LayoutGrid, type LucideIcon } from "lucide-react";
import type { CvDraft, SectionZone } from "@/lib/cv-types";
import type { TemplateInfo } from "@/lib/cv-design-presets";
import { SECTION_ICONS, EXTRA_TYPE_ICONS } from "@/lib/section-icons";
import {
  resolveSectionLayout,
  keysByZone,
  isExtraKey,
  extraIdFromKey,
  moveSectionToZone,
} from "@/lib/cv-section-layout";

type Updater = (updater: (prev: CvDraft) => CvDraft) => void;

// ────────────────────────────────────────────────────────────────────────────
// Ajudantes de apresentação
// ────────────────────────────────────────────────────────────────────────────

function labelForKey(key: string, draft: CvDraft): string {
  switch (key) {
    case "perfil":
      return "Perfil";
    case "experiencia":
      return "Experiência";
    case "formacao":
      return "Formação";
    case "competencias":
      return "Competências";
    case "idiomas":
      return "Idiomas";
    default:
      if (isExtraKey(key)) {
        const sec = draft.sections.extras.find((e) => e.id === extraIdFromKey(key));
        return sec?.titulo ?? "Secção";
      }
      return key;
  }
}

function iconForKey(key: string, draft: CvDraft): LucideIcon | undefined {
  if (key === "perfil") return SECTION_ICONS.perfil;
  if (key === "experiencia") return SECTION_ICONS.experiencia;
  if (key === "formacao") return SECTION_ICONS.formacao;
  if (key === "competencias") return SECTION_ICONS.competencias;
  if (key === "idiomas") return SECTION_ICONS.idiomas;
  if (isExtraKey(key)) {
    const sec = draft.sections.extras.find((e) => e.id === extraIdFromKey(key));
    return sec ? EXTRA_TYPE_ICONS[sec.tipo] : undefined;
  }
  return undefined;
}

// ────────────────────────────────────────────────────────────────────────────
// Pílula arrastável (uma secção)
// ────────────────────────────────────────────────────────────────────────────

function SortablePill({
  id,
  label,
  Icon,
}: {
  id: string;
  label: string;
  Icon?: LucideIcon;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border border-navy-rule bg-card px-2 py-1.5 text-sm shadow-sm"
    >
      <button
        type="button"
        className="flex h-10 w-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-black/[0.04] hover:text-foreground active:cursor-grabbing"
        aria-label={`Arrastar ${label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      <span className="text-foreground">{label}</span>
    </div>
  );
}

// Overlay que segue o cursor enquanto arrasta (sem ficar transparente).
function OverlayPill({ label, Icon }: { label: string; Icon?: LucideIcon }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-navy-rule bg-card px-2 py-1.5 text-sm shadow-lg">
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      <span className="text-foreground">{label}</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Zona (coluna principal OU barra lateral)
// ────────────────────────────────────────────────────────────────────────────

function Zona({
  titulo,
  ids,
  draft,
}: {
  titulo: string;
  ids: string[];
  draft: CvDraft;
}) {
  const { setNodeRef, isOver } = useSortable({
    id: `__zone__:${titulo}`,
    data: { isZone: true, zoneTitulo: titulo },
    disabled: true, // a própria zona nunca é arrastada; só recebe drops
  });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-md border border-dashed p-2 transition-colors ${
        isOver ? "border-navy-rule bg-surface/60" : "border-navy-rule bg-surface/30"
      }`}
    >
      <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {titulo}
      </p>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1.5 min-h-[40px]">
          {ids.length === 0 && (
            <p className="px-1 py-2 text-xs italic text-muted-foreground">Vazio</p>
          )}
          {ids.map((id) => (
            <SortablePill
              key={id}
              id={id}
              label={labelForKey(id, draft)}
              Icon={iconForKey(id, draft)}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────────────────────────────────────

export function OrganizarSeccoes({
  draft,
  template,
  update,
}: {
  draft: CvDraft;
  template: TemplateInfo;
  update: Updater;
}) {
  const [open, setOpen] = useState(false); // fechado por defeito, conforme decidido
  const [activeId, setActiveId] = useState<string | null>(null);

  const isSidebar = template.layout === "sidebar";
  const layout = useMemo(() => resolveSectionLayout(draft, template), [draft, template]);
  const { main, sidebar } = keysByZone(layout);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // pequena distância para evitar arrastes acidentais em cliques
      activationConstraint: { distance: 4 },
    }),
  );

  // Aplica a nova ordem/colocação escrevendo em draft.sectionLayout.
  const commit = (newOrder: string[], newPlacement: Record<string, SectionZone>) => {
    update((prev) => ({
      ...prev,
      sectionLayout: { order: newOrder, placement: newPlacement },
    }));
  };

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const activeIdStr = String(e.active.id);
    if (!e.over) return;
    const overIdStr = String(e.over.id);
    if (activeIdStr === overIdStr) return;

    // Descobre a zona de destino: pode ser uma zona vazia (id __zone__:...)
    // ou outra pílula (a zona é a onde essa pílula vive).
    let targetZone: SectionZone;
    let targetKey: string | null = null;
    if (overIdStr.startsWith("__zone__:")) {
      targetZone = overIdStr.endsWith(":Barra lateral") ? "sidebar" : "main";
    } else {
      targetKey = overIdStr;
      targetZone = sidebar.includes(overIdStr) ? "sidebar" : "main";
    }

    // Regra: em templates sem sidebar, tudo colapsa na principal — não deixamos
    // arrastar para "sidebar" porque essa zona nem existe na UI.
    if (!isSidebar) targetZone = "main";

    // Novo placement — mesma operação partilhada com o interruptor "Secção
    // na barra lateral" do menu de três pontos de cada cartão.
    const newPlacement = moveSectionToZone(layout, activeIdStr, targetZone).placement;

    // Nova ordem: constrói lista global mantendo a ordem visível resultante.
    // Passo 1: remove o item arrastado da ordem antiga.
    const withoutActive = layout.order.filter((k) => k !== activeIdStr);
    // Passo 2: encontra a posição de destino. Se largou sobre outra pílula,
    // insere imediatamente antes dessa. Se largou numa zona vazia, insere no
    // fim das secções dessa zona.
    let insertAt: number;
    if (targetKey) {
      insertAt = withoutActive.indexOf(targetKey);
      if (insertAt < 0) insertAt = withoutActive.length;
    } else {
      // Índice do último item da zona-alvo em `withoutActive` + 1
      const lastOfZone = [...withoutActive]
        .map((k, i) => ({ k, i }))
        .filter(({ k }) => (newPlacement[k] ?? layout.placement[k] ?? "main") === targetZone)
        .pop();
      insertAt = lastOfZone ? lastOfZone.i + 1 : withoutActive.length;
    }
    const newOrder = [
      ...withoutActive.slice(0, insertAt),
      activeIdStr,
      ...withoutActive.slice(insertAt),
    ];

    commit(newOrder, newPlacement);
  };

  // Fallback: se o utilizador não conseguir arrastar (acessibilidade), oferece
  // um botão para repor o layout por omissão.
  const reset = () => {
    update((prev) => ({ ...prev, sectionLayout: null }));
  };

  return (
    <div className="rounded-lg border border-navy-rule bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          <span className="font-serif text-base text-foreground">Organizar secções</span>
        </div>
      </button>
      {open && (
        <div className="border-t border-navy-rule p-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Arrasta para reordenar
            {isSidebar ? " ou para mover entre a coluna principal e a barra lateral." : "."}
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {isSidebar ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Zona titulo="Coluna principal" ids={main} draft={draft} />
                <Zona titulo="Barra lateral" ids={sidebar} draft={draft} />
              </div>
            ) : (
              <Zona titulo="Ordem das secções" ids={main} draft={draft} />
            )}
            <DragOverlay>
              {activeId ? (
                <OverlayPill
                  label={labelForKey(activeId, draft)}
                  Icon={iconForKey(activeId, draft)}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={reset}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Repor por omissão
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
