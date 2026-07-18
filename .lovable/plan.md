## Objetivo
Corrigir o erro de produção em que qualquer refresh abre a página genérica “This page didn’t load” e as funcionalidades de IA falham com `Cannot read properties of undefined (reading 'bind')`.

## Diagnóstico confirmado
- A produção está a falhar durante SSR com `TypeError: Cannot read properties of undefined (reading 'bind')` dentro do renderizador do TanStack Router.
- O stack aponta para componentes `Lazy`, embora o `routeTree.gen.ts` local use imports estáticos.
- O lockfile está com versões TanStack desalinhadas: `@tanstack/react-start` em `1.168.28`, `@tanstack/router-plugin` em `1.168.20`, enquanto `@tanstack/react-router` está em `1.170.18` e dependências internas resolvem `router-core@1.171.15` / `start-plugin-core@1.171.20`.
- A configuração atual `codeSplittingOptions.defaultBehavior: []` reduz o splitting, mas não elimina a raiz provável: mistura de versões do runtime/plugin de Router/Start em produção.

## Plano de implementação
1. **Alinhar dependências TanStack**
   - Atualizar `@tanstack/react-start`, `@tanstack/react-router` e `@tanstack/router-plugin` para uma versão compatível entre si.
   - Preferir uma versão estável já disponível no cache/registry e compatível com Bun e o `minimumReleaseAge`.
   - Manter o uso de Bun, sem npm/yarn.

2. **Manter o workaround anti-lazy para produção**
   - Preservar `tanstackStart.router.codeSplittingOptions.defaultBehavior: []` no `vite.config.ts`.
   - Não adicionar plugins manualmente ao Vite, respeitando a configuração do projeto.

3. **Verificar build limpo localmente**
   - Rodar a validação de produção com `bun run build`.
   - Inspecionar o output gerado para confirmar que não restaram referências problemáticas de route lazy chunks como `lazyRouteComponent` nos bundles SSR.

4. **Validar a app no preview local**
   - Abrir `/`, `/analise`, `/editor`, `/planos` e uma rota autenticada quando possível.
   - Confirmar que refresh direto não devolve 500 no ambiente local.

5. **Republicar se o build passar**
   - Publicar novamente o app para que a produção receba o lockfile atualizado e o build limpo.
   - Depois da publicação, orientar teste de produção em duas frentes: refresh direto de páginas e chamadas de IA.

## Critério de sucesso
- Refresh direto em páginas publicadas deixa de mostrar “This page didn’t load”.
- Console deixa de mostrar 500 generalizado em navegação/refresh.
- Server functions de IA deixam de falhar com `Cannot read properties of undefined (reading 'bind')`.