import { createServerFn } from "@tanstack/react-start";
import { optionalIdentity } from "@/lib/access-control.server";
import { hasActivePlan } from "@/lib/subscription.server";

/** Usado pelo cliente para decidir entre vitrine e funcionalidade completa
 * (ex: preparação de entrevista). Sessão é opcional (anónimo também não tem
 * plano). A verificação que realmente importa continua server-side em
 * requireUsageAllowed/hasActivePlan. */
export const getMyPlanStatus = createServerFn({ method: "GET" })
  .middleware([optionalIdentity])
  .handler(async ({ context }) => ({ isPremium: await hasActivePlan(context.userId) }));
