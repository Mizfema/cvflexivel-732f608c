import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** A policy "No direct access to user_roles" bloqueia leitura via RLS para
 * anon/authenticated sempre, mesmo para o próprio dono da role — por isso usa
 * sempre supabaseAdmin (service role), nunca o cliente autenticado. */
export async function checkIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

export async function assertAdmin(userId: string) {
  if (!(await checkIsAdmin(userId))) {
    throw new Error("Acesso restrito a administradores.");
  }
}
