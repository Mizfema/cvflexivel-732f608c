import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const questionSchema = z.object({
  categoria: z.enum(["comportamental", "tecnica", "sobre_empresa", "eliminatoria"]),
  pergunta: z.string(),
  resposta_sugerida: z.string(),
});

const saveSchema = z.object({
  cvId: z.string().uuid().optional().nullable(),
  jobTdr: z.string().min(1),
  questions: z.array(questionSchema),
});

/** Guarda uma nova preparação de entrevista do utilizador autenticado. */
export const saveInterviewPrep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("interview_preps")
      .insert({
        user_id: userId,
        cv_id: data.cvId ?? null,
        job_tdr: data.jobTdr,
        questions: data.questions,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

/** Lista preparações de entrevista do utilizador, ordenadas por criação desc.
 * Inclui `questions` (Fase 2): a grelha de miniaturas precisa do conteúdo
 * completo de cada preparação para renderizar a página 1 real, tal como
 * listCvs/listCoverLetters já devolvem `sections`/`content` inteiros para as
 * miniaturas de CV/carta. */
export const listInterviewPreps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("interview_preps")
      .select("id, cv_id, job_tdr, questions, created_at, updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { preps: data ?? [] };
  });

/** Obtém uma preparação de entrevista completa (com as perguntas). */
export const getInterviewPrep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("interview_preps")
      .select("id, cv_id, job_tdr, questions, created_at, updated_at")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
