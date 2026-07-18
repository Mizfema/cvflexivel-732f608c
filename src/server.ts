import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

const CLIENT_ENTRY_SCRIPT_RE = /<script[^>]+type="module"[^>]+src="([^"]*\/assets\/index-[^"]+\.js)"[^>]*><\/script>/;
const CLIENT_CSS_LINK_RE = /<link[^>]+rel="stylesheet"[^>]+href="([^"]*\/assets\/styles-[^"]+\.css)"[^>]*>/;

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isPageRequest(request: Request): boolean {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api/")) return false;
  if (url.pathname.includes(".")) return false;
  const accept = request.headers.get("accept") ?? "";
  return request.method === "GET" && (accept.includes("text/html") || accept.includes("*/*"));
}

async function renderClientShell(request: Request, handler: ServerEntry): Promise<Response | null> {
  const url = new URL(request.url);
  const assetProbe = new Request(new URL("/__cvelite-shell-probe__", url.origin), {
    headers: { accept: "text/html" },
  });

  try {
    const response = await handler.fetch(assetProbe, undefined, undefined);
    const html = await response.text();
    const scriptSrc = html.match(CLIENT_ENTRY_SCRIPT_RE)?.[1];
    const cssHref = html.match(CLIENT_CSS_LINK_RE)?.[1];
    if (!scriptSrc) return null;

    const cssLink = cssHref ? `<link rel="stylesheet" href="${cssHref}">` : "";
    return new Response(
      `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>CVelite — Alinha o teu CV à vaga</title><meta name="description" content="Descobre o que a vaga realmente avalia e alinha o teu CV.">${cssLink}</head><body><div id="root"></div><script type="module" src="${scriptSrc}"></script></body></html>`,
      { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  } catch (error) {
    console.error(error);
    return null;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      if (isPageRequest(request)) {
        const shell = await renderClientShell(request, handler);
        if (shell) return shell;
      }

      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }

      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
