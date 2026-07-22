import { Maximize2, Minimize2 } from "lucide-react";
import type { CvDraft, CvFontSize, CvSpacing } from "@/lib/cv-types";
import type { FontId } from "@/lib/cv-design-presets";
import { TemplatePickerButton } from "./TemplatePickerButton";
import { FontDropdown } from "./FontDropdown";
import { FontSizePopover } from "./FontSizePopover";
import { SpacingPopover } from "./SpacingPopover";
import { AccentColorPopover } from "./AccentColorPopover";
import { toolbarButtonClass } from "./styles";

type Updater = (updater: (prev: CvDraft) => CvDraft) => void;

export function CvPreviewToolbar({
  draft,
  update,
  fullscreen,
  onToggleFullscreen,
  className,
}: {
  draft: CvDraft;
  update: Updater;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  className?: string;
}) {
  const setSpacing = (spacing: CvSpacing) =>
    update((p) => ({ ...p, design: { ...p.design, spacing } }));

  return (
    <div
      className={`flex items-center gap-1 rounded-xl border border-[#E3DFD7] bg-[#FBFAF7] p-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.08)] ${className ?? ""}`}
    >
      <TemplatePickerButton
        draft={draft}
        onPick={(id) => update((p) => ({ ...p, template: id }))}
      />
      <FontDropdown
        fontId={draft.design.fontFamily}
        onChange={(fontFamily: FontId) =>
          update((p) => ({ ...p, design: { ...p.design, fontFamily } }))
        }
      />
      <FontSizePopover
        fontSize={draft.design.fontSize}
        onChange={(fontSize: CvFontSize) =>
          update((p) => ({ ...p, design: { ...p.design, fontSize } }))
        }
      />
      <SpacingPopover spacing={draft.design.spacing} onChange={setSpacing} />
      <AccentColorPopover
        color={draft.design.accentColor}
        onChange={(accentColor) => update((p) => ({ ...p, design: { ...p.design, accentColor } }))}
      />
      <button
        type="button"
        onClick={onToggleFullscreen}
        className={toolbarButtonClass()}
        title={fullscreen ? "Sair de ecrã cheio" : "Ecrã cheio"}
      >
        {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
    </div>
  );
}
