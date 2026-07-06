import { Check, Type } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FONT_OPTIONS, type FontId } from "@/lib/cv-design-presets";
import { ensureAllGoogleFonts, ensureGoogleFont } from "@/lib/google-fonts";
import { toolbarButtonClass } from "./styles";

export function FontDropdown({
  fontId,
  onChange,
}: {
  fontId: string;
  onChange: (id: FontId) => void;
}) {
  const current = FONT_OPTIONS[fontId as FontId] ?? FONT_OPTIONS.inter;

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) ensureAllGoogleFonts();
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className={toolbarButtonClass()}>
          <Type className="h-4 w-4" />
          {current.label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        side="top"
        sideOffset={10}
        className="w-56 border-[#E3DFD7] bg-[#FBFAF7] p-1.5"
      >
        <div className="flex flex-col">
          {(Object.keys(FONT_OPTIONS) as FontId[]).map((id) => {
            const f = FONT_OPTIONS[id];
            const active = fontId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  ensureGoogleFont(id);
                  onChange(id);
                }}
                className={`flex items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                  active ? "bg-[#1D9E75]/10 text-[#1D9E75]" : "hover:bg-black/[0.04]"
                }`}
                style={{ fontFamily: f.family }}
              >
                <span>{f.label}</span>
                {active && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
