import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, FileType2, Loader2 } from "lucide-react";
import type { CvDraft } from "@/lib/cv-types";
import { useAuth } from "@/hooks/use-auth";
import { saveCv } from "@/lib/cvs.functions";
import { checkDownloadAllowed } from "@/lib/download-gate.functions";
import { exportCvDocx, exportCvPdf } from "@/lib/cv-export";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { parseLimitError, type LimitInfo } from "@/lib/usage-error";
import { UsageLimitNotice } from "@/components/UsageLimitNotice";

export function ExportMenu({
  draft,
  cvId,
  onSaved,
}: {
  draft: CvDraft;
  cvId?: string;
  onSaved?: (id: string) => void;
}) {
  const { session, ready } = useAuth();
  const navigate = useNavigate();
  const save = useServerFn(saveCv);
  const checkDownload = useServerFn(checkDownloadAllowed);
  const [busy, setBusy] = useState<"pdf" | "docx" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitInfo, setLimitInfo] = useState<LimitInfo | null>(null);

  async function handleExport(kind: "pdf" | "docx") {
    setError(null);
    setLimitInfo(null);

    // Único gate: login obrigatório antes de exportar.
    if (!session) {
      navigate({
        to: "/auth",
        search: { next: `/editor?modo=cv&export=${kind}` },
      });
      return;
    }

    setBusy(kind);
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

      if (kind === "docx") {
        await exportCvDocx(draft);
      } else {
        await exportCvPdf(draft);
      }
    } catch (err) {
      const limit = parseLimitError(err);
      if (limit) {
        setLimitInfo(limit);
      } else {
        setError(err instanceof Error ? err.message : "Falha ao exportar.");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" disabled={!ready || busy !== null}>
            {busy ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-4 w-4" />
            )}
            Exportar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleExport("pdf")}>
            <FileText className="mr-2 h-4 w-4" />
            PDF (imprimir)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport("docx")}>
            <FileType2 className="mr-2 h-4 w-4" />
            DOCX (Word)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
