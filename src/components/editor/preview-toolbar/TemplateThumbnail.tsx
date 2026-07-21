import type { CSSProperties } from "react";
import type { CvDraft } from "@/lib/cv-types";
import { designToCssVars, type TemplateInfo } from "@/lib/cv-design-presets";
import { useCvBlocks } from "@/lib/pagination/useCvBlocks";
import { PAGE_H, PAGE_W, SIDEBAR_GAP, SIDEBAR_W, pageMetrics } from "@/lib/pagination/metrics";
import type { CvBlock } from "@/lib/pagination/types";

const FRAME_W = 108;
const SCALE = FRAME_W / PAGE_W;
const FRAME_H = PAGE_H * SCALE;

function ThumbBlockList({ blocks }: { blocks: CvBlock[] }) {
  return (
    <>
      {blocks.map((b, i) => (
        <div key={b.id} style={{ marginTop: i === 0 ? 0 : b.marginBefore }}>
          {b.node}
        </div>
      ))}
    </>
  );
}

export function TemplateThumbnail({
  draft,
  template,
  active,
  onClick,
}: {
  draft: CvDraft;
  template: TemplateInfo;
  active: boolean;
  onClick: () => void;
}) {
  const metrics = pageMetrics(draft.design, template.layout);
  const cssVars = designToCssVars(draft.design) as CSSProperties;
  const { mainBlocks, sidebar } = useCvBlocks(draft, template, metrics);
  const isSidebar = template.layout === "sidebar";

  const pageStyle: CSSProperties = {
    ...cssVars,
    fontFamily: "var(--cv-font)",
    fontSize: "var(--cv-base-size)",
    lineHeight: "var(--cv-line-height)",
    color: "var(--cv-text)",
    width: PAGE_W,
    height: PAGE_H,
    boxSizing: "border-box",
    padding: `${metrics.padY}px ${metrics.padX}px`,
    background: "white",
    transform: `scale(${SCALE})`,
    transformOrigin: "top left",
  };

  return (
    <button type="button" onClick={onClick} className="flex shrink-0 flex-col items-center gap-1.5">
      <div
        style={{
          position: "relative",
          width: FRAME_W,
          height: FRAME_H,
          overflow: "hidden",
          borderRadius: 4,
          boxShadow: "0 1px 2px rgba(15,23,42,0.10), 0 4px 10px rgba(15,23,42,0.08)",
          outline: active ? "2px solid #1D9E75" : "1px solid #E3DFD7",
          outlineOffset: 1,
        }}
      >
        <div style={pageStyle}>
          {isSidebar ? (
            <div style={{ display: "flex", gap: SIDEBAR_GAP, height: "100%" }}>
              <aside
                style={
                  template.accentSurface === "sidebar"
                    ? {
                        width: SIDEBAR_W,
                        flexShrink: 0,
                        background: "var(--cv-accent)",
                        color: "#fff",
                        margin: `-${metrics.padY}px 0 -${metrics.padY}px -${metrics.padX}px`,
                        padding: `${metrics.padY}px 20px ${metrics.padY}px ${metrics.padX}px`,
                      }
                    : {
                        width: SIDEBAR_W,
                        flexShrink: 0,
                        paddingRight: 20,
                        borderRight:
                          template.accentSurface === "sidebar-block"
                            ? "none"
                            : "1px solid var(--cv-rule)",
                      }
                }
              >
                {sidebar}
              </aside>
              <div style={{ flex: 1, minWidth: 0 }}>
                <ThumbBlockList blocks={mainBlocks} />
              </div>
            </div>
          ) : (
            <ThumbBlockList blocks={mainBlocks} />
          )}
        </div>
        {template.isPremium && (
          <span
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              fontSize: 8,
              fontWeight: 600,
              letterSpacing: "0.04em",
              padding: "1px 5px",
              borderRadius: 4,
              background: "#1D9E75",
              color: "#fff",
            }}
          >
            Premium
          </span>
        )}
      </div>
      <span
        className={`text-[11px] ${active ? "font-medium text-[#1D9E75]" : "text-muted-foreground"}`}
      >
        {template.nome}
      </span>
    </button>
  );
}
