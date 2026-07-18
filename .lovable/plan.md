## Problema

O erro `window.$_TSR?.h is not a function` (páginas em branco em dev e produção) vem do shell HTML manual que introduzi em `src/server.ts`. O cliente do TanStack Start chama `window.$_TSR.h(...)` incondicionalmente durante a bootstrap — essa função `h` só existe quando o servidor emite o payload de streaming SSR real. O bootstrap manual que escrevi (`{ initialized: false, buffer: [], router: {...} }`) não tem `h`, então qualquer página carregada falha imediatamente e o React nunca hydrata.

Um shell caseiro não consegue emular esse contrato interno. A solução correta é usar o **SPA mode oficial do TanStack Start** (`tanstackStart.spa.enabled: true`), que é exatamente para este caso: o próprio framework prerenderiza um shell `/_shell` no build com o `$_TSR.h` correto e serve para todas as rotas de página, sem executar SSR por request (evita também o bug do `bind` que motivou o shell manual).

## Mudanças

### 1. `vite.config.ts`
- Remover o override `tanstackStart.server.entry = "server"` (deixa o entry padrão do framework rodar).
- Remover os hacks `nitro.prerender` / `routeRules` que só existiam por causa do shell manual.
- Ativar `tanstackStart.spa: { enabled: true }`.
- Manter `router.codeSplittingOptions.defaultBehavior: []` (é o que evita o crash de `bind` em lazy chunks).

### 2. `src/server.ts`
- Reverter para um wrapper mínimo: import lazy de `@tanstack/react-start/server-entry`, try/catch, `normalizeCatastrophicSsrResponse`, e nada mais. Sem `renderClientShell`, sem `isPageRequest`, sem `tsrStartManifest`.
- Manter `import "./lib/error-capture"` no topo e o uso de `consumeLastCapturedError`.

### 3. `src/start-manifest.d.ts`
- Deletar (só existia para o shell manual).

### 4. `src/start.ts`
- Sem alterações — o `errorMiddleware` continua correto.

## Validação

1. `bun run build` deve passar (o SPA prerender gera `/_shell` sem crawler).
2. Preview local: `/` renderiza a landing sem erro no console.
3. Server functions (analyzeCoverage, alignCvToTdr, etc.) continuam funcionando pois `spa.enabled` só troca a resposta HTML — as rotas `/api/*` e `/_serverFn/*` seguem o handler normal do TanStack Start.
4. Republicar e confirmar em `https://cvelite.lovable.app`.

## Notas técnicas

- SPA mode ≠ desativar server functions. `spa.enabled: true` só faz o request HTML servir o shell prerenderizado; RPC e server routes continuam operacionais.
- Não mexer no `codeSplittingOptions.defaultBehavior: []` — foi o que estabilizou o `bind` de lazy chunks anteriormente.
- Se o build do SPA falhar por causa do prerender do `/_shell`, é sinal de erro genuíno num loader/head/root — a mensagem do prerender vai apontar a linha exata, e aí resolvemos o loader (não voltamos ao shell manual).
