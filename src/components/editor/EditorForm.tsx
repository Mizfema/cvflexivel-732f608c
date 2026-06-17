import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  CvDraft,
  CvExperience,
  CvFormacao,
  CvCompetencia,
  CvIdioma,
  CvSecaoExtra,
} from "@/lib/cv-types";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

type Updater = (updater: (prev: CvDraft) => CvDraft) => void;

const tiposExtra: Array<{ value: CvSecaoExtra["tipo"]; label: string }> = [
  { value: "cursos", label: "Cursos" },
  { value: "estagios", label: "Estágios" },
  { value: "certificados", label: "Certificados" },
  { value: "realizacoes", label: "Realizações" },
  { value: "atividades", label: "Atividades" },
  { value: "qualidades", label: "Qualidades" },
];

export function EditorForm({
  draft,
  update,
}: {
  draft: CvDraft;
  update: Updater;
}) {
  return (
    <div className="space-y-3">
      <PerfilSection draft={draft} update={update} />
      <ExperienciaSection draft={draft} update={update} />
      <FormacaoSection draft={draft} update={update} />
      <CompetenciasSection draft={draft} update={update} />
      <IdiomasSection draft={draft} update={update} />
      {draft.sections.extras.map((sec) => (
        <ExtraSection
          key={sec.id}
          sec={sec}
          update={update}
        />
      ))}
      <AdicionarSecao update={update} />
    </div>
  );
}

function SectionCard({
  titulo,
  contagem,
  defaultOpen = true,
  children,
}: {
  titulo: string;
  contagem?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-navy-rule bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-serif text-base text-foreground">{titulo}</span>
          {contagem !== undefined && (
            <span className="font-mono text-xs text-muted-foreground">
              {contagem}
            </span>
          )}
        </div>
      </button>
      {open && <div className="border-t border-navy-rule p-4">{children}</div>}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

// ---------- Perfil ----------
function PerfilSection({ draft, update }: { draft: CvDraft; update: Updater }) {
  const p = draft.sections.perfil;
  const set = <K extends keyof typeof p>(key: K, value: (typeof p)[K]) =>
    update((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        perfil: { ...prev.sections.perfil, [key]: value },
      },
    }));

  return (
    <SectionCard titulo="Perfil">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome completo">
          <Input
            value={p.nome}
            onChange={(e) => set("nome", e.target.value)}
            placeholder="Ana Macuácua"
          />
        </Field>
        <Field label="Cargo / título">
          <Input
            value={p.headline}
            onChange={(e) => set("headline", e.target.value)}
            placeholder="Coordenadora de Programa"
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={p.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="ana@exemplo.mz"
          />
        </Field>
        <Field label="Telefone">
          <Input
            value={p.telefone}
            onChange={(e) => set("telefone", e.target.value)}
            placeholder="+258 84 000 0000"
          />
        </Field>
        <Field label="Cidade">
          <Input
            value={p.cidade}
            onChange={(e) => set("cidade", e.target.value)}
            placeholder="Maputo"
          />
        </Field>
        <Field label="País">
          <Input
            value={p.pais}
            onChange={(e) => set("pais", e.target.value)}
          />
        </Field>
        <Field label="LinkedIn">
          <Input
            value={p.linkedin ?? ""}
            onChange={(e) => set("linkedin", e.target.value)}
            placeholder="linkedin.com/in/…"
          />
        </Field>
        <Field label="Website">
          <Input
            value={p.website ?? ""}
            onChange={(e) => set("website", e.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Resumo profissional">
            <Textarea
              rows={4}
              value={p.resumo ?? ""}
              onChange={(e) => set("resumo", e.target.value)}
              placeholder="2-4 frases que resumem o teu percurso, focando o que é relevante para o setor."
            />
          </Field>
        </div>
      </div>
    </SectionCard>
  );
}

// ---------- Experiência ----------
function ExperienciaSection({
  draft,
  update,
}: {
  draft: CvDraft;
  update: Updater;
}) {
  const items = draft.sections.experiencia;
  const setItems = (next: CvExperience[]) =>
    update((prev) => ({
      ...prev,
      sections: { ...prev.sections, experiencia: next },
    }));

  const add = () =>
    setItems([
      ...items,
      { id: uid(), cargo: "", organizacao: "", local: "", inicio: "", fim: "" },
    ]);

  return (
    <SectionCard titulo="Experiência" contagem={items.length}>
      <div className="space-y-4">
        {items.map((it, idx) => (
          <div
            key={it.id}
            className="rounded-md border border-navy-rule/60 bg-surface/40 p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[11px] text-muted-foreground">
                #{idx + 1}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setItems(items.filter((x) => x.id !== it.id))}
                aria-label="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Cargo">
                <Input
                  value={it.cargo}
                  onChange={(e) =>
                    setItems(
                      items.map((x) =>
                        x.id === it.id ? { ...x, cargo: e.target.value } : x,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Organização">
                <Input
                  value={it.organizacao}
                  onChange={(e) =>
                    setItems(
                      items.map((x) =>
                        x.id === it.id
                          ? { ...x, organizacao: e.target.value }
                          : x,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Local">
                <Input
                  value={it.local ?? ""}
                  onChange={(e) =>
                    setItems(
                      items.map((x) =>
                        x.id === it.id ? { ...x, local: e.target.value } : x,
                      ),
                    )
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Início">
                  <Input
                    value={it.inicio ?? ""}
                    onChange={(e) =>
                      setItems(
                        items.map((x) =>
                          x.id === it.id
                            ? { ...x, inicio: e.target.value }
                            : x,
                        ),
                      )
                    }
                    placeholder="2022-01"
                  />
                </Field>
                <Field label="Fim">
                  <Input
                    value={it.fim ?? ""}
                    onChange={(e) =>
                      setItems(
                        items.map((x) =>
                          x.id === it.id ? { ...x, fim: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="atual"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Descrição / responsabilidades">
                  <Textarea
                    rows={3}
                    value={it.descricao ?? ""}
                    onChange={(e) =>
                      setItems(
                        items.map((x) =>
                          x.id === it.id
                            ? { ...x, descricao: e.target.value }
                            : x,
                        ),
                      )
                    }
                    placeholder="• Liderança de equipa de X pessoas&#10;• Resultado mensurável"
                  />
                </Field>
              </div>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={add}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" /> Adicionar experiência
        </Button>
      </div>
    </SectionCard>
  );
}

// ---------- Formação ----------
function FormacaoSection({
  draft,
  update,
}: {
  draft: CvDraft;
  update: Updater;
}) {
  const items = draft.sections.formacao;
  const setItems = (next: CvFormacao[]) =>
    update((prev) => ({
      ...prev,
      sections: { ...prev.sections, formacao: next },
    }));

  const add = () =>
    setItems([
      ...items,
      { id: uid(), curso: "", instituicao: "", inicio: "", fim: "" },
    ]);

  return (
    <SectionCard titulo="Formação" contagem={items.length} defaultOpen={false}>
      <div className="space-y-4">
        {items.map((it, idx) => (
          <div
            key={it.id}
            className="rounded-md border border-navy-rule/60 bg-surface/40 p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[11px] text-muted-foreground">
                #{idx + 1}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setItems(items.filter((x) => x.id !== it.id))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Curso / grau">
                <Input
                  value={it.curso}
                  onChange={(e) =>
                    setItems(
                      items.map((x) =>
                        x.id === it.id ? { ...x, curso: e.target.value } : x,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Instituição">
                <Input
                  value={it.instituicao}
                  onChange={(e) =>
                    setItems(
                      items.map((x) =>
                        x.id === it.id
                          ? { ...x, instituicao: e.target.value }
                          : x,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Início">
                <Input
                  value={it.inicio ?? ""}
                  onChange={(e) =>
                    setItems(
                      items.map((x) =>
                        x.id === it.id ? { ...x, inicio: e.target.value } : x,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Fim">
                <Input
                  value={it.fim ?? ""}
                  onChange={(e) =>
                    setItems(
                      items.map((x) =>
                        x.id === it.id ? { ...x, fim: e.target.value } : x,
                      ),
                    )
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Descrição">
                  <Textarea
                    rows={2}
                    value={it.descricao ?? ""}
                    onChange={(e) =>
                      setItems(
                        items.map((x) =>
                          x.id === it.id
                            ? { ...x, descricao: e.target.value }
                            : x,
                        ),
                      )
                    }
                  />
                </Field>
              </div>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={add} className="w-full">
          <Plus className="mr-2 h-4 w-4" /> Adicionar formação
        </Button>
      </div>
    </SectionCard>
  );
}

// ---------- Competências ----------
function CompetenciasSection({
  draft,
  update,
}: {
  draft: CvDraft;
  update: Updater;
}) {
  const items = draft.sections.competencias;
  const setItems = (next: CvCompetencia[]) =>
    update((prev) => ({
      ...prev,
      sections: { ...prev.sections, competencias: next },
    }));

  return (
    <SectionCard
      titulo="Competências"
      contagem={items.length}
      defaultOpen={false}
    >
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-2">
            <Input
              value={it.nome}
              placeholder="Ex.: Gestão de projeto"
              onChange={(e) =>
                setItems(
                  items.map((x) =>
                    x.id === it.id ? { ...x, nome: e.target.value } : x,
                  ),
                )
              }
            />
            <Select
              value={it.nivel ?? ""}
              onValueChange={(v) =>
                setItems(
                  items.map((x) =>
                    x.id === it.id
                      ? { ...x, nivel: (v || undefined) as CvCompetencia["nivel"] }
                      : x,
                  ),
                )
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Nível" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basico">Básico</SelectItem>
                <SelectItem value="intermedio">Intermédio</SelectItem>
                <SelectItem value="avancado">Avançado</SelectItem>
                <SelectItem value="especialista">Especialista</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setItems(items.filter((x) => x.id !== it.id))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => setItems([...items, { id: uid(), nome: "" }])}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" /> Adicionar competência
        </Button>
      </div>
    </SectionCard>
  );
}

// ---------- Idiomas ----------
function IdiomasSection({ draft, update }: { draft: CvDraft; update: Updater }) {
  const items = draft.sections.idiomas;
  const setItems = (next: CvIdioma[]) =>
    update((prev) => ({
      ...prev,
      sections: { ...prev.sections, idiomas: next },
    }));

  return (
    <SectionCard titulo="Idiomas" contagem={items.length} defaultOpen={false}>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-2">
            <Input
              value={it.idioma}
              placeholder="Ex.: Inglês"
              onChange={(e) =>
                setItems(
                  items.map((x) =>
                    x.id === it.id ? { ...x, idioma: e.target.value } : x,
                  ),
                )
              }
            />
            <Select
              value={it.nivel ?? ""}
              onValueChange={(v) =>
                setItems(
                  items.map((x) =>
                    x.id === it.id
                      ? { ...x, nivel: (v || undefined) as CvIdioma["nivel"] }
                      : x,
                  ),
                )
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Nível" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basico">Básico</SelectItem>
                <SelectItem value="intermedio">Intermédio</SelectItem>
                <SelectItem value="avancado">Avançado</SelectItem>
                <SelectItem value="fluente">Fluente</SelectItem>
                <SelectItem value="nativo">Nativo</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setItems(items.filter((x) => x.id !== it.id))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => setItems([...items, { id: uid(), idioma: "" }])}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" /> Adicionar idioma
        </Button>
      </div>
    </SectionCard>
  );
}

// ---------- Secções extras ----------
function ExtraSection({
  sec,
  update,
}: {
  sec: CvSecaoExtra;
  update: Updater;
}) {
  const setSec = (next: CvSecaoExtra) =>
    update((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        extras: prev.sections.extras.map((s) => (s.id === sec.id ? next : s)),
      },
    }));

  const remove = () =>
    update((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        extras: prev.sections.extras.filter((s) => s.id !== sec.id),
      },
    }));

  return (
    <SectionCard titulo={sec.titulo} contagem={sec.itens.length}>
      <div className="space-y-3">
        <Field label="Título da secção">
          <Input
            value={sec.titulo}
            onChange={(e) => setSec({ ...sec, titulo: e.target.value })}
          />
        </Field>
        {sec.itens.map((it, idx) => (
          <div
            key={it.id}
            className="rounded-md border border-navy-rule/60 bg-surface/40 p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[11px] text-muted-foreground">
                #{idx + 1}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() =>
                  setSec({
                    ...sec,
                    itens: sec.itens.filter((x) => x.id !== it.id),
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
              <Field label="Título">
                <Input
                  value={it.titulo}
                  onChange={(e) =>
                    setSec({
                      ...sec,
                      itens: sec.itens.map((x) =>
                        x.id === it.id ? { ...x, titulo: e.target.value } : x,
                      ),
                    })
                  }
                />
              </Field>
              <Field label="Data">
                <Input
                  value={it.data ?? ""}
                  onChange={(e) =>
                    setSec({
                      ...sec,
                      itens: sec.itens.map((x) =>
                        x.id === it.id ? { ...x, data: e.target.value } : x,
                      ),
                    })
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Descrição">
                  <Textarea
                    rows={2}
                    value={it.descricao ?? ""}
                    onChange={(e) =>
                      setSec({
                        ...sec,
                        itens: sec.itens.map((x) =>
                          x.id === it.id
                            ? { ...x, descricao: e.target.value }
                            : x,
                        ),
                      })
                    }
                  />
                </Field>
              </div>
            </div>
          </div>
        ))}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setSec({
                ...sec,
                itens: [...sec.itens, { id: uid(), titulo: "" }],
              })
            }
            className="flex-1"
          >
            <Plus className="mr-2 h-4 w-4" /> Adicionar item
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={remove}
            className="text-destructive hover:text-destructive"
          >
            Remover secção
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

function AdicionarSecao({ update }: { update: Updater }) {
  const add = (tipo: CvSecaoExtra["tipo"], label: string) =>
    update((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        extras: [
          ...prev.sections.extras,
          { id: uid(), tipo, titulo: label, itens: [] },
        ],
      },
    }));

  return (
    <div className="rounded-lg border border-dashed border-navy-rule bg-surface/30 p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Adicionar secção
      </p>
      <div className="flex flex-wrap gap-2">
        {tiposExtra.map((t) => (
          <Button
            key={t.value}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => add(t.value, t.label)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
