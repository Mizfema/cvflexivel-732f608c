import { ALargeSmall } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CvFontSize } from "@/lib/cv-types";
import { toolbarButtonClass } from "./styles";

const FONT_SIZE_OPTIONS: CvFontSize[] = ["XS", "S", "M", "L", "XL"];

export function FontSizePopover({
  fontSize,
  onChange,
}: {
  fontSize: CvFontSize;
  onChange: (fontSize: CvFontSize) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={toolbarButtonClass()}>
          <ALargeSmall className="h-4 w-4" />
          {fontSize}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        side="top"
        sideOffset={10}
        className="w-auto border-[#E3DFD7] bg-[#FBFAF7] p-3"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-[#4A4740]">Tamanho da letra</span>
          <ToggleGroup
            type="single"
            size="sm"
            value={fontSize}
            onValueChange={(v) => v && onChange(v as CvFontSize)}
          >
            {FONT_SIZE_OPTIONS.map((size) => (
              <ToggleGroupItem key={size} value={size} className="h-7 px-2.5 text-xs">
                {size}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </PopoverContent>
    </Popover>
  );
}
