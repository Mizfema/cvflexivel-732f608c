import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  sections: z.any(),
  template: z.string().min(1).max(50),
  design: z.any(),
});

/**
 * Guarda (upsert) o CV do utilizador autenticado. Devolve o id resultante.
 * Usado quando o utilizador faz login antes de exportar — migra o rascunho
 * local para a base de dados.
 */
export const saveCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      user_id: userId,
      title: data.title,
      sections: data.sections,
      template: data.template,
      design: data.design,
      updated_at: new Date().toISOString(),
    };

    if (data.id) {
      const { data: row, error } = await supabase
        .from("cvs")
        .update(payload)
        .eq("id", data.id)
        .eq("user_id", userId)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: row.id };
    }

    const { data: row, error } = await supabase
      .from("cvs")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });
