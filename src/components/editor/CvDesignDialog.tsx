import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DENSIDADES,
  FONTES,
  PALETAS,
  TEMPLATES,
  type DensidadeId,
  type FonteId,
  type PaletaId,
} from "@/lib/cv-design-presets";
import type { CvDraft } from "@/lib/cv-types";

type Updater = (updater: (prev: CvDraft) => CvDraft) => void;

export function CvDesignDialog({
  draft,
  update,
}: {
  draft: CvDraft;
  update: Updater;
}) {
  const ats = TEMPLATES.filter((t) => t.tipo === "ats");
  const visual = TEMPLATES.filter((t) => t.tipo === "visual");

  const setTemplate = (id: string) =>
    update((p) => ({ ...p, template: id }));
  const setFonte = (fonte: FonteId) =>
    update((p) => ({ ...p, design: { ...p.design, fonte } }));
  const setPaleta = (paleta: PaletaId) =>
    update((p) => ({ ...p, design: { ...p.design, paleta } }));
  const setDensidade = (densidade: DensidadeId) =>
    update((p) => ({ ...p, design: { ...p.design, densidade } }));

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="mr-2 h-4 w-4" />
          Personalizar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            Template e personalização
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="template" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="template" className="flex-1">
              Template
            </TabsTrigger>
            <TabsTrigger value="visual" className="flex-1">
              Visual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="template" className="mt-4 space-y-6">
            <TemplateGroup
              titulo="ATS"
              ajuda="Legibilidade máxima — uma coluna, sem ícones nem tabelas."
              items={ats}
              active={draft.template}
              onPick={setTemplate}
            />
            <TemplateGroup
              titulo="Visual"
              ajuda="Layout com sidebar. Pode falhar em alguns parsers ATS."
              items={visual}
              active={draft.template}
              onPick={setTemplate}
            />
          </TabsContent>

          <TabsContent value="visual" className="mt-4 space-y-6">
            <Group titulo="Fonte">
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(FONTES) as FonteId[]).map((id) => {
                  const f = FONTES[id];
                  const active = draft.design.fonte === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFonte(id)}
                      className={`flex items-center justify-between rounded-md border px-3 py-2.5 text-left transition-colors ${
                        active
                          ? "border-navy bg-navy/5"
                          : "border-navy-rule hover:bg-surface"
                      }`}
                      style={{ fontFamily: f.familia }}
                    >
                      <span className="text-sm">{f.nome}</span>
                      {active && <Check className="h-4 w-4 text-navy" />}
                    </button>
                  );
                })}
              </div>
            </Group>

            <Group titulo="Paleta">
              <div className="grid grid-cols-5 gap-2">
                {(Object.keys(PALETAS) as PaletaId[]).map((id) => {
                  const p = PALETAS[id];
                  const active = draft.design.paleta === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPaleta(id)}
                      className={`flex flex-col items-center gap-1.5 rounded-md border p-2 transition-colors ${
                        active
                          ? "border-navy bg-navy/5"
                          : "border-navy-rule hover:bg-surface"
                      }`}
                    >
                      <span
                        className="h-8 w-8 rounded-full border border-black/10"
                        style={{ background: p.accent }}
                      />
                      <span className="text-[11px] text-muted-foreground">
                        {p.nome}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Group>

            <Group titulo="Densidade">
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(DENSIDADES) as DensidadeId[]).map((id) => {
                  const d = DENSIDADES[id];
                  const active = draft.design.densidade === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setDensidade(id)}
                      className={`rounded-md border px-3 py-2.5 text-sm transition-colors ${
                        active
                          ? "border-navy bg-navy/5 text-foreground"
                          : "border-navy-rule text-muted-foreground hover:bg-surface"
                      }`}
                    >
                      {d.nome}
                    </button>
                  );
                })}
              </div>
            </Group>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Group({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {titulo}
      </p>
      {children}
    </div>
  );
}

function TemplateGroup({
  titulo,
  ajuda,
  items,
  active,
  onPick,
}: {
  titulo: string;
  ajuda: string;
  items: typeof TEMPLATES;
  active: string;
  onPick: (id: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {titulo}
        </p>
        <p className="text-[11px] text-muted-foreground">{ajuda}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {items.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(t.id)}
              className={`rounded-md border p-3 text-left transition-colors ${
                isActive
                  ? "border-navy bg-navy/5"
                  : "border-navy-rule hover:bg-surface"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-serif text-sm text-foreground">
                  {t.nome}
                </span>
                {isActive && <Check className="h-4 w-4 text-navy" />}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t.descricao}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
