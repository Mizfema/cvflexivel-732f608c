import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2 } from "lucide-react";
import type { CvDraft } from "@/lib/cv-types";
import { useAuth } from "@/hooks/use-auth";
import { saveCv } from "@/lib/cvs.functions";
import { checkDownloadAllowed } from "@/lib/download-gate.functions";
import { exportCvPdf } from "@/lib/cv-export";
import { Button } from "@/components/ui/button";
import { parseLimitError, type LimitInfo } from "@/lib/usage-error";
import { UsageLimitNotice } from "@/components/UsageLimitNotice";

export function ExportMenu({
  draft,
  cvId,
  onSaved,
  authNext,
}: {
  draft: CvDraft;
  cvId?: string;
  onSaved?: (id: string) => void;
  /** Destino após login, preservando o CV exacto em edição (?id=) — sem isto,
   * o gate de login perdia a ligação ao registo e criava um CV duplicado. */
  authNext?: string;
}) {
  const { session, ready } = useAuth();
  const navigate = useNavigate();
  const save = useServerFn(saveCv);
  const checkDownload = useServerFn(checkDownloadAllowed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitInfo, setLimitInfo] = useState<LimitInfo | null>(null);

  async function handleExport() {
    setError(null);
    setLimitInfo(null);

    // Único gate: login obrigatório antes de exportar.
    if (!session) {
      navigate({
        to: "/auth",
        search: { next: authNext ?? "/editor?modo=cv&export=pdf" },
      });
      return;
    }

    setBusy(true);
    try {
      // Verificação server-side de limite/plano (Fase 1.3) — antes de gerar o arquivo.
      await checkDownload({ data: { templateId: draft.template } });

      // Guardar (ou upsert) o CV antes de exportar.
      const res = await save({
        data: {
          id: cvId,
          title: draft.sections.perfil.nome || draft.title || "CV sem título",
          sections: draft.sections,
          template: draft.template,
          design: draft.design,
        },
      });
      onSaved?.(res.id);

      await exportCvPdf(draft);
    } catch (err) {
      const limit = parseLimitError(err);
      if (limit) {
        setLimitInfo(limit);
      } else {
        setError(err instanceof Error ? err.message : "Falha ao exportar.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" disabled={!ready || busy} onClick={handleExport}>
        {busy ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-1.5 h-4 w-4" />
        )}
        Exportar PDF
      </Button>
      {error && (
        <p className="max-w-xs text-right text-xs text-destructive">{error}</p>
      )}
      {limitInfo && (
        <div className="max-w-xs">
          <UsageLimitNotice
            feature={limitInfo.reason === "not_allowed_tier" ? "download_premium" : "download_free"}
            {...limitInfo}
          />
        </div>
      )}
    </div>
  );
}
