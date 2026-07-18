// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // Disable auto code-splitting: the current TanStack Start pre-1.0 releases
    // have fragmented internal versions (react-router 1.170 + start-plugin-core
    // 1.171 + start-server-core 1.169) that emit lazy route chunks whose default
    // export is undefined at SSR time, causing `TypeError: Cannot read
    // properties of undefined (reading 'bind')` inside React.lazy during
    // renderToReadableStream. Turning this off makes routes eager and the SSR
    // stream renders normally.
    autoCodeSplitting: false,
  },
});
