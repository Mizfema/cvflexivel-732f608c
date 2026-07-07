// Export PDF da carta de motivação — reutiliza o mecanismo de impressão da F12
// (createPortal para #cv-print-root, ver @media print em styles.css e
// CvPagedPreview.tsx), mas com um layout de página única e sem paginação:
// a carta tem sempre ~250-400 palavras e cabe numa folha A4.

import { useEffect, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getCv } from "@/lib/cvs.functions";
import { setRichTextPrintBypass } from "@/lib/rich-text";

type HeaderInfo = {
  nome: string;
  linhas: string[];
};

function buildHeaderInfo(p: {
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
  cidade?: string | null;
  pais?: string | null;
}): HeaderInfo {
  const linhas = [p.email, p.telefone, [p.cidade, p.pais].filter(Boolean).join(", ")].filter(
    (v): v is string => !!v && v.trim().length > 0,
  );
  return { nome: p.nome?.trim() || "", linhas };
}

export function CoverLetterPrintPortal({
  content,
  cvId,
}: {
  content: string;
  cvId: string | null;
}) {
  const fetchCv = useServerFn(getCv);
  const [header, setHeader] = useState<HeaderInfo>({ nome: "", linhas: [] });
  const [isPrinting, setIsPrinting] = useState(false);

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
      <div
        className="cv-print-page"
        style={{
          width: "210mm",
          minHeight: "297mm",
          padding: "30mm 28mm",
          background: "white",
          fontFamily: 'var(--font-serif, "Libre Baskerville", Georgia, serif)',
          color: "#242320",
        }}
      >
        <header>
          {header.nome && <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{header.nome}</p>}
          {header.linhas.length > 0 && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#5F5E5A" }}>
              {header.linhas.join(" · ")}
            </p>
          )}
        </header>

        <p style={{ margin: "28px 0 0", fontSize: 11, color: "#5F5E5A" }}>{today}</p>

        <div
          style={{ marginTop: 28, fontSize: 12.5, lineHeight: 1.7 }}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </div>,
    document.body,
  );
}
