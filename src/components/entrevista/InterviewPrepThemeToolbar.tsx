// Selector de tema da pré-visualização da preparação de entrevista —
// modelado em CartaPreviewToolbar.tsx, mas só com o essencial: a entrevista
// não tem `design` próprio (sem seletor de fonte/espaçamento/cor — isso é
// tudo herdado do tema, ver InterviewPrepPagedPreview.tsx). Controlado
// externamente: `template` é a MESMA fonte única usada na exportação
// (InterviewPrepDraft.template, ver InterviewPrepView.tsx) — este componente
// não guarda estado próprio.

import { useEffect } from "react";
import { LayoutGrid } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ensureGoogleFont } from "@/lib/google-fonts";
import { TEMPLATE_THEMES } from "@/lib/templates/themes";

export function InterviewPrepThemeToolbar({
  template,
  onTemplateChange,
}: {
  template: string;
  onTemplateChange: (id: string) => void;
}) {
  useEffect(() => {
    const theme = TEMPLATE_THEMES.find((t) => t.id === template);
    if (theme) ensureGoogleFont(theme.fontFamily);
  }, [template]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-[10px] border border-navy-rule bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-surface"
        >
          <LayoutGrid className="h-4 w-4" />
          Tema
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 border-[#E3DFD7] bg-[#FBFAF7] p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-navy-mid">Tema</p>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATE_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTemplateChange(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                template === t.id
                  ? "border-transparent text-white"
                  : "border-navy-rule bg-background text-foreground hover:bg-surface"
              }`}
              style={template === t.id ? { backgroundColor: t.accentColor } : undefined}
            >
              {t.nome}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
