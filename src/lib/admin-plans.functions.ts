import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-auth.server";
import { recordAdminAction } from "@/lib/admin-audit.server";
import { reasonSchema } from "@/lib/admin-actions.functions";
import { listPlans, createPlan, updatePlan, archivePlan, reactivatePlan } from "@/lib/admin-plans.server";

const planFieldsSchema = z.object({
  label: z.string().trim().min(1).max(200),
  price_mzn: z.number().positive(),
  period_minutes: z.number().int().positive().nullable().optional(),
  credits: z.number().int().positive().nullable().optional(),
  features: z.array(z.string().trim().min(1)).default([]),
  display_order: z.number().int().default(0),
  visible_on_pricing_page: z.boolean().default(true),
  is_promotional: z.boolean().default(false),
  promo_badge_text: z.string().trim().min(1).max(60).nullable().optional(),
  promo_ends_at: z.string().datetime().nullable().optional(),
  promo_price_mzn: z.number().positive().nullable().optional(),
  bypasses_fair_use: z.boolean().default(false),
  fair_use_hourly_cap: z.number().int().positive().nullable().optional(),
});

export const listAdminPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return listPlans();
  });

const createPlanSchema = planFieldsSchema.extend({
  plan: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]+$/, "O identificador só pode ter letras minúsculas, números e underscore."),
  kind: z.enum(["subscription_unlimited", "credit_pack"]),
  reason: reasonSchema,
});

export const createAdminPlanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createPlanSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    const { plan, kind, reason, ...fields } = data;
    const inserted = await createPlan(plan, kind, fields);

    await recordAdminAction(context.userId, null, "create_plan", reason, {
      planId: inserted.id,
      plan,
      kind,
      ...fields,
    });

    return inserted;
  });

const updatePlanSchema = planFieldsSchema.extend({
  id: z.string().uuid(),
  reason: reasonSchema,
});

export const updateAdminPlanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updatePlanSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    const { id, reason, ...fields } = data;
    const { updated, plan } = await updatePlan(id, fields);

    await recordAdminAction(context.userId, null, "update_plan", reason, {
      planId: id,
      plan,
      ...fields,
    });

    return updated;
  });

const archivePlanSchema = z.object({ id: z.string().uuid(), reason: reasonSchema });

export const archiveAdminPlanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => archivePlanSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    const updated = await archivePlan(data.id);

    await recordAdminAction(context.userId, null, "archive_plan", data.reason, {
      planId: data.id,
      plan: updated.plan,
    });

    return updated;
  });

const reactivatePlanSchema = z.object({ id: z.string().uuid(), reason: reasonSchema });

/** Regista como 'update_plan' — não há um action_type 'reactivate_plan'
 * próprio (a migration da B0 só previu create/update/archive para planos). */
export const reactivateAdminPlanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reactivatePlanSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    const updated = await reactivatePlan(data.id);

    await recordAdminAction(context.userId, null, "update_plan", data.reason, {
      planId: data.id,
      plan: updated.plan,
      action: "reactivate",
    });

    return updated;
  });
