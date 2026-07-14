import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** ~100 anos — o mesmo valor do exemplo oficial de "ban indefinido" na doc do
 * GoTrueAdminApi (@supabase/auth-js, confirmado na v2.108.2 instalada).
 * `ban_duration: "none"` reverte o ban (também confirmado no tipo
 * AdminUserAttributes desta versão). Não existe, nesta versão, um método de
 * revogação de sessão/refresh token por userId (só `signOut(jwt, scope)`, que
 * exige o próprio JWT do utilizador) — por isso um access token já emitido
 * continua válido até ao seu `exp` (TTL tipicamente 1h). Limite honesto,
 * documentado na Fase A4 do painel admin, não escondido. */
const INDEFINITE_BAN = "876000h";

export async function hasActiveSuspension(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("user_suspensions")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

/** Bloqueia primeiro na Auth API (fora do alcance de RLS `public`, bloqueia
 * novo login/refresh na origem); só grava em `user_suspensions` se o ban tiver
 * sucesso, e reverte o ban se o insert falhar depois — nunca deixa a conta
 * banida sem o registo correspondente (nem o registo sem o ban efetivo). */
export async function suspendUser(userId: string, actorId: string, reason: string): Promise<void> {
  if (await hasActiveSuspension(userId)) {
    throw new Error("Esta conta já está suspensa.");
  }

  const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: INDEFINITE_BAN,
  });
  if (banError) throw new Error(banError.message);

  const { error: insertError } = await supabaseAdmin
    .from("user_suspensions")
    .insert({ user_id: userId, suspended_by: actorId, reason });
  if (insertError) {
    await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "none" });
    throw new Error(insertError.message);
  }
}

export async function reactivateUser(userId: string): Promise<void> {
  if (!(await hasActiveSuspension(userId))) {
    throw new Error("Utilizador não está suspenso.");
  }

  const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: "none",
  });
  if (unbanError) throw new Error(unbanError.message);

  const { error: deleteError } = await supabaseAdmin
    .from("user_suspensions")
    .delete()
    .eq("user_id", userId);
  if (deleteError) throw new Error(deleteError.message);
}

/** Erro distinto (D7 da Fase A4) — nunca a mensagem genérica de limite.
 * Propositadamente uma mensagem simples (não o envelope JSON de
 * LimitReachedError): `parseLimitError` devolve null para isto, por isso cai
 * sempre no bloco de erro genérico dos ecrãs de IA/download, que já é
 * visualmente distinto do `UsageLimitNotice` (paywall). */
export class AccountSuspendedError extends Error {
  constructor() {
    super("A tua conta foi suspensa. Contacta cvflexivel@gmail.com.");
    this.name = "AccountSuspendedError";
  }
}
