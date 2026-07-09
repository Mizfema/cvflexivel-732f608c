import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { useServerFn } from "@tanstack/react-start";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignJustify,
  Sparkles,
  RotateCcw,
  X,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeCvHtml, toSafeHtml, appendSuggestionBullet } from "@/lib/rich-text";
import {
  generateFieldSuggestions,
  type FieldSuggestionSectionType,
} from "@/lib/llm.functions";
import { parseLimitError } from "@/lib/usage-error";
import { UsageLimitNotice } from "@/components/UsageLimitNotice";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MAX_REGENERATIONS = 3;

export type AiSuggestionsConfig = {
  sectionType: FieldSuggestionSectionType;
  fieldContext?: { cargo?: string; organizacao?: string; local?: string };
  cvHeadline?: string;
};

const ALIGN_OPTIONS = [
  { value: "left", label: "Alinhar à esquerda", icon: AlignLeft },
  { value: "center", label: "Centrar", icon: AlignCenter },
  { value: "justify", label: "Justificar", icon: AlignJustify },
] as const;

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md text-[#5b5850] transition-colors hover:bg-[#F1EFE8]",
        active && "bg-[#1D9E75]/10 text-[#1D9E75]",
      )}
    >
      {children}
    </button>
  );
}

function AiSuggestionsToggleButton({
  active,
  loading,
  onClick,
}: {
  active: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-expanded={active}
      aria-label="Sugestões de IA"
      className={cn(
        "flex items-center gap-1.5 rounded-[10px] border border-[#E3DFD7] px-2.5 py-1 text-xs font-medium text-[#5b5850] transition-colors hover:bg-[#F1EFE8] hover:text-[#1D9E75]",
        active && "border-[#1D9E75]/40 bg-[#1D9E75]/10 text-[#1D9E75]",
      )}
    >
      <Sparkles className="h-3.5 w-3.5" />
      {loading ? "A gerar…" : "Sugestões de IA"}
    </button>
  );
}

function AiSuggestionsPanel({
  loading,
  error,
  suggestions,
  regenCount,
  onInsert,
  onRegenerate,
  onClose,
}: {
  loading: boolean;
  error: unknown;
  suggestions: string[];
  regenCount: number;
  onInsert: (text: string) => void;
  onRegenerate: () => void;
  onClose: () => void;
}) {
  const regenDisabled = loading || regenCount >= MAX_REGENERATIONS;

  return (
    <div
      role="region"
      aria-label="Sugestões de IA"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
      className="mt-1.5 rounded-[10px] border border-[#E3DFD7] bg-[#FBFAF7] p-2.5"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#8b877d]">
          Sugestões de IA
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title={
              regenCount >= MAX_REGENERATIONS
                ? "Limite de regenerações atingido"
                : "Gerar novas sugestões"
            }
            aria-label="Gerar novas sugestões"
            disabled={regenDisabled}
            onClick={onRegenerate}
            className="flex h-6 w-6 items-center justify-center rounded-md text-[#5b5850] transition-colors hover:bg-[#F1EFE8] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Fechar"
            aria-label="Fechar sugestões de IA"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-md text-[#5b5850] transition-colors hover:bg-[#F1EFE8]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-7 animate-pulse rounded-md bg-[#EFEBE2]" />
          ))}
        </div>
      ) : error ? (
        parseLimitError(error) ? (
          <UsageLimitNotice feature="ai_suggestions" {...parseLimitError(error)!} />
        ) : (
          <p className="px-1 py-2 text-xs text-red-600">
            {error instanceof Error ? error.message : "Falha ao gerar sugestões."}
          </p>
        )
      ) : suggestions.length === 0 ? (
        <p className="px-1 py-2 text-xs text-muted-foreground">
          Sem mais sugestões — usa o ↻ para gerar novas.
        </p>
      ) : (
        <ul className="space-y-1">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => onInsert(s)}
                className="flex w-full items-start gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-xs text-[#3a3834] transition-colors hover:border-[#E3DFD7] hover:bg-white"
              >
                <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1D9E75]" />
                <span>{s}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RichTextField({
  value,
  onChange,
  placeholder,
  minHeight = 96,
  aiSuggestions,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  aiSuggestions?: AiSuggestionsConfig;
}) {
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSuggestionsList, setAiSuggestionsList] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<unknown>(null);
  const [aiRegenCount, setAiRegenCount] = useState(0);
  const fetchFieldSuggestions = useServerFn(generateFieldSuggestions);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        underline: false,
      }),
      Underline,
      TextAlign.configure({ types: ["paragraph"] }),
    ],
    content: toSafeHtml(value),
    editorProps: {
      attributes: {
        class: "prose-cv focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(sanitizeCvHtml(editor.getHTML()));
    },
  });

  // Mantém o editor sincronizado quando o valor muda por fora (ex: carregar um CV existente).
  useEffect(() => {
    if (!editor) return;
    const incoming = toSafeHtml(value);
    if (incoming !== editor.getHTML()) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div
        className="rounded-[10px] border border-[#E3DFD7] bg-white px-3 py-2 text-sm text-muted-foreground"
        style={{ minHeight }}
      >
        {placeholder}
      </div>
    );
  }

  const runAiFetch = async () => {
    if (!aiSuggestions) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await fetchFieldSuggestions({
        data: {
          sectionType: aiSuggestions.sectionType,
          fieldContext: aiSuggestions.fieldContext ?? {},
          existingHtml: editor.getHTML(),
          cvHeadline: aiSuggestions.cvHeadline ?? "",
          language: "pt",
        },
      });
      setAiSuggestionsList(result.suggestions);
    } catch (e) {
      setAiError(e);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiToggle = () => {
    const next = !aiOpen;
    setAiOpen(next);
    if (next && aiSuggestionsList === null && !aiLoading) {
      void runAiFetch();
    }
  };

  const handleAiRegenerate = () => {
    if (aiRegenCount >= MAX_REGENERATIONS || aiLoading) return;
    setAiRegenCount((c) => c + 1);
    void runAiFetch();
  };

  const handleAiInsert = (text: string) => {
    const newHtml = appendSuggestionBullet(editor.getHTML(), text);
    editor.commands.setContent(newHtml, { emitUpdate: false });
    onChange(sanitizeCvHtml(editor.getHTML()));
    setAiSuggestionsList((prev) => (prev ? prev.filter((s) => s !== text) : prev));
  };

  const isEmpty = editor.isEmpty;
  const currentAlign = ALIGN_OPTIONS.find((a) =>
    editor.isActive({ textAlign: a.value }),
  );
  const CurrentAlignIcon = currentAlign?.icon ?? AlignLeft;

  return (
    <>
      <div className="rounded-[10px] border border-[#E3DFD7] bg-white">
        <div className="relative px-3 py-2" style={{ minHeight }}>
          {isEmpty && placeholder && (
            <p className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground">
              {placeholder}
            </p>
          )}
          <EditorContent editor={editor} className="prose-cv text-sm" />
        </div>
        <div className="flex items-center gap-0.5 border-t border-[#E3DFD7] px-2 py-1.5">
          <ToolbarButton
            label="Negrito"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Itálico"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Sublinhado"
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="h-3.5 w-3.5" />
          </ToolbarButton>

          <span className="mx-1 h-4 w-px bg-[#E3DFD7]" />

          <ToolbarButton
            label="Lista com marcas"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Lista numerada"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolbarButton>

          <span className="mx-1 h-4 w-px bg-[#E3DFD7]" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Alinhamento"
                title="Alinhamento"
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md text-[#5b5850] transition-colors hover:bg-[#F1EFE8]",
                  currentAlign && "bg-[#1D9E75]/10 text-[#1D9E75]",
                )}
              >
                <CurrentAlignIcon className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {ALIGN_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() =>
                    editor.chain().focus().setTextAlign(opt.value).run()
                  }
                >
                  <opt.icon className="mr-2 h-4 w-4" />
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {aiSuggestions && (
            <div className="ml-auto">
              <AiSuggestionsToggleButton
                active={aiOpen}
                loading={aiLoading}
                onClick={handleAiToggle}
              />
            </div>
          )}
        </div>
      </div>
      {aiSuggestions && aiOpen && (
        <AiSuggestionsPanel
          loading={aiLoading}
          error={aiError}
          suggestions={aiSuggestionsList ?? []}
          regenCount={aiRegenCount}
          onInsert={handleAiInsert}
          onRegenerate={handleAiRegenerate}
          onClose={() => setAiOpen(false)}
        />
      )}
    </>
  );
}
