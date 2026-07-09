import { Maximize2, Minimize2 } from "lucide-react";
import type { CvDesign, CvSpacing } from "@/lib/cv-types";
import type { FontId } from "@/lib/cv-design-presets";
import type { CartaDraft } from "@/components/carta/CartaDocument";
import { FontDropdown } from "@/components/editor/preview-toolbar/FontDropdown";
import { SpacingPopover } from "@/components/editor/preview-toolbar/SpacingPopover";
import { AccentColorPopover } from "@/components/editor/preview-toolbar/AccentColorPopover";
import { toolbarButtonClass } from "@/components/editor/preview-toolbar/styles";
import { CartaTemplatePickerButton } from "./CartaTemplatePickerButton";

export function CartaPreviewToolbar({
  previewDraft,
  onTemplateChange,
  onDesignChange,
  fullscreen,
  onToggleFullscreen,
  className,
}: {
  /** Só para desenhar as miniaturas dos modelos — não é mutado aqui. */
  previewDraft: CartaDraft;
  onTemplateChange: (id: string) => void;
  onDesignChange: (updater: (prev: CvDesign) => CvDesign) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  className?: string;
}) {
  const design = previewDraft.design;
  const setSpacing = (spacing: CvSpacing) => onDesignChange((d) => ({ ...d, spacing }));

  return (
    <div
      className={`flex items-center gap-1 rounded-xl border border-[#E3DFD7] bg-[#FBFAF7] p-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.08)] ${className ?? ""}`}
    >
      <CartaTemplatePickerButton draft={previewDraft} onPick={onTemplateChange} />
      <FontDropdown
        fontId={design.fontFamily}
        onChange={(fontFamily: FontId) => onDesignChange((d) => ({ ...d, fontFamily }))}
      />
      <SpacingPopover spacing={design.spacing} onChange={setSpacing} />
      <AccentColorPopover
        color={design.accentColor}
        onChange={(accentColor) => onDesignChange((d) => ({ ...d, accentColor }))}
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
