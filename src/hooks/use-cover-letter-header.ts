import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getCv } from "@/lib/cvs.functions";
import { buildContactItems } from "@/lib/contact-items";
import type { CartaHeaderInfo } from "@/components/carta/CartaDocument";
import type { CartaPerfilFields } from "@/lib/cover-letter-types";

/**
 * Converte os campos de perfil da carta (`CartaPerfilFields`) na forma usada
 * para desenhar o cabeçalho (`CartaDocument`): `dataNascimento`/`genero`/
 * `estadoCivil` ficam de fora de `items` porque só o template "Detalhado"
 * (ver CartaDocument) os mostra — incluí-los aí fá-los-ia aparecer em todos
 * os templates sempre que preenchidos.
 */
export function buildCartaHeaderInfo(perfil: CartaPerfilFields): CartaHeaderInfo {
  const { dataNascimento, genero, estadoCivil, headline, nome, ...baseContact } = perfil;
  return {
    nome: nome.trim(),
    headline: headline.trim() || undefined,
    items: buildContactItems(baseContact),
    dataNascimento: dataNascimento || undefined,
    genero: genero || undefined,
    estadoCivil: estadoCivil || undefined,
  };
}

/**
 * Busca os campos de perfil (nome + contactos) do CV ligado ou, na sua
 * ausência, do perfil da conta — usado só para PRÉ-PREENCHER uma carta nova
 * sem `perfil` ainda guardado (ver carta-editor.tsx: só é chamado quando não
 * há `?id=`, isto é, uma carta que ainda não existe no Supabase). Depois de
 * aplicado uma vez, os campos ficam independentes na carta (tal como a
 * foto) e este hook deixa de ser consultado.
 */
export function useCartaPerfilPrefill(cvId: string | null): CartaPerfilFields | null {
  const fetchCv = useServerFn(getCv);
  const [perfil, setPerfil] = useState<CartaPerfilFields | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadPerfil() {
      if (cvId) {
        try {
          const row = await fetchCv({ data: { id: cvId } });
          if (cancelled) return;
          const p =
            (row.sections as { perfil?: Record<string, string | null | undefined> })?.perfil ?? {};
          setPerfil({
            nome: p.nome ?? "",
            headline: p.headline ?? "",
            email: p.email ?? "",
            telefone: p.telefone ?? "",
            cidade: p.cidade ?? "",
            pais: p.pais ?? "",
            morada: p.morada ?? "",
            cartaConducao: p.cartaConducao ?? "",
            dataNascimento: p.dataNascimento ?? "",
            genero: p.genero ?? "",
            estadoCivil: p.estadoCivil ?? "",
            linkedin: p.linkedin ?? "",
            website: p.website ?? "",
          });
          return;
        } catch {
          /* cai para o perfil da conta */
        }
      }
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user || cancelled) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email, phone, city, country, linkedin, website")
          .eq("id", auth.user.id)
          .single();
        if (cancelled || !profile) return;
        setPerfil({
          nome: profile.full_name ?? "",
          headline: "",
          email: profile.email ?? "",
          telefone: profile.phone ?? "",
          cidade: profile.city ?? "",
          pais: profile.country ?? "",
          morada: "",
          cartaConducao: "",
          dataNascimento: "",
          genero: "",
          estadoCivil: "",
          linkedin: profile.linkedin ?? "",
          website: profile.website ?? "",
        });
      } catch {
        /* sem nome/contactos disponíveis — perfil fica por preencher */
      }
    }
    loadPerfil();
    return () => {
      cancelled = true;
    };
  }, [cvId, fetchCv]);

  return perfil;
}
