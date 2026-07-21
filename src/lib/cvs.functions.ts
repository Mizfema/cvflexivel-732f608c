import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  sections: z.any(),
  template: z.string().min(1).max(50),
  design: z.any(),
  sectionLayout: z.any().optional().nullable(),
});

/**
 * Guarda (upsert) o CV do utilizador autenticado.
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
      section_layout: data.sectionLayout ?? null,
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

/** Lista CVs do utilizador, ordenados por updated_at desc. Inclui `sections`/
 * `design` para a grelha "Os meus CVs" poder renderizar uma miniatura real. */
export const listCvs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("cvs")
      .select("id, title, template, sections, design, section_layout, updated_at, created_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return {
      cvs: (data ?? []).map(({ section_layout, ...row }) => ({
        ...row,
        sectionLayout: section_layout,
      })),
    };
  });

/** Obtém um CV completo. */
export const getCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("cvs")
      .select("id, title, template, sections, design, section_layout, updated_at")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (error) throw new Error(error.message);
    const { section_layout, ...rest } = row;
    return { ...rest, sectionLayout: section_layout };
  });

/** Apaga um CV. */
export const deleteCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("cvs")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Duplica um CV existente. Devolve o id do novo CV. */
export const duplicateCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: src, error: e1 } = await supabase
      .from("cvs")
      .select("title, template, sections, design")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (e1) throw new Error(e1.message);
    const { data: row, error: e2 } = await supabase
      .from("cvs")
      .insert({
        user_id: userId,
        title: `${src.title} (cópia)`,
        template: src.template,
        sections: src.sections,
        design: src.design,
      })
      .select("id")
      .single();
    if (e2) throw new Error(e2.message);
    return { id: row.id };
  });
