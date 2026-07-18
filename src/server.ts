import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { tsrStartManifest } from "tanstack-start-manifest:v";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type StartManifest = {
  routes?: {
    __root__?: {
      preloads?: Array<string>;
      scripts?: Array<{ attrs?: Record<string, string | boolean | undefined> }>;
      links?: Array<{ attrs?: Record<string, string | boolean | undefined> }>;
    };
  };
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

function attr(name: string, value: string | boolean | undefined): string {
  if (value === true) return ` ${name}`;
  if (value === false || value == null) return "";
  return ` ${name}="${String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"`;
}

function safeScriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function renderClientShell(): Response | null {
  const manifest = tsrStartManifest() as StartManifest;
  const root = manifest.routes?.__root__;
  const scripts = root?.scripts ?? [];
  const links = root?.links ?? [];
  const preloads = root?.preloads ?? [];
  if (scripts.length === 0) return null;

  const preloadTags = preloads
    .map((href) => `<link rel="modulepreload" href="${href}">`)
    .join("");
  const linkTags = links
    .map(({ attrs }) => `<link${Object.entries(attrs ?? {}).map(([key, value]) => attr(key, value)).join("")}>`)
    .join("");
  const scriptTags = scripts
    .map(({ attrs }) => `<script${Object.entries(attrs ?? {}).map(([key, value]) => attr(key, value)).join("")}></script>`)
    .join("");
  const bootstrap = {
    initialized: false,
    buffer: [],
    router: {
      manifest,
      matches: [],
    },
  };

  return new Response(
    `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>CVelite — Alinha o teu CV à vaga</title><meta name="description" content="Descobre o que a vaga realmente avalia e alinha o teu CV.">${preloadTags}${linkTags}</head><body><script>window.$_TSR=${safeScriptJson(bootstrap)}</script>${scriptTags}</body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      if (isPageRequest(request)) {
        const shell = renderClientShell();
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
