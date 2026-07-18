## Diagnóstico confirmado

- A produção em `https://cvelite.lovable.app/` responde **HTTP 500**.
- Os logs publicados mostram o erro real durante SSR:

```text
Error in renderToReadableStream: TypeError: Cannot read properties of undefined (reading 'bind')
at Lazy
at MatchInnerImpl
```

- Portanto, isto não é um problema visual da landing page. É o servidor de produção a tentar renderizar uma route lazy do TanStack Start e a falhar antes da página chegar ao browser.
- O dev funciona porque o ambiente local não reproduz exatamente o bundling/SSR de produção.

## Plano de correção

### 1. Estabilizar as versões TanStack

O `package.json` está com versões desalinhadas:

```text
@tanstack/react-router 1.170.17
@tanstack/react-start  1.168.27
@tanstack/router-plugin 1.168.19
```

Vou alinhar `@tanstack/react-router`, `@tanstack/react-start` e `@tanstack/router-plugin` para a mesma família compatível, evitando que o runtime SSR use contratos internos diferentes entre router/start/plugin.

### 2. Desativar SSR apenas para as páginas React

Em vez de continuar a tentar renderizar as páginas por SSR em produção, vou usar a forma oficial do TanStack Start para evitar SSR de rotas:

```ts
createStart(() => ({
  defaultSsr: false,
  ...
}))
```

Isto faz as páginas carregarem como app client-side, evitando o crash `Lazy.bind` no servidor.

Importante: server functions e APIs continuam a funcionar; isto só muda a renderização inicial das páginas.

### 3. Manter o wrapper de erro, mas não depender dele como solução principal

`src/server.ts` já transforma o 500 genérico em página de erro. Vou manter esse wrapper para logging/fallback, mas a correção real será impedir que as páginas entrem no caminho SSR que está a quebrar.

### 4. Rever configuração Vite/TanStack sem voltar ao shell manual

Não vou reintroduzir o shell HTML manual que causou `window.$_TSR?.h is not a function`.

A configuração deve ficar simples:

- manter `server.entry = "server"` para preservar o wrapper de erros;
- manter `prerender.enabled = false` para evitar o erro de crawler/prerender;
- manter ou ajustar `codeSplittingOptions.defaultBehavior` apenas se continuar necessário depois do `defaultSsr: false`.

### 5. Validar

Depois da implementação:

1. Rodar build de produção.
2. Testar localmente a resposta HTML.
3. Publicar/republicar.
4. Confirmar que `/` em produção deixa de responder 500.
5. Verificar logs publicados para garantir que o erro `Cannot read properties of undefined (reading 'bind')` parou.

## Resultado esperado

- Produção deixa de mostrar `This page didn't load`.
- As páginas públicas e autenticadas passam a abrir.
- Funcionalidades de IA/server functions continuam acessíveis via chamadas RPC/API.
- Evitamos repetir as duas soluções que já falharam: SPA shell manual e prerender SPA que quebra no crawler.