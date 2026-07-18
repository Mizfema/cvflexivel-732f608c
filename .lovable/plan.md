## Plano para corrigir o 500 em produção

### Diagnóstico confirmado
- A página publicada ainda responde `HTTP 500`.
- Os logs de produção confirmam o mesmo erro: `Cannot read properties of undefined (reading 'bind')` durante SSR.
- O stack trace mostra `at Lazy` dentro do TanStack Router, ou seja: a build publicada ainda contém rota renderizada via `React.lazy` no servidor.
- A configuração atual já tenta desativar o split via `codeSplittingOptions.defaultBehavior: []`, mas isso não está a ser suficiente no artefacto publicado.

### Correção proposta
1. **Corrigir a configuração do TanStack Start no `vite.config.ts`**
   - Manter `server.entry: "server"`.
   - Adicionar/desbloquear explicitamente `autoCodeSplitting: false` no nível correto da configuração, além do `codeSplittingOptions.defaultBehavior: []`.
   - Usar a forma compatível com o wrapper `@lovable.dev/vite-tanstack-config`, sem adicionar plugins manualmente.

2. **Remover a causa direta: componentes lazy nas rotas críticas**
   - Procurar arquivos `*.lazy.tsx` ou rotas que ainda geram `Lazy`.
   - Se existirem rotas lazy, converter para rotas normais `*.tsx` ou integrar o componente no arquivo da rota, para impedir `React.lazy` no SSR.
   - Não editar `routeTree.gen.ts` manualmente.

3. **Verificar dependências TanStack realmente resolvidas**
   - Conferir `bun.lock` para garantir que `@tanstack/react-start`, `@tanstack/react-router`, `@tanstack/router-core` e `@tanstack/router-plugin` não estão em versões incompatíveis entre si.
   - Se houver múltiplas versões, alinhar/pinar para uma coorte única estável.

4. **Validar localmente antes de publicar**
   - Fazer uma build limpa.
   - Inspecionar o artefacto SSR gerado para confirmar que não aparece `Lazy`/`lazyRouteComponent` nas rotas.
   - Confirmar que `/`, `/editor`, `/analise`, `/planos` respondem `200` no ambiente local.

5. **Republicar e validar produção**
   - Publicar novamente apenas depois da validação local.
   - Verificar `https://cvelite.lovable.app/` e logs publicados.
   - Confirmar ausência de `bind`, `Lazy` e `HTTP 500` nos logs recentes.

### Critério de sucesso
- Recarregar qualquer página publicada deixa de mostrar “This page didn’t load”.
- `/`, `/editor`, `/analise`, `/planos` retornam `200` em produção.
- As funções de IA deixam de falhar por causa do erro global de SSR.