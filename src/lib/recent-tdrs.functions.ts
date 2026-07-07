import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RecentTdr, RecentTdrOrigem } from "./cover-letter-types";

function excerpt(text: string): string {
  const firstLine =
    text
      .split("\n")
      .find((l) => l.trim())
      ?.trim() ?? text;
  return firstLine.length > 90 ? firstLine.slice(0, 90) + "…" : firstLine;
}

/** TdRs distintos mais recentes do utilizador, vindos de analyses e interview_preps (sem tabela dedicada). */
export const listRecentTdrs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ tdrs: RecentTdr[] }> => {
    const { supabase, userId } = context;

    const [analysesRes, prepsRes] = await Promise.all([
      supabase
        .from("analyses")
        .select("job_tdr, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("interview_preps")
        .select("job_tdr, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    if (analysesRes.error) throw new Error(analysesRes.error.message);
    if (prepsRes.error) throw new Error(prepsRes.error.message);

    const combined: { origem: RecentTdrOrigem; texto: string; data: string }[] = [
      ...(analysesRes.data ?? []).map((r) => ({
        origem: "Análise" as const,
        texto: r.job_tdr,
        data: r.created_at,
      })),
      ...(prepsRes.data ?? [])
        .filter((r): r is { job_tdr: string; created_at: string } => !!r.job_tdr)
        .map((r) => ({
          origem: "Preparação de entrevista" as const,
          texto: r.job_tdr,
          data: r.created_at,
        })),
    ];
    combined.sort((a, b) => b.data.localeCompare(a.data));

    const seen = new Set<string>();
    const deduped: typeof combined = [];
    for (const item of combined) {
      if (seen.has(item.texto)) continue;
      seen.add(item.texto);
      deduped.push(item);
      if (deduped.length >= 8) break;
    }

    return {
      tdrs: deduped.map((t) => ({
        origem: t.origem,
        excerto: excerpt(t.texto),
        texto: t.texto,
        data: t.data,
      })),
    };
  });
