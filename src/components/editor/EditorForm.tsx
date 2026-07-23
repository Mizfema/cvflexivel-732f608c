import {
  Plus,
  ChevronDown,
  ChevronRight,
  GripVertical,
  MoreVertical,
  Eraser,
  Pencil,
  EyeOff,
  Scissors,
  type LucideIcon,
} from "lucide-react";
import { useId, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import {
  DRAG_HANDLE_VISIBILITY_CLASS,
  ItemCard,
  ItemSummary,
  useItemDragAndDrop,
} from "./ItemAccordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RichTextField } from "@/components/ui/RichTextField";
import { PhotoField } from "@/components/PhotoField";
import { OrganizarSeccoes } from "./OrganizarSeccoes";
import { SECTION_ICONS, EXTRA_TYPE_ICONS } from "@/lib/section-icons";
import { CONTACT_ICONS } from "@/lib/contact-items";
import {
  resolveSectionLayout,
  isExtraKey,
  extraIdFromKey,
  extraKey,
  moveSectionToZone,
  getSectionTitle,
  isSectionHidden,
  hasPageBreakBefore,
} from "@/lib/cv-section-layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  CvDraft,
  CvExperience,
  CvFormacao,
  CvCompetencia,
  CvIdioma,
  CvSecaoExtra,
} from "@/lib/cv-types";
import type { TemplateInfo } from "@/lib/cv-design-presets";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

type Updater = (updater: (prev: CvDraft) => CvDraft) => void;

/** Props do menu de três pontos (E2/E3/E4), calculadas uma vez em EditorForm
 * (sidebarPropsFor) e encaminhadas por cada secção para o seu SectionCard. */
type SidebarToggleProps = {
  /** Título efectivo (com override de sectionLayout.titles, se existir) —
   * usado tanto no cabeçalho do cartão como para pré-preencher "Renomear". */
  titulo: string;
  showSidebarToggle: boolean;
  sidebarChecked: boolean;
  onToggleSidebar: (checked: boolean) => void;
  /** E3: falso para extras — já têm o próprio campo "Título da secção". */
  canRename: boolean;
  onRename: (newTitle: string) => void;
  /** E4: só as secções fixas não-Perfil podem ser ocultadas por aqui. */
  canRemove: boolean;
  onRemove: () => void;
  /** Fase F: falso para a 1.ª secção da ordem global (evita página em branco). */
  canPageBreak: boolean;
  pageBreakActive: boolean;
  onTogglePageBreak: () => void;
};

const tiposExtra: Array<{ value: CvSecaoExtra["tipo"]; label: string }> = [
  { value: "cursos", label: "Cursos" },
  { value: "estagios", label: "Estágios" },
  { value: "certificados", label: "Certificados" },
  { value: "realizacoes", label: "Realizações" },
  { value: "atividades", label: "Atividades" },
  { value: "qualidades", label: "Qualidades" },
];

export function EditorForm({
  draft,
  template,
  update,
  userId,
  onGatedPhotoClick,
}: {
  draft: CvDraft;
  template: TemplateInfo;
  update: Updater;
  /** Sessão iniciada: necessário para upload de foto (Supabase Storage exige auth). */
  userId?: string;
  onGatedPhotoClick?: () => void;
}) {
  // Fonte de verdade da ordem visual dos cartões — a mesma que o motor de
  // render usa (ver useCvBlocks.tsx) e que o cartão "Organizar secções" edita.
  // D1 só reordena; a colocação (main/sidebar) de cada secção é preservada.
  const layout = useMemo(() => resolveSectionLayout(draft, template), [draft, template]);

  // E2: props do interruptor "Secção na barra lateral" — escondido em
  // templates sem sidebar, e a mesma operação (moveSectionToZone) que o
  // cartão "Organizar secções" já usa ao largar uma secção noutra zona.
  const isSidebarTemplate = template.layout === "sidebar";

  // E3: renomear — título vazio ou igual ao título por omissão remove a
  // entrada de `titles` (evita lixo acumulado em vez de guardar duplicados).
  function renameSection(key: string, newTitle: string) {
    const trimmed = newTitle.trim();
    const defaultTitle = getSectionTitle(key, { order: layout.order, placement: layout.placement }, draft);
    const nextTitles = { ...layout.titles };
    if (trimmed === "" || trimmed === defaultTitle) {
      delete nextTitles[key];
    } else {
      nextTitles[key] = trimmed;
    }
    update((prev) => ({
      ...prev,
      sectionLayout: { ...layout, titles: nextTitles },
    }));
  }

  // E4: ocultar/repor — só mexe em `hidden`, nunca em draft.sections (os
  // dados da secção continuam intactos enquanto estiver oculta).
  function hideSection(key: string) {
    update((prev) => ({
      ...prev,
      sectionLayout: { ...layout, hidden: [...(layout.hidden ?? []), key] },
    }));
  }
  function restoreSection(key: string) {
    update((prev) => ({
      ...prev,
      sectionLayout: { ...layout, hidden: (layout.hidden ?? []).filter((k) => k !== key) },
    }));
  }

  // Fase F: alterna a quebra de página manual. A UI (SectionMenu) já esconde
  // esta opção para a 1.ª secção da ordem global (canPageBreak), mas
  // repetimos a guarda aqui — nunca vale a pena forçar uma quebra antes do
  // 1.º conteúdo, criaria uma página em branco.
  function togglePageBreak(key: string) {
    if (layout.order[0] === key) return;
    const current = layout.pageBreakBefore ?? [];
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];
    update((prev) => ({
      ...prev,
      sectionLayout: { ...layout, pageBreakBefore: next },
    }));
  }

  function sidebarPropsFor(key: string): SidebarToggleProps {
    return {
      titulo: getSectionTitle(key, layout, draft),
      showSidebarToggle: isSidebarTemplate,
      sidebarChecked: layout.placement[key] === "sidebar",
      onToggleSidebar: (checked: boolean) =>
        update((prev) => ({
          ...prev,
          sectionLayout: moveSectionToZone(layout, key, checked ? "sidebar" : "main"),
        })),
      canRename: !isExtraKey(key),
      onRename: (newTitle: string) => renameSection(key, newTitle),
      canRemove: key !== "perfil" && !isExtraKey(key),
      onRemove: () => hideSection(key),
      canPageBreak: layout.order[0] !== key,
      pageBreakActive: hasPageBreakBefore(key, layout),
      onTogglePageBreak: () => togglePageBreak(key),
    };
  }

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

    const oldIndex = layout.order.indexOf(activeId);
    const newIndex = layout.order.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const newOrder = [...layout.order];
    newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, activeId);

    update((prev) => ({
      ...prev,
      sectionLayout: { order: newOrder, placement: layout.placement },
    }));
  };

  function renderSection(key: string) {
    switch (key) {
      case "perfil":
        return (
          <PerfilSection
            key={key}
            draft={draft}
            update={update}
            userId={userId}
            onGatedPhotoClick={onGatedPhotoClick}
            {...sidebarPropsFor(key)}
          />
        );
      case "experiencia":
        return (
          <ExperienciaSection key={key} draft={draft} update={update} {...sidebarPropsFor(key)} />
        );
      case "formacao":
        return (
          <FormacaoSection key={key} draft={draft} update={update} {...sidebarPropsFor(key)} />
        );
      case "competencias":
        return (
          <CompetenciasSection key={key} draft={draft} update={update} {...sidebarPropsFor(key)} />
        );
      case "idiomas":
        return (
          <IdiomasSection key={key} draft={draft} update={update} {...sidebarPropsFor(key)} />
        );
      default: {
        if (!isExtraKey(key)) return null;
        const sec = draft.sections.extras.find((s) => s.id === extraIdFromKey(key));
        if (!sec) return null;
        return (
          <ExtraSection
            key={key}
            sec={sec}
            update={update}
            cvHeadline={draft.sections.perfil.headline}
            {...sidebarPropsFor(key)}
          />
        );
      }
    }
  }

  // E4: uma secção oculta não aparece no editor (só some do CV/preview via
  // keysByZone) — filtra aqui também, senão o cartão fica "fantasma".
  const visibleOrder = layout.order.filter((key) => !isSectionHidden(key, layout));

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleOrder} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">{visibleOrder.map(renderSection)}</div>
        </SortableContext>
      </DndContext>
      {(layout.hidden ?? []).length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-navy-rule bg-surface/30 p-3">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Ocultadas:
          </span>
          {(layout.hidden ?? []).map((key) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => restoreSection(key)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Repor {getSectionTitle(key, layout, draft)}
            </Button>
          ))}
        </div>
      )}
      <OrganizarSeccoes draft={draft} template={template} update={update} />
      <AdicionarSecao update={update} />
    </div>
  );
}

/** Menu de três pontos de uma secção (E1/E2): "Limpar secção" (com
 * confirmação) e, só em templates com sidebar, o interruptor "Secção na
 * barra lateral". O AlertDialog de confirmação vive fora do DropdownMenu,
 * controlado por estado próprio — nunca aninhar um trigger de diálogo dentro
 * de um DropdownMenuItem, porque o menu fecha (e desmonta) antes do diálogo
 * ter oportunidade de abrir. */
function SectionMenu({
  titulo,
  onClear,
  showSidebarToggle,
  sidebarChecked,
  onToggleSidebar,
  canRename,
  onRename,
  canRemove,
  onRemove,
  canPageBreak,
  pageBreakActive,
  onTogglePageBreak,
}: {
  titulo: string;
  onClear: () => void;
  showSidebarToggle: boolean;
  sidebarChecked: boolean;
  onToggleSidebar: (checked: boolean) => void;
  canRename: boolean;
  onRename: (newTitle: string) => void;
  canRemove: boolean;
  onRemove: () => void;
  canPageBreak: boolean;
  pageBreakActive: boolean;
  onTogglePageBreak: () => void;
}) {
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(titulo);
  const sidebarToggleId = useId();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-black/[0.04] hover:text-foreground"
            aria-label={`Mais opções — ${titulo}`}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {canRename && (
            <DropdownMenuItem
              onClick={() => {
                setRenameValue(titulo);
                setRenameOpen(true);
              }}
            >
              <Pencil className="h-4 w-4" />
              Renomear secção
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => setConfirmClearOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Eraser className="h-4 w-4" />
            Limpar secção
          </DropdownMenuItem>
          {canRemove && (
            <DropdownMenuItem onClick={() => setConfirmRemoveOpen(true)}>
              <EyeOff className="h-4 w-4" />
              Remover secção
            </DropdownMenuItem>
          )}
          {canPageBreak && (
            <DropdownMenuItem onClick={onTogglePageBreak}>
              <Scissors className="h-4 w-4" />
              {pageBreakActive ? "Remover quebra de página" : "Adicionar quebra de página"}
            </DropdownMenuItem>
          )}
          {showSidebarToggle && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Opções de layout
              </DropdownMenuLabel>
              {/* Toda a linha é clicável (não só o interruptor de 20px) — alvo de toque
                  adequado em ecrã táctil (Fase G). */}
              <label
                htmlFor={sidebarToggleId}
                className="flex cursor-pointer items-center justify-between gap-3 px-2 py-2.5"
              >
                <span className="text-sm text-foreground">Secção na barra lateral</span>
                <Switch
                  id={sidebarToggleId}
                  checked={sidebarChecked}
                  onCheckedChange={onToggleSidebar}
                />
              </label>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Renomear secção</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder={titulo}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onRename(renameValue);
                setRenameOpen(false);
              }
            }}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                onRename(renameValue);
                setRenameOpen(false);
              }}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar &ldquo;{titulo}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Tens a certeza? Esta acção não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onClear}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Limpar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover &ldquo;{titulo}&rdquo; do CV?</AlertDialogTitle>
            <AlertDialogDescription>
              Os dados desta secção ficam guardados — podes repor &ldquo;{titulo}&rdquo; mais
              tarde, junto de "Adicionar secção".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onRemove}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SectionCard({
  id,
  titulo,
  icon: Icon,
  contagem,
  defaultOpen = true,
  onClear,
  showSidebarToggle,
  sidebarChecked,
  onToggleSidebar,
  canRename,
  onRename,
  canRemove,
  onRemove,
  canPageBreak,
  pageBreakActive,
  onTogglePageBreak,
  children,
}: {
  /** Chave em sectionLayout.order — activa a pega de arrastar (D1). */
  id: string;
  titulo: string;
  icon?: LucideIcon;
  contagem?: number;
  defaultOpen?: boolean;
  /** E1: acção do menu de três pontos "Limpar secção". */
  onClear: () => void;
  /** E2: só true em templates com layout "sidebar". */
  showSidebarToggle: boolean;
  sidebarChecked: boolean;
  onToggleSidebar: (checked: boolean) => void;
  /** E3: renomear (falso para extras — já têm o próprio campo de título). */
  canRename: boolean;
  onRename: (newTitle: string) => void;
  /** E4: ocultar do CV, sem apagar dados (só secções fixas não-Perfil). */
  canRemove: boolean;
  onRemove: () => void;
  /** Fase F: falso para a 1.ª secção da ordem global. */
  canPageBreak: boolean;
  pageBreakActive: boolean;
  onTogglePageBreak: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
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
      className="group rounded-lg border border-navy-rule bg-card"
    >
      <div className="flex w-full items-center gap-1 px-2 py-2">
        <button
          type="button"
          className={`flex h-10 w-10 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-black/[0.04] hover:text-foreground active:cursor-grabbing touch-none ${DRAG_HANDLE_VISIBILITY_CLASS}`}
          aria-label={`Arrastar secção ${titulo}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <span className="truncate font-serif text-base text-foreground">{titulo}</span>
          {contagem !== undefined && (
            <span className="font-mono text-xs text-muted-foreground">{contagem}</span>
          )}
        </button>
        <SectionMenu
          titulo={titulo}
          onClear={onClear}
          showSidebarToggle={showSidebarToggle}
          sidebarChecked={sidebarChecked}
          onToggleSidebar={onToggleSidebar}
          canRename={canRename}
          onRename={onRename}
          canRemove={canRemove}
          onRemove={onRemove}
          canPageBreak={canPageBreak}
          pageBreakActive={pageBreakActive}
          onTogglePageBreak={onTogglePageBreak}
        />
      </div>
      {open && <div className="border-t border-navy-rule p-4">{children}</div>}
    </div>
  );
}

export function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </Label>
      {children}
    </div>
  );
}

// ---------- Perfil ----------
function PerfilSection({
  draft,
  update,
  userId,
  onGatedPhotoClick,
  titulo,
  showSidebarToggle,
  sidebarChecked,
  onToggleSidebar,
  canRename,
  onRename,
  canRemove,
  onRemove,
  canPageBreak,
  pageBreakActive,
  onTogglePageBreak,
}: {
  draft: CvDraft;
  update: Updater;
  userId?: string;
  onGatedPhotoClick?: () => void;
} & SidebarToggleProps) {
  const p = draft.sections.perfil;
  const set = <K extends keyof typeof p>(key: K, value: (typeof p)[K]) =>
    update((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        perfil: { ...prev.sections.perfil, [key]: value },
      },
    }));

  return (
    <SectionCard
      id="perfil"
      titulo={titulo}
      icon={SECTION_ICONS.perfil}
      onClear={() => set("resumo", "")}
      showSidebarToggle={showSidebarToggle}
      sidebarChecked={sidebarChecked}
      onToggleSidebar={onToggleSidebar}
      canRename={canRename}
      onRename={onRename}
      canRemove={canRemove}
      onRemove={onRemove}
      canPageBreak={canPageBreak}
      pageBreakActive={pageBreakActive}
      onTogglePageBreak={onTogglePageBreak}
    >
      <div className="mb-4">
        <PhotoField
          photo={p.foto}
          onChange={(foto) => set("foto", foto)}
          userId={userId}
          gated={!userId}
          onGatedClick={onGatedPhotoClick}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome completo">
          <Input
            value={p.nome}
            onChange={(e) => set("nome", e.target.value)}
            placeholder="Ana Macuácua"
          />
        </Field>
        <Field label="Cargo / título">
          <Input
            value={p.headline}
            onChange={(e) => set("headline", e.target.value)}
            placeholder="Oficial de Monitoria e avaliação"
          />
        </Field>
        <Field label="Email" icon={CONTACT_ICONS.email}>
          <Input
            type="email"
            value={p.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="ana@exemplo.mz"
          />
        </Field>
        <Field label="Telefone" icon={CONTACT_ICONS.telefone}>
          <Input
            value={p.telefone}
            onChange={(e) => set("telefone", e.target.value)}
            placeholder="+258 84 000 0000"
          />
        </Field>
        <Field label="Cidade" icon={CONTACT_ICONS.localizacao}>
          <Input
            value={p.cidade}
            onChange={(e) => set("cidade", e.target.value)}
            placeholder="Maputo"
          />
        </Field>
        <Field label="País">
          <Input value={p.pais} onChange={(e) => set("pais", e.target.value)} />
        </Field>
        <Field label="Morada" icon={CONTACT_ICONS.morada}>
          <Input
            value={p.morada ?? ""}
            onChange={(e) => set("morada", e.target.value)}
            placeholder="Av. Julius Nyerere, 123"
          />
        </Field>
        <Field label="Carta de condução" icon={CONTACT_ICONS.cartaConducao}>
          <Input
            value={p.cartaConducao ?? ""}
            onChange={(e) => set("cartaConducao", e.target.value)}
            placeholder="Categoria B"
          />
        </Field>
        <Field label="Data de nascimento" icon={CONTACT_ICONS.dataNascimento}>
          <Input
            value={p.dataNascimento ?? ""}
            onChange={(e) => set("dataNascimento", e.target.value)}
            placeholder="8 de outubro de 1995"
          />
        </Field>
        <Field label="Género" icon={CONTACT_ICONS.genero}>
          <Input
            value={p.genero ?? ""}
            onChange={(e) => set("genero", e.target.value)}
            placeholder="Masculino"
          />
        </Field>
        <Field label="Estado civil" icon={CONTACT_ICONS.estadoCivil}>
          <Input
            value={p.estadoCivil ?? ""}
            onChange={(e) => set("estadoCivil", e.target.value)}
            placeholder="Solteiro(a)"
          />
        </Field>
        <Field label="LinkedIn" icon={CONTACT_ICONS.linkedin}>
          <Input
            value={p.linkedin ?? ""}
            onChange={(e) => set("linkedin", e.target.value)}
            placeholder="linkedin.com/in/…"
          />
        </Field>
        <Field label="Website" icon={CONTACT_ICONS.website}>
          <Input value={p.website ?? ""} onChange={(e) => set("website", e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Resumo profissional">
            <RichTextField
              value={p.resumo ?? ""}
              onChange={(html) => set("resumo", html)}
              placeholder="2-4 frases que resumem o teu percurso, focando o que é relevante para o setor."
              minHeight={110}
              aiSuggestions={{
                sectionType: "summary",
                fieldContext: { cargo: p.headline || undefined },
                cvHeadline: p.headline,
              }}
            />
          </Field>
        </div>
      </div>
    </SectionCard>
  );
}

// ---------- Experiência ----------
function ExperienciaSection({
  draft,
  update,
  titulo,
  showSidebarToggle,
  sidebarChecked,
  onToggleSidebar,
  canRename,
  onRename,
  canRemove,
  onRemove,
  canPageBreak,
  pageBreakActive,
  onTogglePageBreak,
}: { draft: CvDraft; update: Updater } & SidebarToggleProps) {
  const items = draft.sections.experiencia;
  const cvHeadline = draft.sections.perfil.headline;
  const [openId, setOpenId] = useState<string | null>(null);
  const setItems = (next: CvExperience[]) =>
    update((prev) => ({
      ...prev,
      sections: { ...prev.sections, experiencia: next },
    }));

  const add = () => {
    const item: CvExperience = {
      id: uid(),
      cargo: "",
      organizacao: "",
      local: "",
      inicio: "",
      fim: "",
    };
    setItems([...items, item]);
    setOpenId(item.id);
  };

  const remove = (id: string) => {
    setItems(items.filter((x) => x.id !== id));
    setOpenId((cur) => (cur === id ? null : cur));
  };

  const ids = items.map((it) => it.id);
  const { sensors, handleDragEnd } = useItemDragAndDrop(ids, (newIds) =>
    setItems(newIds.map((id) => items.find((x) => x.id === id)!)),
  );

  return (
    <SectionCard
      id="experiencia"
      titulo={titulo}
      icon={SECTION_ICONS.experiencia}
      contagem={items.length}
      onClear={() => setItems([])}
      showSidebarToggle={showSidebarToggle}
      sidebarChecked={sidebarChecked}
      onToggleSidebar={onToggleSidebar}
      canRename={canRename}
      onRename={onRename}
      canRemove={canRemove}
      onRemove={onRemove}
      canPageBreak={canPageBreak}
      pageBreakActive={pageBreakActive}
      onTogglePageBreak={onTogglePageBreak}
    >
      <div className="space-y-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {items.map((it) => (
                <ItemCard
                  key={it.id}
                  id={it.id}
                  open={openId === it.id}
                  onToggle={() => setOpenId((cur) => (cur === it.id ? null : it.id))}
                  onRemove={() => remove(it.id)}
                  summary={<ItemSummary primary={it.cargo} secondary={it.organizacao} />}
                >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Cargo">
                <Input
                  value={it.cargo}
                  onChange={(e) =>
                    setItems(
                      items.map((x) => (x.id === it.id ? { ...x, cargo: e.target.value } : x)),
                    )
                  }
                />
              </Field>
              <Field label="Organização">
                <Input
                  value={it.organizacao}
                  onChange={(e) =>
                    setItems(
                      items.map((x) =>
                        x.id === it.id ? { ...x, organizacao: e.target.value } : x,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Local">
                <Input
                  value={it.local ?? ""}
                  onChange={(e) =>
                    setItems(
                      items.map((x) => (x.id === it.id ? { ...x, local: e.target.value } : x)),
                    )
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Início">
                  <Input
                    value={it.inicio ?? ""}
                    onChange={(e) =>
                      setItems(
                        items.map((x) => (x.id === it.id ? { ...x, inicio: e.target.value } : x)),
                      )
                    }
                    placeholder="2022-01"
                  />
                </Field>
                <Field label="Fim">
                  <Input
                    value={it.fim ?? ""}
                    onChange={(e) =>
                      setItems(
                        items.map((x) => (x.id === it.id ? { ...x, fim: e.target.value } : x)),
                      )
                    }
                    placeholder="atual"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Descrição / responsabilidades">
                  <RichTextField
                    value={it.descricao ?? ""}
                    onChange={(html) =>
                      setItems(items.map((x) => (x.id === it.id ? { ...x, descricao: html } : x)))
                    }
                    placeholder="Liderança de equipa de X pessoas, resultado mensurável…"
                    minHeight={90}
                    aiSuggestions={{
                      sectionType: "experience",
                      fieldContext: {
                        cargo: it.cargo || undefined,
                        organizacao: it.organizacao || undefined,
                        local: it.local || undefined,
                      },
                      cvHeadline,
                    }}
                  />
                </Field>
              </div>
            </div>
                </ItemCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <Button type="button" variant="outline" onClick={add} className="w-full">
          <Plus className="mr-2 h-4 w-4" /> Adicionar experiência
        </Button>
      </div>
    </SectionCard>
  );
}

// ---------- Formação ----------
function FormacaoSection({
  draft,
  update,
  titulo,
  showSidebarToggle,
  sidebarChecked,
  onToggleSidebar,
  canRename,
  onRename,
  canRemove,
  onRemove,
  canPageBreak,
  pageBreakActive,
  onTogglePageBreak,
}: { draft: CvDraft; update: Updater } & SidebarToggleProps) {
  const items = draft.sections.formacao;
  const cvHeadline = draft.sections.perfil.headline;
  const [openId, setOpenId] = useState<string | null>(null);
  const setItems = (next: CvFormacao[]) =>
    update((prev) => ({
      ...prev,
      sections: { ...prev.sections, formacao: next },
    }));

  const add = () => {
    const item: CvFormacao = { id: uid(), curso: "", instituicao: "", inicio: "", fim: "" };
    setItems([...items, item]);
    setOpenId(item.id);
  };

  const remove = (id: string) => {
    setItems(items.filter((x) => x.id !== id));
    setOpenId((cur) => (cur === id ? null : cur));
  };

  const ids = items.map((it) => it.id);
  const { sensors, handleDragEnd } = useItemDragAndDrop(ids, (newIds) =>
    setItems(newIds.map((id) => items.find((x) => x.id === id)!)),
  );

  return (
    <SectionCard
      id="formacao"
      titulo={titulo}
      icon={SECTION_ICONS.formacao}
      contagem={items.length}
      defaultOpen={false}
      onClear={() => setItems([])}
      showSidebarToggle={showSidebarToggle}
      sidebarChecked={sidebarChecked}
      onToggleSidebar={onToggleSidebar}
      canRename={canRename}
      onRename={onRename}
      canRemove={canRemove}
      onRemove={onRemove}
      canPageBreak={canPageBreak}
      pageBreakActive={pageBreakActive}
      onTogglePageBreak={onTogglePageBreak}
    >
      <div className="space-y-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {items.map((it) => (
                <ItemCard
                  key={it.id}
                  id={it.id}
                  open={openId === it.id}
                  onToggle={() => setOpenId((cur) => (cur === it.id ? null : it.id))}
                  onRemove={() => remove(it.id)}
                  summary={<ItemSummary primary={it.curso} secondary={it.instituicao} />}
                >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Curso / grau">
                <Input
                  value={it.curso}
                  onChange={(e) =>
                    setItems(
                      items.map((x) => (x.id === it.id ? { ...x, curso: e.target.value } : x)),
                    )
                  }
                />
              </Field>
              <Field label="Instituição">
                <Input
                  value={it.instituicao}
                  onChange={(e) =>
                    setItems(
                      items.map((x) =>
                        x.id === it.id ? { ...x, instituicao: e.target.value } : x,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Início">
                <Input
                  value={it.inicio ?? ""}
                  onChange={(e) =>
                    setItems(
                      items.map((x) => (x.id === it.id ? { ...x, inicio: e.target.value } : x)),
                    )
                  }
                />
              </Field>
              <Field label="Fim">
                <Input
                  value={it.fim ?? ""}
                  onChange={(e) =>
                    setItems(items.map((x) => (x.id === it.id ? { ...x, fim: e.target.value } : x)))
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Descrição">
                  <RichTextField
                    value={it.descricao ?? ""}
                    onChange={(html) =>
                      setItems(items.map((x) => (x.id === it.id ? { ...x, descricao: html } : x)))
                    }
                    minHeight={70}
                    aiSuggestions={{
                      sectionType: "education",
                      fieldContext: {
                        cargo: it.curso || undefined,
                        organizacao: it.instituicao || undefined,
                        local: it.local || undefined,
                      },
                      cvHeadline,
                    }}
                  />
                </Field>
              </div>
            </div>
                </ItemCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <Button type="button" variant="outline" onClick={add} className="w-full">
          <Plus className="mr-2 h-4 w-4" /> Adicionar formação
        </Button>
      </div>
    </SectionCard>
  );
}

// ---------- Competências ----------
function CompetenciasSection({
  draft,
  update,
  titulo,
  showSidebarToggle,
  sidebarChecked,
  onToggleSidebar,
  canRename,
  onRename,
  canRemove,
  onRemove,
  canPageBreak,
  pageBreakActive,
  onTogglePageBreak,
}: { draft: CvDraft; update: Updater } & SidebarToggleProps) {
  const items = draft.sections.competencias;
  const [openId, setOpenId] = useState<string | null>(null);
  const setItems = (next: CvCompetencia[]) =>
    update((prev) => ({
      ...prev,
      sections: { ...prev.sections, competencias: next },
    }));

  const add = () => {
    const item: CvCompetencia = { id: uid(), nome: "" };
    setItems([...items, item]);
    setOpenId(item.id);
  };

  const remove = (id: string) => {
    setItems(items.filter((x) => x.id !== id));
    setOpenId((cur) => (cur === id ? null : cur));
  };

  const ids = items.map((it) => it.id);
  const { sensors, handleDragEnd } = useItemDragAndDrop(ids, (newIds) =>
    setItems(newIds.map((id) => items.find((x) => x.id === id)!)),
  );

  return (
    <SectionCard
      id="competencias"
      titulo={titulo}
      icon={SECTION_ICONS.competencias}
      contagem={items.length}
      defaultOpen={false}
      onClear={() => setItems([])}
      showSidebarToggle={showSidebarToggle}
      sidebarChecked={sidebarChecked}
      onToggleSidebar={onToggleSidebar}
      canRename={canRename}
      onRename={onRename}
      canRemove={canRemove}
      onRemove={onRemove}
      canPageBreak={canPageBreak}
      pageBreakActive={pageBreakActive}
      onTogglePageBreak={onTogglePageBreak}
    >
      <div className="space-y-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {items.map((it) => (
                <ItemCard
                  key={it.id}
                  id={it.id}
                  open={openId === it.id}
                  onToggle={() => setOpenId((cur) => (cur === it.id ? null : it.id))}
                  onRemove={() => remove(it.id)}
                  summary={<ItemSummary primary={it.nome} />}
                >
            <div className="flex items-center gap-2">
              <Input
                value={it.nome}
                placeholder="Ex.: Gestão de projeto"
                onChange={(e) =>
                  setItems(
                    items.map((x) => (x.id === it.id ? { ...x, nome: e.target.value } : x)),
                  )
                }
              />
              <Select
                value={it.nivel ?? ""}
                onValueChange={(v) =>
                  setItems(
                    items.map((x) =>
                      x.id === it.id
                        ? { ...x, nivel: (v || undefined) as CvCompetencia["nivel"] }
                        : x,
                    ),
                  )
                }
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Nível" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basico">Básico</SelectItem>
                  <SelectItem value="intermedio">Intermédio</SelectItem>
                  <SelectItem value="avancado">Avançado</SelectItem>
                  <SelectItem value="especialista">Especialista</SelectItem>
                </SelectContent>
              </Select>
            </div>
                </ItemCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <Button type="button" variant="outline" onClick={add} className="w-full">
          <Plus className="mr-2 h-4 w-4" /> Adicionar competência
        </Button>
      </div>
    </SectionCard>
  );
}

// ---------- Idiomas ----------
function IdiomasSection({
  draft,
  update,
  titulo,
  showSidebarToggle,
  sidebarChecked,
  onToggleSidebar,
  canRename,
  onRename,
  canRemove,
  onRemove,
  canPageBreak,
  pageBreakActive,
  onTogglePageBreak,
}: { draft: CvDraft; update: Updater } & SidebarToggleProps) {
  const items = draft.sections.idiomas;
  const [openId, setOpenId] = useState<string | null>(null);
  const setItems = (next: CvIdioma[]) =>
    update((prev) => ({
      ...prev,
      sections: { ...prev.sections, idiomas: next },
    }));

  const add = () => {
    const item: CvIdioma = { id: uid(), idioma: "" };
    setItems([...items, item]);
    setOpenId(item.id);
  };

  const remove = (id: string) => {
    setItems(items.filter((x) => x.id !== id));
    setOpenId((cur) => (cur === id ? null : cur));
  };

  const ids = items.map((it) => it.id);
  const { sensors, handleDragEnd } = useItemDragAndDrop(ids, (newIds) =>
    setItems(newIds.map((id) => items.find((x) => x.id === id)!)),
  );

  return (
    <SectionCard
      id="idiomas"
      titulo={titulo}
      icon={SECTION_ICONS.idiomas}
      contagem={items.length}
      defaultOpen={false}
      onClear={() => setItems([])}
      showSidebarToggle={showSidebarToggle}
      sidebarChecked={sidebarChecked}
      onToggleSidebar={onToggleSidebar}
      canRename={canRename}
      onRename={onRename}
      canRemove={canRemove}
      onRemove={onRemove}
      canPageBreak={canPageBreak}
      pageBreakActive={pageBreakActive}
      onTogglePageBreak={onTogglePageBreak}
    >
      <div className="space-y-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {items.map((it) => (
                <ItemCard
                  key={it.id}
                  id={it.id}
                  open={openId === it.id}
                  onToggle={() => setOpenId((cur) => (cur === it.id ? null : it.id))}
                  onRemove={() => remove(it.id)}
                  summary={<ItemSummary primary={it.idioma} />}
                >
            <div className="flex items-center gap-2">
              <Input
                value={it.idioma}
                placeholder="Ex.: Inglês"
                onChange={(e) =>
                  setItems(
                    items.map((x) => (x.id === it.id ? { ...x, idioma: e.target.value } : x)),
                  )
                }
              />
              <Select
                value={it.nivel ?? ""}
                onValueChange={(v) =>
                  setItems(
                    items.map((x) =>
                      x.id === it.id ? { ...x, nivel: (v || undefined) as CvIdioma["nivel"] } : x,
                    ),
                  )
                }
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Nível" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basico">Básico</SelectItem>
                  <SelectItem value="intermedio">Intermédio</SelectItem>
                  <SelectItem value="avancado">Avançado</SelectItem>
                  <SelectItem value="fluente">Fluente</SelectItem>
                  <SelectItem value="nativo">Nativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
                </ItemCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <Button type="button" variant="outline" onClick={add} className="w-full">
          <Plus className="mr-2 h-4 w-4" /> Adicionar idioma
        </Button>
      </div>
    </SectionCard>
  );
}

// ---------- Secções extras ----------
function ExtraSection({
  sec,
  update,
  cvHeadline,
  showSidebarToggle,
  sidebarChecked,
  onToggleSidebar,
  canRename,
  onRename,
  canRemove,
  onRemove,
  canPageBreak,
  pageBreakActive,
  onTogglePageBreak,
}: {
  sec: CvSecaoExtra;
  update: Updater;
  cvHeadline?: string;
} & SidebarToggleProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  const setSec = (next: CvSecaoExtra) =>
    update((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        extras: prev.sections.extras.map((s) => (s.id === sec.id ? next : s)),
      },
    }));

  const remove = () =>
    update((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        extras: prev.sections.extras.filter((s) => s.id !== sec.id),
      },
    }));

  const addItem = () => {
    const item = { id: uid(), titulo: "" };
    setSec({ ...sec, itens: [...sec.itens, item] });
    setOpenId(item.id);
  };

  const removeItem = (id: string) => {
    setSec({ ...sec, itens: sec.itens.filter((x) => x.id !== id) });
    setOpenId((cur) => (cur === id ? null : cur));
  };

  const ids = sec.itens.map((it) => it.id);
  const { sensors, handleDragEnd } = useItemDragAndDrop(ids, (newIds) =>
    setSec({ ...sec, itens: newIds.map((id) => sec.itens.find((x) => x.id === id)!) }),
  );

  return (
    <SectionCard
      id={extraKey(sec.id)}
      titulo={sec.titulo}
      icon={EXTRA_TYPE_ICONS[sec.tipo]}
      contagem={sec.itens.length}
      onClear={() => setSec({ ...sec, itens: [] })}
      showSidebarToggle={showSidebarToggle}
      sidebarChecked={sidebarChecked}
      onToggleSidebar={onToggleSidebar}
      canRename={canRename}
      onRename={onRename}
      canRemove={canRemove}
      onRemove={onRemove}
      canPageBreak={canPageBreak}
      pageBreakActive={pageBreakActive}
      onTogglePageBreak={onTogglePageBreak}
    >
      <div className="space-y-3">
        <Field label="Título da secção">
          <Input value={sec.titulo} onChange={(e) => setSec({ ...sec, titulo: e.target.value })} />
        </Field>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {sec.itens.map((it) => (
                <ItemCard
                  key={it.id}
                  id={it.id}
                  open={openId === it.id}
                  onToggle={() => setOpenId((cur) => (cur === it.id ? null : it.id))}
                  onRemove={() => removeItem(it.id)}
                  summary={<ItemSummary primary={it.titulo} />}
                >
            <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
              <Field label="Título">
                <Input
                  value={it.titulo}
                  onChange={(e) =>
                    setSec({
                      ...sec,
                      itens: sec.itens.map((x) =>
                        x.id === it.id ? { ...x, titulo: e.target.value } : x,
                      ),
                    })
                  }
                />
              </Field>
              <Field label="Data">
                <Input
                  value={it.data ?? ""}
                  onChange={(e) =>
                    setSec({
                      ...sec,
                      itens: sec.itens.map((x) =>
                        x.id === it.id ? { ...x, data: e.target.value } : x,
                      ),
                    })
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Descrição">
                  <RichTextField
                    value={it.descricao ?? ""}
                    onChange={(html) =>
                      setSec({
                        ...sec,
                        itens: sec.itens.map((x) =>
                          x.id === it.id ? { ...x, descricao: html } : x,
                        ),
                      })
                    }
                    minHeight={70}
                    aiSuggestions={{
                      sectionType: "extra",
                      fieldContext: {
                        cargo: it.titulo || undefined,
                        organizacao: sec.titulo || undefined,
                      },
                      cvHeadline,
                    }}
                  />
                </Field>
              </div>
            </div>
                </ItemCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={addItem} className="flex-1">
            <Plus className="mr-2 h-4 w-4" /> Adicionar item
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={remove}
            className="text-destructive hover:text-destructive"
          >
            Remover secção
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

function AdicionarSecao({ update }: { update: Updater }) {
  const add = (tipo: CvSecaoExtra["tipo"], label: string) =>
    update((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        extras: [...prev.sections.extras, { id: uid(), tipo, titulo: label, itens: [] }],
      },
    }));

  return (
    <div className="rounded-lg border border-dashed border-navy-rule bg-surface/30 p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Adicionar secção
      </p>
      <div className="flex flex-wrap gap-2">
        {tiposExtra.map((t) => (
          <Button
            key={t.value}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => add(t.value, t.label)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
