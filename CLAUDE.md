# Instruções do projeto — CV Flexível

Este projeto foi criado e é sincronizado com o Lovable (two-way sync via GitHub, apenas na branch `main`). Leia isto antes de criar, editar ou alterar qualquer coisa.

**Status do ambiente local:** Bun instalado, dependências instaladas, Supabase CLI logado e vinculado ao projeto (`ylcsokafyoapziqjlmag`). Setup inicial concluído — não repetir.

## Stack real (não assuma o padrão genérico)

- **Framework:** TanStack Start (SSR), **não** é Vite+React clássico, **não** é Next.js, **não** é Remix.
- **Roteamento:** file-based via `@tanstack/react-router`, pasta `src/routes/`.
- **Gerenciador de pacotes:** **Bun**, não npm e não yarn. Use sempre `bun`, nunca `npm install` ou `npm run`.
- **Backend:** Supabase (Lovable Cloud), projeto `ylcsokafyoapziqjlmag`.
- **IA/LLM:** Lovable AI Gateway (`src/lib/ai-gateway.server.ts`, `src/lib/llm.functions.ts`) — chamadas de IA passam pela infraestrutura do Lovable, não por uma chave própria configurada manualmente.
- **Lógica de servidor:** `createServerFn` em arquivos `*.functions.ts` dentro de `src/lib/`. Esta stack **não usa** Supabase Edge Functions para isso.

## Comandos corretos

```bash
bun install      # nunca npm install
bun dev          # nunca npm run dev
bun run build    # validar build de produção antes de cada push
bun run lint
```

## Regras de roteamento (OBRIGATÓRIO seguir)

Cada arquivo `.tsx` em `src/routes/` é uma rota automática. Convenção exata:

| Arquivo | URL |
|---|---|
| `index.tsx` | `/` |
| `sobre.tsx` | `/sobre` |
| `users/index.tsx` | `/users` |
| `users/$id.tsx` | `/users/:id` (dinâmico, `$` sem chaves) |
| `posts/{-$category}.tsx` | `/posts/:category?` (opcional) |
| `files/$.tsx` | `/files/*` (splat, lido via `_splat`, nunca `*`) |
| `_layout.tsx` | rota de layout (renderiza filhos via `<Outlet />`) |
| `__root.tsx` | shell da aplicação, envolve todas as páginas |

**Nunca crie:**
- `src/pages/` (convenção de Next.js/Remix, não se aplica aqui)
- `src/routes/_app/index.tsx` ou `app/layout.tsx`
- Edições manuais em `routeTree.gen.ts` — é **auto-gerado**, nunca editar à mão.

Antes de criar uma página nova, olhe um arquivo existente como referência de padrão (`src/routes/analise.tsx`, `src/routes/vagas.tsx`, `src/routes/editor.tsx`).

## NUNCA tocar manualmente no `vite.config.ts`

O arquivo já tem este aviso no topo, respeite-o:

```
// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins
```

Isso inclui: tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro, componentTagger, injeção de env `VITE_*`, alias `@`, dedupe de React/TanStack. **Não adicione nenhum desses plugins de novo, mesmo que pareça que está faltando algo** — vai duplicar e quebrar o build.

## Banco de dados (Supabase) — fluxo obrigatório

O usuário deste projeto altera o schema do banco **direto pelo SQL Editor do Supabase**, não por migration manual. Por isso, a sincronização do schema com o repositório **não pode depender da memória do usuário** — é responsabilidade do Claude Code executar isto automaticamente.

### Regra para o Claude Code: SEMPRE rodar antes de tocar em qualquer coisa relacionada a banco

Antes de criar, editar ou ler qualquer código que envolva tabelas, colunas, RLS policies, enums ou funções do Supabase — **mesmo que o usuário não tenha pedido explicitamente** — execute primeiro:

```bash
supabase db pull
```

Isso compara o schema remoto com o histórico de migrations já commitado e gera automaticamente os arquivos `.sql` faltantes em `supabase/migrations/`, capturando qualquer mudança feita pelo SQL Editor desde a última sessão — sem exigir que o usuário tenha registrado nada manualmente.

Depois do `pull`, regenere os tipos TypeScript:

```bash
supabase gen types typescript --project-id ylcsokafyoapziqjlmag | Out-File -Encoding utf8 src/integrations/supabase/types.ts
```

**Atenção PowerShell:** nunca usar `>` para gravar este ficheiro — o PowerShell grava em UTF-16 por default, e o Git vê o `types.ts` como binário corrompido (diff mostra "Binary files ... differ"). Usar sempre `| Out-File -Encoding utf8` como acima. Se estiver a correr a partir do Git Bash, `>` já grava em UTF-8 e é seguro.

**Atenção ao `npx`:** o Supabase CLI já está instalado **globalmente via Bun** (`bun add -g supabase`, ver secção abaixo), logo o binário `supabase` já está disponível diretamente no PATH. Não usar `npx supabase` — é redundante e pode invocar uma versão diferente da CLI via registry do npm, em vez do binário já vinculado ao projeto. Confirmar com `supabase --version` que o binário responde; só se isso falhar, usar `bunx supabase` como fallback (nunca `npx`, para não misturar gestores de pacotes).

**Só então** prossiga com a alteração de código pedida pelo usuário.

### Configuração já concluída nesta máquina

```bash
bun add -g supabase     # ✅ feito
supabase login          # ✅ feito
supabase link --project-ref ylcsokafyoapziqjlmag   # ✅ feito
```

O CLI já está logado e vinculado a este projeto (`ylcsokafyoapziqjlmag`). Não é necessário repetir o `link` nesta máquina, exceto se: a pasta do projeto for movida/reclonada do zero, ou o usuário trocar de máquina/conta Supabase.

Se ainda assim o `supabase db pull` falhar por falta de link/login (ex: token expirado, nova máquina), **avise o usuário explicitamente** em vez de prosseguir sem sincronizar — não assuma que o schema local está atualizado.

**Nunca pule a regeneração de tipos.** Código que referencia uma coluna nova sem o `types.ts` atualizado compila normalmente em dev, mas com tipos errados — os erros só aparecem em runtime.

## Instalação de dependências

O `bunfig.toml` bloqueia pacotes publicados há menos de 24h (`minimumReleaseAge`). Se uma instalação de pacote novo falhar sem motivo aparente, essa é a causa mais provável — não é bug, é proteção deliberada contra supply-chain attack. Não adicione exceções a `minimumReleaseAgeExcludes` sem confirmar antes.

## Regras de sincronização com GitHub/Lovable

- O sync do Lovable só funciona na branch `main`. Não crie branches esperando que sincronizem antes do merge.
- Edição acontece **só localmente, neste VS Code** — nunca editar simultaneamente pelo editor visual do Lovable enquanto há alterações locais não commitadas.
- **Nunca** renomear, mover ou deletar o repositório GitHub conectado — quebra o sync de forma permanente.
- **Nunca** fazer `git push --force` na `main`.
- Antes de cada `git push origin main`, rodar `bun run build` para garantir que o build de produção passa (o ambiente do Lovable reconstrói a partir do que está no GitHub).

## Checklist antes de qualquer alteração

- [ ] É uma página nova? → arquivo em `src/routes/`, seguindo a tabela de convenções acima.
- [ ] Envolve banco de dados? → rodar `supabase db pull` + regenerar tipos ANTES de editar qualquer código relacionado.
- [ ] Envolve configuração de build/Vite? → não tocar em `vite.config.ts` manualmente.
- [ ] Antes do push: `bun run build` passou sem erro?
- [ ] O commit afeta só a `main`, e nenhuma edição simultânea está sendo feita no Lovable agora?