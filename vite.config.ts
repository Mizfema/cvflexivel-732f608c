// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Serve a prerendered SPA shell for page requests. This avoids the per-request
    // SSR path that crashes with `Cannot read properties of undefined (reading 'bind')`
    // on lazy route chunks, while keeping server functions and /api/* fully working.
    spa: { enabled: true },
    router: {
      // Disable route option splitting to prevent lazy-chunk `bind` crashes.
      codeSplittingOptions: {
        defaultBehavior: [],
      },
    },
  },
});
