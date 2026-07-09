import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireUsageAllowed } from "./access-control.server";
import { getTemplate } from "./cv-design-presets";

const inputSchema = z.object({
  templateId: z.string().min(1).max(50),
});

/** Gate server-side de download (Fase 1.3): sessão já é exigida pelo
 * middleware (cobre "anónimo ❌"), e a feature depende do template ser
 * premium ou não. Nunca lança para quem tem sessão + dentro do limite. */
export const checkDownloadAllowed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const feature = getTemplate(data.templateId).isPremium ? "download_premium" : "download_free";
    return requireUsageAllowed(feature, context.userId, null);
  });
