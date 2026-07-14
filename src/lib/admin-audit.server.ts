import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const ADMIN_ACTION_TYPES = [
  "grant_plan",
  "revoke_plan",
  "adjust_credits",
  "suspend_user",
  "reactivate_user",
  "create_plan",
  "update_plan",
  "archive_plan",
] as const;
export type AdminActionType = (typeof ADMIN_ACTION_TYPES)[number];

/** Regista uma ação admin em admin_actions (append-only, ver migration
 * 20260713150000). metadata sempre inclui snapshot do alvo + contexto
 * forense do actor — este painel nasceu do incidente de segurança da v1. A
 * app corre como Cloudflare Worker (nitro.preset "cloudflare-module"), por
 * isso o IP vem do cabeçalho cf-connecting-ip, não de x-forwarded-for.
 * `targetId` é `null` para ações sem utilizador-alvo (Fase B1: criar/editar/
 * arquivar plano) — o "alvo" nesse caso vai no `metadata` (ex. `{ planId }`). */
export async function recordAdminAction(
  actorId: string,
  targetId: string | null,
  actionType: AdminActionType,
  reason: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const request = getRequest();
  const actorIp = request?.headers.get("cf-connecting-ip") ?? null;
  const actorUserAgent = request?.headers.get("user-agent") ?? null;

  const { error } = await supabaseAdmin.from("admin_actions").insert({
    actor_user_id: actorId,
    target_user_id: targetId,
    action_type: actionType,
    reason,
    metadata: { ...metadata, actorIp, actorUserAgent },
  });
  if (error) throw new Error(error.message);
}
