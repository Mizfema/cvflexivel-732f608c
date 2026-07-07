// Export PDF da carta de motivação — reutiliza o mecanismo de impressão da F12
// (createPortal para #cv-print-root, ver @media print em styles.css e
// CvPagedPreview.tsx), mas desenha o documento via CartaDocument (layout de
// carta: cabeçalho, data, corpo — sem paginação, a carta cabe sempre numa A4).

import { useEffect, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getCv } from "@/lib/cvs.functions";
import { setRichTextPrintBypass } from "@/lib/rich-text";
import { ensureGoogleFont } from "@/lib/google-fonts";
import { getTemplateTheme } from "@/lib/templates/themes";
import { CartaDocument, type CartaHeaderInfo } from "@/components/carta/CartaDocument";

function buildHeaderInfo(p: {
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
  cidade?: string | null;
  pais?: string | null;
}): CartaHeaderInfo {
  const linhas = [p.email, p.telefone, [p.cidade, p.pais].filter(Boolean).join(", ")].filter(
    (v): v is string => !!v && v.trim().length > 0,
  );
  return { nome: p.nome?.trim() || "", linhas };
}

export function CoverLetterPrintPortal({
  content,
  cvId,
  template,
}: {
  content: string;
  cvId: string | null;
  template: string;
}) {
  const fetchCv = useServerFn(getCv);
  const [header, setHeader] = useState<CartaHeaderInfo>({ nome: "", linhas: [] });
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    ensureGoogleFont(getTemplateTheme(template).fontFamily);
  }, [template]);

  useEffect(() => {
    let cancelled = false;
    async function loadHeader() {
      if (cvId) {
        try {
          const row = await fetchCv({ data: { id: cvId } });
          if (cancelled) return;
          const p = (row.sections as { perfil?: Record<string, string> })?.perfil ?? {};
          setHeader(
            buildHeaderInfo({
              nome: p.nome,
              email: p.email,
              telefone: p.telefone,
              cidade: p.cidade,
              pais: p.pais,
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
          .select("full_name, email, phone, city, country")
          .eq("id", auth.user.id)
          .single();
        if (cancelled || !profile) return;
        setHeader(
          buildHeaderInfo({
            nome: profile.full_name,
            email: profile.email,
            telefone: profile.phone,
            cidade: profile.city,
            pais: profile.country,
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

  useEffect(() => {
    const handleBeforePrint = () => {
      setRichTextPrintBypass(true);
      flushSync(() => setIsPrinting(true));
    };
    const handleAfterPrint = () => {
      flushSync(() => setIsPrinting(false));
      setRichTextPrintBypass(false);
    };
    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  if (!isPrinting) return null;

  const today = new Date().toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return createPortal(
    <div id="cv-print-root">
      <CartaDocument draft={{ template, header, date: today, content }} />
    </div>,
    document.body,
  );
}
