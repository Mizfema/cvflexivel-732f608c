// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    // Disable prerender/SPA-shell steps — this project runs SSR at request
    // time via the Cloudflare Worker output. Enabling SPA mode conflicts with
    // the Nitro adapter (Nitro rewrites dist/server, so the Vite preview
    // server can't find server.js for the prerender crawl).
    prerender: { enabled: false },
    router: {
      // Disable route option splitting to prevent lazy-chunk `bind` crashes
      // at runtime in production.
      codeSplittingOptions: {
        defaultBehavior: [],
      },
    },
  },
});
