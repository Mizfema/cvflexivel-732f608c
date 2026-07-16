import { createStart, createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);

    const request = getRequest();
    const isServerFnRequest =
      request?.headers.get("x-tsr-serverfn") === "true" ||
      (request?.url ? new URL(request.url).pathname.includes("/_serverFn/") : false);

    if (isServerFnRequest) {
      return new Response(errorMessage(error), {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
