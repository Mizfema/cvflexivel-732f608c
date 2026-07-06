import { AlignVerticalSpaceAround } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CvSpacing, SpacingSize } from "@/lib/cv-types";
import { toolbarButtonClass } from "./styles";

function SizeRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SpacingSize;
  onChange: (v: SpacingSize) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-[#4A4740]">{label}</span>
      <ToggleGroup
        type="single"
        size="sm"
        value={value}
        onValueChange={(v) => v && onChange(v as SpacingSize)}
      >
        <ToggleGroupItem value="S" className="h-7 px-2.5 text-xs">
          S
        </ToggleGroupItem>
        <ToggleGroupItem value="M" className="h-7 px-2.5 text-xs">
          M
        </ToggleGroupItem>
        <ToggleGroupItem value="L" className="h-7 px-2.5 text-xs">
          L
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

export function SpacingPopover({
  spacing,
  onChange,
}: {
  spacing: CvSpacing;
  onChange: (spacing: CvSpacing) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={toolbarButtonClass()}>
          <AlignVerticalSpaceAround className="h-4 w-4" />
          Espaçamento
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        side="top"
        sideOffset={10}
        className="w-72 space-y-4 border-[#E3DFD7] bg-[#FBFAF7] p-4"
      >
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-[#4A4740]">Altura da linha</span>
            <span className="text-xs tabular-nums text-[#4A4740]">
              {spacing.lineHeight.toFixed(2)}
            </span>
          </div>
          <Slider
            min={1.0}
            max={1.6}
            step={0.05}
            value={[spacing.lineHeight]}
            onValueChange={([v]) => onChange({ ...spacing, lineHeight: v })}
          />
        </div>

        <SizeRow
          label="Espaço entre itens"
          value={spacing.itemGap}
          onChange={(v) => onChange({ ...spacing, itemGap: v })}
        />
        <SizeRow
          label="Espaço entre secções"
          value={spacing.sectionGap}
          onChange={(v) => onChange({ ...spacing, sectionGap: v })}
        />
        <SizeRow
          label="Margens da página"
          value={spacing.pageMargin}
          onChange={(v) => onChange({ ...spacing, pageMargin: v })}
        />
      </PopoverContent>
    </Popover>
  );
}
