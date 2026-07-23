import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CATEGORY_ORDER } from "@/lib/interview-types";

const questionSchema = z.object({
  id: z.string().uuid(),
  categoria: z.enum(CATEGORY_ORDER),
  pergunta: z.string(),
  resposta_sugerida: z.string(),
});

const saveSchema = z.object({
  cvId: z.string().uuid().optional().nullable(),
  jobTdr: z.string().min(1),
  questions: z.array(questionSchema),
});

/** Fase 3A: mesmo schema de saveSchema, com `id` opcional — espelha
 * exactamente saveSchema de cvs.functions.ts (upsert: com id existente faz
 * update, sem id faz insert). */
const updateSchema = saveSchema.extend({
  id: z.string().uuid().optional(),
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

/** Guarda (upsert) uma preparação de entrevista do utilizador autenticado —
 * espelha exactamente saveCv (cvs.functions.ts:17-51): com `data.id` existente
 * faz update na linha (validado por user_id, nunca só por id), sem `data.id`
 * faz insert. Fase 3A: ainda não ligado a nenhuma UI — usado pelo futuro
 * autosave (use-interview-prep-autosave.ts), saveInterviewPrep continua a ser
 * quem grava a preparação recém-gerada pela primeira vez. */
export const updateInterviewPrep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      user_id: userId,
      cv_id: data.cvId ?? null,
      job_tdr: data.jobTdr,
      questions: data.questions,
    };

    if (data.id) {
      const { data: row, error } = await supabase
        .from("interview_preps")
        .update(payload)
        .eq("id", data.id)
        .eq("user_id", userId)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: row.id };
    }

    const { data: row, error } = await supabase
      .from("interview_preps")
      .insert(payload)
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
