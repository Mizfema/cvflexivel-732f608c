// Campos de perfil (nome + contactos) do editor de carta — mesma lista de
// campos e layout da secção Perfil do editor de CV (EditorForm.tsx), à
// excepção de foto (já editada à parte) e resumo (não se aplica à carta).

import { Field } from "@/components/editor/EditorForm";
import { Input } from "@/components/ui/input";
import { CONTACT_ICONS } from "@/lib/contact-items";
import type { CartaPerfilFields } from "@/lib/cover-letter-types";

export function CartaPerfilFieldsForm({
  perfil,
  onChange,
}: {
  perfil: CartaPerfilFields;
  onChange: (perfil: CartaPerfilFields) => void;
}) {
  const set = <K extends keyof CartaPerfilFields>(key: K, value: CartaPerfilFields[K]) =>
    onChange({ ...perfil, [key]: value });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nome completo">
        <Input
          value={perfil.nome}
          onChange={(e) => set("nome", e.target.value)}
          placeholder="Ana Macuácua"
        />
      </Field>
      <Field label="Cargo / título">
        <Input
          value={perfil.headline}
          onChange={(e) => set("headline", e.target.value)}
          placeholder="Oficial de Monitoria e avaliação"
        />
      </Field>
      <Field label="Email" icon={CONTACT_ICONS.email}>
        <Input
          type="email"
          value={perfil.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="ana@exemplo.mz"
        />
      </Field>
      <Field label="Telefone" icon={CONTACT_ICONS.telefone}>
        <Input
          value={perfil.telefone}
          onChange={(e) => set("telefone", e.target.value)}
          placeholder="+258 84 000 0000"
        />
      </Field>
      <Field label="Cidade" icon={CONTACT_ICONS.localizacao}>
        <Input
          value={perfil.cidade}
          onChange={(e) => set("cidade", e.target.value)}
          placeholder="Maputo"
        />
      </Field>
      <Field label="País">
        <Input value={perfil.pais} onChange={(e) => set("pais", e.target.value)} />
      </Field>
      <Field label="Morada" icon={CONTACT_ICONS.morada}>
        <Input
          value={perfil.morada ?? ""}
          onChange={(e) => set("morada", e.target.value)}
          placeholder="Av. Julius Nyerere, 123"
        />
      </Field>
      <Field label="Carta de condução" icon={CONTACT_ICONS.cartaConducao}>
        <Input
          value={perfil.cartaConducao ?? ""}
          onChange={(e) => set("cartaConducao", e.target.value)}
          placeholder="Categoria B"
        />
      </Field>
      <Field label="Data de nascimento" icon={CONTACT_ICONS.dataNascimento}>
        <Input
          value={perfil.dataNascimento ?? ""}
          onChange={(e) => set("dataNascimento", e.target.value)}
          placeholder="8 de outubro de 1995"
        />
      </Field>
      <Field label="Género" icon={CONTACT_ICONS.genero}>
        <Input
          value={perfil.genero ?? ""}
          onChange={(e) => set("genero", e.target.value)}
          placeholder="Masculino"
        />
      </Field>
      <Field label="Estado civil" icon={CONTACT_ICONS.estadoCivil}>
        <Input
          value={perfil.estadoCivil ?? ""}
          onChange={(e) => set("estadoCivil", e.target.value)}
          placeholder="Solteiro(a)"
        />
      </Field>
      <Field label="LinkedIn" icon={CONTACT_ICONS.linkedin}>
        <Input
          value={perfil.linkedin ?? ""}
          onChange={(e) => set("linkedin", e.target.value)}
          placeholder="linkedin.com/in/…"
        />
      </Field>
      <Field label="Website" icon={CONTACT_ICONS.website}>
        <Input value={perfil.website ?? ""} onChange={(e) => set("website", e.target.value)} />
      </Field>
    </div>
  );
}
