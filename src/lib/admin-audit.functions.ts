import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/lib/admin-auth.server";
import { ADMIN_ACTION_TYPES, type AdminActionType } from "@/lib/admin-audit.server";
import type { Json } from "@/integrations/supabase/types";

export type { AdminActionType };

const listAdminActionsSchema = z.object({
  page: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(100).default(20),
  actionType: z.enum(ADMIN_ACTION_TYPES).optional(),
  targetUserId: z.string().uuid().optional(),
});

interface Person {
  id: string | null;
  name: string | null;
  email: string | null;
}

/** Leitura só-admin de admin_actions (a tabela continua invisível a
 * `authenticated` — RLS `USING(false)`, ver migration 20260713150000). Nomes
 * atuais de ator/alvo quando a FK não é nula; quando é (conta apagada,
 * `ON DELETE SET NULL`), usa o snapshot gravado no metadata na altura da ação
 * — hoje só o alvo tem snapshot (`targetName`/`targetEmail`, ver
 * admin-audit.server.ts), o ator nunca tinha esse campo gravado. */
export const listAdminActions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listAdminActionsSchema.parse(input ?? {}))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    const { page, pageSize, actionType, targetUserId } = data;
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = supabaseAdmin
      .from("admin_actions")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (actionType) query = query.eq("action_type", actionType);
    if (targetUserId) query = query.eq("target_user_id", targetUserId);

    const { data: rows, count, error } = await query;
    if (error) throw new Error(error.message);
    const actionRows = rows ?? [];

    const userIds = Array.from(
      new Set(
        actionRows
          .flatMap((r) => [r.actor_user_id, r.target_user_id])
          .filter((id): id is string => !!id),
      ),
    );

    const profilesById = new Map<string, { email: string | null; full_name: string | null }>();
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);
      if (profilesError) throw new Error(profilesError.message);
      for (const p of profiles ?? []) {
        profilesById.set(p.id, { email: p.email, full_name: p.full_name });
      }
    }

    const rowsOut = actionRows.map((r) => {
      const metadata = (r.metadata ?? {}) as Record<string, Json>;

      const actor: Person = r.actor_user_id
        ? {
            id: r.actor_user_id,
            name: profilesById.get(r.actor_user_id)?.full_name ?? null,
            email: profilesById.get(r.actor_user_id)?.email ?? null,
          }
        : { id: null, name: null, email: null };

      const targetSnapshotName = (metadata.targetName as string | null) ?? null;
      const targetSnapshotEmail = (metadata.targetEmail as string | null) ?? null;
      const targetProfile = r.target_user_id ? profilesById.get(r.target_user_id) : undefined;
      const target: Person = {
        id: r.target_user_id,
        name: targetProfile?.full_name ?? targetSnapshotName,
        email: targetProfile?.email ?? targetSnapshotEmail,
      };

      return {
        id: r.id,
        actionType: r.action_type as AdminActionType,
        reason: r.reason,
        createdAt: r.created_at,
        metadata,
        actor,
        target,
      };
    });

    return { rows: rowsOut, total: count ?? 0, page, pageSize };
  });
