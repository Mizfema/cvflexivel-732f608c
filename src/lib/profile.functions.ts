import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const updateProfileSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  headline: z.string().trim().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  country: z.string().trim().max(100).optional().or(z.literal("")),
  linkedin: z.string().trim().max(300).optional().or(z.literal("")),
  website: z.string().trim().max(300).optional().or(z.literal("")),
  avatar_url: z.string().trim().max(500).optional(),
});

function emptyToNull(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

/** Obtém o perfil do utilizador autenticado. */
export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, email, headline, phone, city, country, linkedin, website, avatar_url")
      .eq("id", userId)
      .single();
    if (error) throw new Error(error.message);
    return data;
  });

/** Atualiza os campos editáveis do perfil (email não é editável aqui). */
export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateProfileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      full_name: data.full_name,
      headline: emptyToNull(data.headline),
      phone: emptyToNull(data.phone),
      city: emptyToNull(data.city),
      country: emptyToNull(data.country),
      linkedin: emptyToNull(data.linkedin),
      website: emptyToNull(data.website),
      ...(data.avatar_url !== undefined ? { avatar_url: data.avatar_url } : {}),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
