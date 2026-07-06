import { useEffect, useState } from "react";
import { Check, Palette } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ACCENT_SWATCHES } from "@/lib/cv-design-presets";
import { toolbarButtonClass } from "./styles";

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function AccentColorPopover({
  color,
  onChange,
}: {
  color: string;
  onChange: (hex: string) => void;
}) {
  const [hexInput, setHexInput] = useState(color);

  useEffect(() => {
    setHexInput(color);
  }, [color]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={toolbarButtonClass()}>
          <Palette className="h-4 w-4" />
          <span
            className="h-3.5 w-3.5 rounded-full border border-black/10"
            style={{ background: color }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        side="top"
        sideOffset={10}
        className="w-64 space-y-3 border-[#E3DFD7] bg-[#FBFAF7] p-4"
      >
        <div className="grid grid-cols-4 gap-2">
          {ACCENT_SWATCHES.map((s) => {
            const active = s.hex.toLowerCase() === color.toLowerCase();
            return (
              <button
                key={s.hex}
                type="button"
                title={s.label}
                onClick={() => onChange(s.hex)}
                className="flex flex-col items-center gap-1"
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10"
                  style={{ background: s.hex }}
                >
                  {active && <Check className="h-3.5 w-3.5 text-white drop-shadow" />}
                </span>
                <span className="text-[10px] text-muted-foreground">{s.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 border-t border-[#E3DFD7] pt-3">
          <input
            type="color"
            value={HEX_RE.test(color) ? color : "#000000"}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 w-8 shrink-0 cursor-pointer rounded border border-black/10 bg-transparent p-0"
            aria-label="Escolher cor personalizada"
          />
          <input
            type="text"
            value={hexInput}
            onChange={(e) => {
              const v = e.target.value;
              setHexInput(v);
              if (HEX_RE.test(v)) onChange(v);
            }}
            placeholder="#1D9E75"
            className="h-8 flex-1 rounded-md border border-[#E3DFD7] bg-white px-2 text-xs text-[#2C2C2A] outline-none focus:ring-1 focus:ring-[#1D9E75]/40"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
