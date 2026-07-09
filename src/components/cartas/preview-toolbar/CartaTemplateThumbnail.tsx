import { CartaDocument, type CartaDraft } from "@/components/carta/CartaDocument";
import type { TemplateTheme } from "@/lib/templates/themes";
import { PAGE_H, PAGE_W } from "@/lib/pagination/metrics";

const FRAME_W = 108;
const SCALE = FRAME_W / PAGE_W;
const FRAME_H = PAGE_H * SCALE;

export function CartaTemplateThumbnail({
  draft,
  template,
  active,
  onClick,
}: {
  draft: CartaDraft;
  template: TemplateTheme;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="flex shrink-0 flex-col items-center gap-1.5">
      <div
        style={{
          width: FRAME_W,
          height: FRAME_H,
          overflow: "hidden",
          borderRadius: 4,
          boxShadow: "0 1px 2px rgba(15,23,42,0.10), 0 4px 10px rgba(15,23,42,0.08)",
          outline: active ? "2px solid #1D9E75" : "1px solid #E3DFD7",
          outlineOffset: 1,
        }}
      >
        <div
          style={{
            width: PAGE_W,
            height: PAGE_H,
            transform: `scale(${SCALE})`,
            transformOrigin: "top left",
          }}
        >
          <CartaDocument draft={{ ...draft, template: template.id }} />
        </div>
      </div>
      <span
        className={`text-[11px] ${active ? "font-medium text-[#1D9E75]" : "text-muted-foreground"}`}
      >
        {template.nome}
      </span>
    </button>
  );
}
