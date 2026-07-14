import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/lib/admin-auth.server";
import { recordAdminAction } from "@/lib/admin-audit.server";
import { adminGrantPlan, adminRevokePlan } from "@/lib/subscription.server";
import { adminAdjustCredits } from "@/lib/credits.server";
import { suspendUser, reactivateUser } from "@/lib/user-suspension.server";

export const reasonSchema = z
  .string()
  .trim()
  .min(3, "O motivo tem de ter pelo menos 3 caracteres.")
  .max(500);

async function getTargetSnapshot(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { targetEmail: data?.email ?? null, targetName: data?.full_name ?? null };
}

// Fase B3: plan deixa de ser um union estático — validado em runtime contra
// plan_prices dentro de adminGrantPlan (Fase B1), não aqui.
const grantPlanSchema = z.object({
  userId: z.string().uuid(),
  plan: z.string().trim().min(1),
  periodDays: z.number().int().min(1).max(3650),
  reason: reasonSchema,
});

export const adminGrantPlanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => grantPlanSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    const subscription = await adminGrantPlan(data.userId, data.plan, data.periodDays);
    const snapshot = await getTargetSnapshot(data.userId);
    await recordAdminAction(context.userId, data.userId, "grant_plan", data.reason, {
      ...snapshot,
      plan: data.plan,
      periodDays: data.periodDays,
      newPeriodEnd: subscription.current_period_end,
    });

    return subscription;
  });

const revokePlanSchema = z.object({
  userId: z.string().uuid(),
  reason: reasonSchema,
});

export const adminRevokePlanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => revokePlanSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    const subscription = await adminRevokePlan(data.userId);
    const snapshot = await getTargetSnapshot(data.userId);
    await recordAdminAction(context.userId, data.userId, "revoke_plan", data.reason, {
      ...snapshot,
      revokedSubscriptionId: subscription.id,
    });

    return subscription;
  });

const adjustCreditsSchema = z.object({
  userId: z.string().uuid(),
  delta: z
    .number()
    .int()
    .refine((n) => n !== 0, "O ajuste tem de ser diferente de zero."),
  periodDays: z.number().int().min(1).max(3650).optional(),
  reason: reasonSchema,
});

export const adminAdjustCreditsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => adjustCreditsSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    const newBalance = await adminAdjustCredits(data.userId, data.delta, data.periodDays);
    const snapshot = await getTargetSnapshot(data.userId);
    await recordAdminAction(context.userId, data.userId, "adjust_credits", data.reason, {
      ...snapshot,
      delta: data.delta,
      newBalance,
    });

    return { newBalance };
  });

const suspendUserSchema = z.object({
  userId: z.string().uuid(),
  reason: reasonSchema,
});

export const adminSuspendUserFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => suspendUserSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    if (data.userId === context.userId) {
      throw new Error("Não podes suspender a tua própria conta.");
    }

    const { data: targetAdminRole, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", data.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (rolesError) throw new Error(rolesError.message);
    if (targetAdminRole) {
      throw new Error(
        "Esta conta tem a role admin — remove a role via SQL antes de suspender.",
      );
    }

    await suspendUser(data.userId, context.userId, data.reason);
    const snapshot = await getTargetSnapshot(data.userId);
    await recordAdminAction(context.userId, data.userId, "suspend_user", data.reason, snapshot);
  });

const reactivateUserSchema = z.object({
  userId: z.string().uuid(),
  reason: reasonSchema,
});

export const adminReactivateUserFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reactivateUserSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    await reactivateUser(data.userId);
    const snapshot = await getTargetSnapshot(data.userId);
    await recordAdminAction(context.userId, data.userId, "reactivate_user", data.reason, snapshot);
  });
