// Alternador grelha/lista partilhado pelas 3 listagens da conta (CVs, cartas,
// preparações de entrevista) — mesmo sítio, mesmo visual, mesmo comportamento
// nas três. Sem persistência (useState no chamador): mesma decisão já tomada
// para o menu lateral do editor, não guardamos preferência de vista entre
// sessões.

import { LayoutGrid, List } from "lucide-react";

export type DocumentView = "grid" | "list";

export function ViewToggle({
  value,
  onChange,
}: {
  value: DocumentView;
  onChange: (view: DocumentView) => void;
}) {
  return (
    <div className="flex rounded-md border border-navy-rule bg-card p-1">
      <button
        type="button"
        onClick={() => onChange("grid")}
        aria-pressed={value === "grid"}
        aria-label="Vista em grelha"
        title="Vista em grelha"
        className={`flex items-center justify-center rounded px-2.5 py-1.5 transition-colors ${
          value === "grid" ? "bg-navy text-paper" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        aria-pressed={value === "list"}
        aria-label="Vista em lista"
        title="Vista em lista"
        className={`flex items-center justify-center rounded px-2.5 py-1.5 transition-colors ${
          value === "list" ? "bg-navy text-paper" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  );
}
