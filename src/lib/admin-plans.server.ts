import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PlanKind = "subscription_unlimited" | "credit_pack";

/** Campos mutáveis de um plano (Fase B1) — `plan` (slug) e `kind` ficam de
 * fora: são imutáveis depois de criados (N5 do Guia B0-B5). */
export interface PlanFields {
  label: string;
  price_mzn: number;
  period_minutes?: number | null;
  credits?: number | null;
  features: string[];
  display_order: number;
  visible_on_pricing_page: boolean;
  is_promotional: boolean;
  promo_badge_text?: string | null;
  promo_ends_at?: string | null;
  promo_price_mzn?: number | null;
  bypasses_fair_use: boolean;
  fair_use_hourly_cap?: number | null;
}

/** Validações de negócio condicionadas ao `kind` (imutável) — nunca confiar
 * só no zod da camada de servidor para regras que dependem de outro campo.
 * Espelham as decisões fechadas do Guia B0-B5: Q1 (bypass nunca sem teto),
 * N2 (promo nunca sem preço efetivo menor que o base). */
export function validatePlanFields(kind: PlanKind, fields: PlanFields): void {
  if (kind === "subscription_unlimited" && !(fields.period_minutes && fields.period_minutes > 0)) {
    throw new Error("Plano de assinatura ilimitada precisa de uma duração (period_minutes > 0).");
  }
  if (kind === "credit_pack" && !(fields.credits && fields.credits > 0)) {
    throw new Error("Pacote de créditos precisa de credits > 0.");
  }
  if (fields.is_promotional) {
    if (!fields.promo_price_mzn || fields.promo_price_mzn <= 0) {
      throw new Error("Plano promocional precisa de um preço promocional (promo_price_mzn > 0).");
    }
    if (fields.promo_price_mzn >= fields.price_mzn) {
      throw new Error("O preço promocional tem de ser menor que o preço base.");
    }
  }
  if (fields.bypasses_fair_use && !(fields.fair_use_hourly_cap && fields.fair_use_hourly_cap > 0)) {
    throw new Error(
      "Planos com bypass de fair-use exigem um teto por hora (fair_use_hourly_cap > 0) — nunca ilimitado sem teto técnico.",
    );
  }
}

export async function listPlans() {
  const { data, error } = await supabaseAdmin
    .from("plan_prices")
    .select("*")
    .order("display_order");
  if (error) throw new Error(error.message);
  return data;
}

/** Nunca faz upsert por ON CONFLICT — `plan` é a PK, um slug duplicado deve
 * falhar com um erro amigável (23505), não silenciosamente sobrescrever. */
export async function createPlan(plan: string, kind: PlanKind, fields: PlanFields) {
  validatePlanFields(kind, fields);

  const { data, error } = await supabaseAdmin
    .from("plan_prices")
    .insert({ plan, kind, enabled: true, ...fields })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") {
      throw new Error(`Já existe um plano com o identificador "${plan}".`);
    }
    throw new Error(error.message);
  }
  return data;
}

/** `plan` e `kind` são imutáveis (N5) — não fazem parte de `fields`, por isso
 * nem é possível chamar esta função para os mudar. Busca o `kind` existente
 * (só leitura) para validar os campos condicionados a ele. */
export async function updatePlan(id: string, fields: PlanFields) {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("plan_prices")
    .select("plan, kind")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!existing) throw new Error("Plano não encontrado.");

  validatePlanFields(existing.kind as PlanKind, fields);

  const { data, error } = await supabaseAdmin
    .from("plan_prices")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { updated: data, plan: existing.plan as string };
}

/** Nunca DELETE (Q4) — "remover" = enabled=false. Também desliga
 * visible_on_pricing_page para nunca sobrar visível em /planos desativado. */
export async function archivePlan(id: string) {
  const { data, error } = await supabaseAdmin
    .from("plan_prices")
    .update({ enabled: false, visible_on_pricing_page: false })
    .eq("id", id)
    .select("plan")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Reverso do archive — NÃO restaura visible_on_pricing_page automaticamente
 * (decisão separada do admin, feita no formulário). */
export async function reactivatePlan(id: string) {
  const { data, error } = await supabaseAdmin
    .from("plan_prices")
    .update({ enabled: true })
    .eq("id", id)
    .select("plan")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
