import { LayoutGrid } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TEMPLATES } from "@/lib/cv-design-presets";
import type { CvDraft } from "@/lib/cv-types";
import { TemplateThumbnail } from "./TemplateThumbnail";
import { toolbarButtonClass } from "./styles";

export function TemplatePickerButton({
  draft,
  onPick,
}: {
  draft: CvDraft;
  onPick: (id: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={toolbarButtonClass()}>
          <LayoutGrid className="h-4 w-4" />
          Modelos
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        side="top"
        sideOffset={10}
        className="w-auto max-w-[min(90vw,560px)] border-[#E3DFD7] bg-[#FBFAF7] p-3"
      >
        <div className="flex gap-3 overflow-x-auto pb-1">
          {TEMPLATES.map((t) => (
            <TemplateThumbnail
              key={t.id}
              draft={draft}
              template={t}
              active={draft.template === t.id}
              onClick={() => onPick(t.id)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
