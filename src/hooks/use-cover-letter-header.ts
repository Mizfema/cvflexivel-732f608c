import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getCv } from "@/lib/cvs.functions";
import { buildContactItems, type ContactInput } from "@/lib/contact-items";
import type { CartaHeaderInfo } from "@/components/carta/CartaDocument";

function buildHeaderInfo(nome: string | null | undefined, contact: ContactInput): CartaHeaderInfo {
  return { nome: nome?.trim() || "", items: buildContactItems(contact) };
}

/**
 * Cabeçalho (nome + contactos) da carta: vem do CV ligado (`cvId`) ou,
 * na ausência de um, do perfil da conta. A foto da carta é independente
 * (ver `CoverLetterEditorState.photo`) e não passa por aqui.
 */
export function useCoverLetterHeader(cvId: string | null): CartaHeaderInfo {
  const fetchCv = useServerFn(getCv);
  const [header, setHeader] = useState<CartaHeaderInfo>({ nome: "", items: [] });

  useEffect(() => {
    let cancelled = false;
    async function loadHeader() {
      if (cvId) {
        try {
          const row = await fetchCv({ data: { id: cvId } });
          if (cancelled) return;
          const p =
            (row.sections as { perfil?: Record<string, string | null | undefined> })?.perfil ?? {};
          setHeader(
            buildHeaderInfo(p.nome, {
              email: p.email,
              telefone: p.telefone,
              cidade: p.cidade,
              pais: p.pais,
              morada: p.morada,
              linkedin: p.linkedin,
              website: p.website,
              cartaConducao: p.cartaConducao,
            }),
          );
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
        setHeader(
          buildHeaderInfo(profile.full_name, {
            email: profile.email,
            telefone: profile.phone,
            cidade: profile.city,
            pais: profile.country,
            linkedin: profile.linkedin,
            website: profile.website,
          }),
        );
      } catch {
        /* sem nome/contactos disponíveis — cabeçalho fica em branco */
      }
    }
    loadHeader();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cvId]);

  return header;
}
