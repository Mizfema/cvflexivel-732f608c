# Guia A0–A5 — Painel Admin real: KPIs, gestão de utilizadores, licenças, suspensão e auditoria

> **Aprovado em 13/07/2026, após revisão do dono e do especialista externo (ronda de censura sobre
> a proposta inicial).** Este documento é agora a fonte de verdade da execução — substitui a
> proposta original. Como usar: no início de cada sessão nova do Claude Code, cole o **Prompt de
> Retomada** (secção abaixo) antes de qualquer coisa. Marque `[x]` em cada fase concluída **neste
> arquivo**.
>
> Regra de ouro desta ronda: **a ordem das fases não é negociável.** A auditoria e o guard de rota
> (A0) têm de existir antes de qualquer mutação; leitura (A2) vem antes de escrita (A3–A4); nenhuma
> fase de escrita fecha sem a ação correspondente aparecer em `admin_actions`.
> **Nenhum número inventado, nunca.** Métrica sem fonte real = tile removida ou marcada
> "indisponível", nunca estimada.

## Prompt de Retomada (colar no início de toda sessão nova)

```text
Lê o arquivo docs/PROPOSTA-PAINEL-ADMIN-V1.md inteiro antes de qualquer coisa. É o guia de
implementação aprovado do painel admin (fases A0–A5). Verifica nos checkboxes da secção "Fases
de execução" qual foi a última fase concluída, confirma no código se está mesmo implementada e
commitada, e diz-me qual é a próxima fase pendente. Não implementes nada ainda — só reporta o
estado. Lembra-te das regras do CLAUDE.md: bun (nunca npm), supabase db pull + regenerar types
antes de qualquer trabalho de banco, bun run build antes de qualquer push.
```

---

## Decisões fechadas (não reabrir durante a implementação)

| # | Decisão | Resolução |
|---|---|---|
| D1 | Rótulo "MRR" | Renomear para **"Receita confirmada (30d)"** + linha secundária "run-rate mensal equivalente". PaySuite é pré-pago sem recorrência — chamar de MRR seria mentir no próprio painel que existe para não mentir. |
| D2 | Definição de "utilizador ativo" | **Qualquer sinal**: linha em `ai_usage` OU `updated_at` recente em `cvs`/`cover_letters`/`interview_preps`. Produto de uso episódico — só-IA subestimaria retenção. |
| D3 | CAC / LTV / Payback | **Remover as tiles.** Não existe fonte de gasto de marketing. `marketing_spend` fica no backlog. |
| D4 | Promoção manual | Expira **exatamente como plano pago** (mesma fórmula do webhook). Nada de "permanente até revogar". |
| D5 | Dados de utilizador suspenso | **Reter tudo.** Suspender ≠ apagar; totalmente reversível. |
| D6 | Gestão de roles admin | **Só SQL/migration.** Sem UI de promover admin (superfície de escalonamento de privilégio). |
| D7 | Abrangência da suspensão | Bloqueio em **IA/download** (o vetor que custa dinheiro), com **erro distinto `ACCOUNT_SUSPENDED`** — nunca a mensagem genérica de limite. |
| D8 | Funil "Bateu no limite" | Marcar **"indisponível"** no painel. Instrumentação server-side fica no backlog. |
| D9 | Reversão de concessão | `adminRevokePlan` é **obrigatório na mesma fase** que `adminGrantPlan` (conceder sem poder reverter é meia-feature). |
| D10 | Impersonation ("entrar como utilizador") | **Excluído deliberadamente.** Maior superfície de risco possível num painel admin. Não adicionar "rapidinho" no futuro sem proposta própria. |
| D11 | Janelas temporais | Tudo em **UTC** (30d = `now() - interval '30 days'` UTC). Convenção fixa desde já para não recalcular histórico depois. |

**Duas correções técnicas adicionadas nesta revisão final (verificadas contra o schema ao vivo e o build atual, não estavam no rascunho original do especialista):**

- **D12 — `adminGrantPlan` não é um "upsert" literal.** `subscriptions` só tem `PRIMARY KEY (id)`,
  **sem** unique constraint em `user_id` (confirmado no dump ao vivo) — por desenho, um utilizador
  acumula várias linhas históricas, uma por checkout. `ON CONFLICT (user_id)` falharia em runtime,
  não há alvo de conflito. A lógica real: procurar a linha `status='active'` atual do utilizador
  (se existir) e estendê-la via `computeExtendedPeriodEnd`; senão, `INSERT` uma linha nova com
  `status='active'`, `provider='admin'`.
- **D13 — captura de IP em `admin_actions.metadata`.** A app corre como Cloudflare Worker
  (`nitro.preset: "cloudflare-module"`, confirmado no build) — usar o cabeçalho `cf-connecting-ip`
  especificamente, não um genérico `x-forwarded-for`.

---

## Porquê esta ordem (ler antes de começar)

| Fase | O quê | Porque nesta posição |
|---|---|---|
| A0 | Migrations (auditoria, suspensão, RPC, constraints) + guard de rota + reorganização `/admin` em sub-rotas | Auditoria tem de existir ANTES da primeira mutação admin. O guard fecha o buraco atual (rota renderiza antes da server function falhar). Tudo o resto assenta nestas fundações. |
| A1 | KPIs reais — matar o objeto `DEMO` | Só leitura, risco baixo, valor imediato: o painel deixa de mentir. Não depende de A2–A5. |
| A2 | Lista + detalhe de utilizadores (só leitura) | Ver antes de mexer. A página de detalhe é o palco onde as ações de A3/A4 vão viver — construir o palco primeiro. |
| A3 | Conceder/ajustar/revogar plano e créditos | Escrita em fluxo de dinheiro — exige A0 (auditoria) e A2 (UI de detalhe) prontos. |
| A4 | Suspender/reativar conta | Toca em Auth Admin API + access-control — a fase mais delicada, isolada de propósito. |
| A5 | Visualizador de auditoria | Os dados já existem desde A0; a UI vem no fim, quando já há ações reais para mostrar. |

**Fluxo por fase (igual ao habitual):** implementar → `bun dev` (BD real) → `bun run build` →
commit da fase → push `main` → validar no Lovable. Migrations + tipos regenerados em **commit
separado** do código. Antes de A0 (e de qualquer fase que toque schema): `supabase db pull` (ou o
workaround pg_dump sem Docker, ver memória `supabase-db-pull-without-docker`) + regenerar
`types.ts` conforme o CLAUDE.md — se o pull falhar por link/login, PARAR e avisar, nunca assumir
schema local atualizado.

---

## A0 — Fundamentos: migrations, guard de rota, reorganização em sub-rotas

### Contexto e decisões
- `admin_actions` é **append-only a sério**: os default privileges do Supabase já dão `ALL` a
  `service_role` automaticamente no `CREATE TABLE` (confirmado: `ALTER DEFAULT PRIVILEGES FOR ROLE
  "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role"` já existe neste projeto) —
  um `GRANT SELECT, INSERT` sozinho não remove nada. É preciso `REVOKE UPDATE, DELETE` explícito.
  Limite honesto: nenhum caminho da aplicação consegue alterar/apagar; o owner do banco consegue
  sempre.
- `user_suspensions`: **sem** `GRANT SELECT TO authenticated` (contradiz a policy `USING(false)`;
  o cliente nunca lê esta tabela diretamente — qualquer necessidade futura passa por server
  function).
- `ON DELETE SET NULL` nas FKs de `admin_actions` (o registo "suspendemos por X" não pode
  desaparecer se a conta for apagada); `metadata` guarda snapshot de email/nome do alvo **+ IP
  (`cf-connecting-ip`) e user-agent do actor** (contexto forense — este painel nasceu de um
  incidente de segurança).
- Suspensão em tabela dedicada, nunca booleano em `profiles`: a policy de update de `profiles` é
  row-level, não column-level — um campo lá seria gravável pelo próprio suspenso
  (auto-desbanimento).
- Nomes reais das constraints de `subscriptions.provider` e `credit_transactions.reason` têm de
  ser confirmados no banco antes de escrever o DROP (Postgres pode ter gerado nome diferente do
  padrão `<tabela>_<coluna>_check`).

### Prompt para o Claude Code

```
Lê o CLAUDE.md e cumpre todas as regras invioláveis (Bun, rotas só em src/routes/, nunca tocar em vite.config.ts, fluxo de banco obrigatório).

FASE A0 — Fundamentos do painel admin: migrations + guard de rota + sub-rotas.

PASSO 0 — SINCRONIZAÇÃO E AUDITORIA (antes de qualquer código)
1. Correr supabase db pull (ou o workaround pg_dump sem Docker já usado no projeto) + regenerar types.ts via `supabase gen types typescript --project-id ylcsokafyoapziqjlmag | Out-File -Encoding utf8 src/integrations/supabase/types.ts`. Se falhar por link/login, PARAR e avisar.
2. Confirmar no banco os NOMES REAIS das constraints: subscriptions_provider_check e credit_transactions_reason_check (podem ter nome gerado diferente).
3. Confirmar se profiles tem coluna de email pesquisável (necessário para a busca da fase A2) — já confirmado que sim, mas revalidar contra o schema puxado no passo 1.
4. Ler src/lib/admin.functions.ts, src/routes/_authenticated/route.tsx e src/routes/_authenticated/admin.tsx antes de mexer.

MIGRATIONS (uma migration, commit separado do código, tipos regenerados depois)
1. Tabela admin_actions:
   - id UUID PK default gen_random_uuid(); actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL; target_user_id idem; action_type TEXT NOT NULL CHECK IN ('grant_plan','revoke_plan','adjust_credits','suspend_user','reactivate_user'); reason TEXT NOT NULL; metadata JSONB NOT NULL DEFAULT '{}'; created_at TIMESTAMPTZ NOT NULL DEFAULT now().
   - RLS ativa + policy única "No direct access" FOR ALL TO anon, authenticated USING(false) WITH CHECK(false).
   - Append-only real: REVOKE UPDATE, DELETE ON public.admin_actions FROM service_role; (além de GRANT SELECT, INSERT TO service_role, redundante mas explícito). Comentar na migration porquê (default privileges já davam ALL a service_role neste projeto).
   - Índices: (target_user_id, created_at DESC) e (actor_user_id, created_at DESC).
2. Tabela user_suspensions:
   - user_id UUID PK REFERENCES auth.users(id) ON DELETE CASCADE; suspended_at TIMESTAMPTZ NOT NULL DEFAULT now(); suspended_by UUID REFERENCES auth.users(id) ON DELETE SET NULL; reason TEXT NOT NULL.
   - RLS ativa + policy "No direct access" FOR ALL TO anon, authenticated USING(false) WITH CHECK(false). NENHUM grant a authenticated. GRANT ALL a service_role (já implícito por default privileges, mas declarar por clareza).
   - Presença da linha = suspenso; reativar = DELETE.
3. CHECK constraints (usar os nomes reais confirmados no Passo 0):
   - subscriptions.provider passa a aceitar ('paysuite','stripe','admin').
   - credit_transactions.reason passa a aceitar ('purchase','recharge','debit','admin_grant','admin_adjustment').
   - NÃO tocar em payments.provider — concessão manual nunca gera linha em payments (não houve pagamento real; mantém as queries de receita limpas por construção).
4. RPC grant_credit_balance(p_user_id UUID, p_amount INT, p_package_id TEXT, p_new_expiry TIMESTAMPTZ, p_require_existing BOOLEAN) RETURNS TABLE(balance INT, expires_at TIMESTAMPTZ), SECURITY DEFINER, SET search_path = public, espelhando o padrão de debit_credit_balance da migration 20260711161500 (credit_balances.user_id já tem UNIQUE constraint, confirmado — ON CONFLICT (user_id) é válido aqui):
   - p_require_existing = true → UPDATE ... balance = balance + p_amount ... RETURNING (zero linhas se não existir — o chamador JS trata como erro).
   - p_require_existing = false → INSERT ... ON CONFLICT (user_id) DO UPDATE balance = balance + p_amount, expires_at = GREATEST(expires_at, p_new_expiry) ... RETURNING.
   - GRANT EXECUTE só a service_role.

CÓDIGO
1. Criar src/lib/admin-auth.server.ts: extrair checkIsAdmin/assertAdmin de admin.functions.ts para cá; admin.functions.ts passa a importar daqui. Zero mudança de comportamento.
2. Criar src/lib/admin-audit.server.ts: recordAdminAction(actorId, targetId, actionType, reason, metadata) — insere em admin_actions via supabaseAdmin; metadata sempre inclui snapshot { targetEmail, targetName } e, quando disponível no request (via getRequest() do @tanstack/react-start/server, mesmo padrão de auth-middleware.ts), { actorIp: header 'cf-connecting-ip', actorUserAgent: header 'user-agent' }.
3. Reorganizar /admin em área com sub-rotas, seguindo a convenção de layout já usada em src/routes/_authenticated/route.tsx:
   - src/routes/_authenticated/admin/route.tsx → layout com beforeLoad que chama getIsAdmin() e redireciona para "/" se não-admin (fecha o buraco atual em que a página renderiza antes da server function falhar); chrome com Tabs: Visão geral | Utilizadores | Auditoria (Utilizadores e Auditoria podem apontar para placeholders nesta fase).
   - Mover admin.tsx → admin/index.tsx sem mudar conteúdo ainda (o DEMO morre na A1, não aqui).
4. Editar src/lib/credits.server.ts: grantCredits() passa a chamar o RPC grant_credit_balance em vez do read-then-upsert em JS; o insert em credit_transactions continua em JS depois do RPC (mesmo desenho de debitCredits). Se o RPC devolver zero linhas no modo require_existing, lançar erro explícito — nunca falha silenciosa.

CRITÉRIOS DE ACEITAÇÃO
- /admin continua a funcionar exatamente como antes (visual idêntico), mas agora num layout com tabs e com redirect imediato para não-admins (testar com conta não-admin).
- Fluxo de compra de créditos existente (webhook) continua a funcionar com o novo RPC — testar caminho feliz em dev.
- Tentativa de UPDATE/DELETE em admin_actions com service_role no SQL Editor falha por falta de privilégio.
- bun run build limpo. Migration + types.ts em commit próprio.

NÃO FAZER
- Não tocar em vite.config.ts nem em auth-middleware.ts (gerado).
- Não editar routeTree.gen.ts à mão.
- Não implementar nenhuma mutação admin nesta fase.
```

---

## A1 — KPIs reais: matar o objeto `DEMO`

### Contexto e decisões
- Substituição campo a campo, com as decisões D1–D3/D8 já fechadas. Regra absoluta: **tile sem
  fonte real é removida ou marcada "indisponível" — nunca estimada.**
- O gráfico de receita vai começar quase vazio (histórico de pagamentos começa em 10/07/2026). É
  esperado e correto — não "enriquecer".
- Badges: "Dados reais" em tudo o que sobrar; o badge "Dados de demonstração" desaparece do app.

### Prompt para o Claude Code

```
Lê o CLAUDE.md. A0 concluída (admin em sub-rotas, guard ativo, auditoria e RPC existem).

FASE A1 — Substituir o objeto DEMO de getAdminDashboard por dados reais.

Em src/lib/admin.functions.ts (getAdminDashboard) e src/routes/_authenticated/admin/index.tsx:

SUBSTITUIÇÕES (todas as janelas em UTC)
1. "MRR" → renomear para "Receita confirmada (30d)": soma de payments.amount confirmados nos últimos 30 dias; variação % vs. janela dos 30 dias anteriores; linha secundária "run-rate mensal equivalente". A palavra "MRR" desaparece da UI.
2. Série de receita: payments confirmados agrupados por mês via paid_at. Gráfico quase vazio é o estado correto.
3. Conversão: utilizadores pagantes distintos ÷ total de utilizadores; upgrades = pagamentos confirmados com subscription_id (30d).
4. Retenção M1 + série semanal: cohort por semana de profiles.created_at × atividade, onde ATIVO = qualquer um de: linha em ai_usage OU updated_at na janela em cvs/cover_letters/interview_preps (decisão fechada — não usar só IA).
5. Margem de contribuição: (receita confirmada − custo de IA) ÷ receita, via payments + ai_usage.cost_usd (30d).
6. LTV simples: receita média por pagante — mostrar com nota "estimativa preliminar, histórico curto". SEM tempo médio de permanência inventado.
7. REMOVER as tiles CAC, LTV:CAC e Payback (nenhuma fonte existe). Remover também o veredicto "Favorável para investir" — era derivado de números fictícios.
8. Funil: Registo = count(profiles); CV criado = user_id distintos em cvs; CV descarregado = user_id distintos em ai_usage com feature IN ('download_free','download_premium'); "Bateu no limite" = mostrar como "indisponível — sem instrumentação server-side" (barra desativada, não zero); Upgrade = pagamentos confirmados com subscription_id (30d).
9. Remover o campo duplicado baseAtual (já existe totalUsers) e o banner "As secções ... usam dados de demonstração".
10. Badge "Dados reais" em todas as secções. Nenhum resquício do objeto DEMO no código.

CRITÉRIOS DE ACEITAÇÃO
- grep por "DEMO" e "demonstração" em src/ não devolve nada relacionado ao admin.
- Com o banco atual (poucos utilizadores, pagamentos recentes), o painel mostra números pequenos e verdadeiros, sem NaN/Infinity (proteger divisões por zero: mostrar "—").
- bun run build limpo.

NÃO FAZER
- Não inventar nenhum valor de fallback "bonito". Divisão por zero ou fonte vazia = "—" ou "indisponível".
- Não criar tabela marketing_spend nesta fase.
```

---

## A2 — Lista + detalhe de utilizadores (só leitura)

### Contexto e decisões
- Palco para as ações de A3/A4: primeiro ver, depois mexer. Nenhum botão de mutação nesta fase.
- Detalhe é **página cheia** (`users/$id.tsx`), não Sheet/drawer — o conteúdo por utilizador é
  grande demais.
- Só primitivas já existentes em `src/components/ui/` (table, pagination, input/command, badge,
  dropdown-menu, alert-dialog, sonner). **Nenhuma dependência nova.**

### Prompt para o Claude Code

```
Lê o CLAUDE.md. A0 e A1 concluídas.

FASE A2 — Lista e detalhe de utilizadores no admin, só leitura.

1. Criar src/lib/admin-users.functions.ts (createServerFn + requireSupabaseAuth + assertAdmin em todas):
   - listAdminUsers({ q, page, pageSize }): busca por nome/email em profiles, paginada; para CADA linha da página visível (em lote, nunca N+1): status de plano ativo (subscriptions vigente, incluindo provider para distinguir 'admin' de pago), saldo de créditos, flag suspenso (user_suspensions), created_at.
   - getAdminUserDetail(userId): perfil + histórico completo de subscriptions + payments + credit_balances/credit_transactions + resumo de ai_usage (chamadas, custo 30d) + roles + admin_actions onde target_user_id = userId.
2. Rota src/routes/_authenticated/admin/users/index.tsx (/admin/users): tabela pesquisável e paginada — nome, email, plano (badge; distinguir "Pro (admin)" de "Pro"), créditos, estado (Ativo/Suspenso), registo; clique na linha → detalhe.
3. Rota src/routes/_authenticated/admin/users/$id.tsx (/admin/users/:id): página cheia com tabs internas (tabs.tsx): Perfil | Plano & Pagamentos | Créditos | Uso de IA | Histórico admin. Zona de "Ações" visível mas com placeholders desativados ("disponível na próxima fase").
4. Ligar a tab "Utilizadores" do layout A0 a /admin/users.

CRITÉRIOS DE ACEITAÇÃO
- Busca por email e por nome funciona; paginação funciona com pageSize pequeno (testar com 2).
- Detalhe de um utilizador com pagamento real mostra o pagamento; utilizador sem plano mostra "Grátis".
- Conta não-admin é redirecionada em /admin/users e /admin/users/:id (guard do layout cobre as sub-rotas — confirmar).
- Nenhuma dependência nova no package.json. bun run build limpo.

NÃO FAZER
- Nenhuma mutação nesta fase.
- Não expor esta listagem a nenhum caminho não-admin.
```

---

## A3 — Conceder / ajustar / revogar plano e créditos

### Contexto e decisões
- Reutiliza **exatamente** a matemática do webhook PaySuite — extraída para função partilhada,
  nunca duplicada. Um só lugar para a fórmula `base = max(now, current_period_end) + period_days`.
- **`subscriptions` não tem unique constraint em `user_id`** (só `PRIMARY KEY (id)`, confirmado no
  schema ao vivo) — por desenho, cada checkout cria uma linha nova. `adminGrantPlan` **não** é um
  upsert por `ON CONFLICT`; a lógica é explícita: procurar a linha `status='active'` atual do
  utilizador e estendê-la, senão `INSERT` uma linha nova com `provider='admin'`, **sem** linha em
  `payments`, expira como plano normal (D4).
- `adminRevokePlan` incluído (D9): termina o período vigente agora. Sem reversão, conceder é
  meia-feature.
- Toda mutação: motivo obrigatório (zod `.min(3)`) → helper → `recordAdminAction`. Sem exceções.

### Prompt para o Claude Code

```
Lê o CLAUDE.md. A0–A2 concluídas.

FASE A3 — Ações admin de plano e créditos, com auditoria e confirmação.

1. src/lib/subscription.server.ts: extrair a matemática de extensão do webhook para computeExtendedPeriodEnd(currentPeriodEnd, periodDays) exportada; o webhook passa a usá-la (refactor mínimo, zero mudança de comportamento — comparar antes/depois). Adicionar:
   - adminGrantPlan(userId, plan, periodDays, actorId, reason): buscar a linha subscriptions com status='active' do utilizador (se existir) → UPDATE com computeExtendedPeriodEnd; senão → INSERT uma linha nova com status='active', provider='admin', current_period_end = now + periodDays. NUNCA insere em payments. NÃO é um ON CONFLICT — não há unique constraint em user_id.
   - adminRevokePlan(userId, actorId, reason): termina a subscription vigente (current_period_end = now, ou o padrão equivalente já usado para expirar). Deve funcionar tanto para planos 'admin' como pagos (caso de reembolso/abuso).
2. src/lib/credits.server.ts: adminAdjustCredits(userId, delta, actorId, reason):
   - delta > 0 → grantCredits(...) com reason 'admin_grant'.
   - delta < 0 → mesmo caminho atómico de debitCredits com feature 'admin_adjustment' (o CHECK(balance >= 0) do banco já impede negativo — devolver erro claro se rejeitado).
3. Criar src/lib/admin-actions.functions.ts com adminGrantPlanFn, adminRevokePlanFn, adminAdjustCreditsFn — cada uma: requireSupabaseAuth → assertAdmin → validação zod ({ userId: uuid, reason: string().min(3), ...params }) → helper de *.server.ts → recordAdminAction (action_type 'grant_plan'/'revoke_plan'/'adjust_credits', metadata com snapshot do alvo e parâmetros da ação).
4. UI em users/$id.tsx: ativar a zona de Ações — "Conceder plano" (select do plano + duração), "Revogar plano", "Ajustar créditos" (delta + preview do saldo resultante). TODAS via alert-dialog com campo de motivo obrigatório; toast (sonner) de sucesso/erro; refetch do detalhe após ação.
5. Badge "Pro (admin)" no detalhe e na lista quando provider = 'admin'.

CRITÉRIOS DE ACEITAÇÃO (testar manualmente em bun dev — mexe em fluxo de dinheiro)
- Conceder 30 dias a um utilizador grátis → hasActivePlan passa a true no app dele; NENHUMA linha nova em payments; receita do painel A1 inalterada.
- Conceder de novo antes de expirar → estende a partir do fim atual (max(now, end) + dias), não sobrepõe (UPDATE da linha ativa existente, não INSERT duplicado).
- Revogar → utilizador volta a grátis imediatamente.
- Ajuste de créditos: +10 e −5 refletem no saldo e geram credit_transactions com reasons corretos; tentar debitar abaixo de zero devolve erro claro e não altera saldo.
- Motivo vazio ou < 3 chars → rejeitado no servidor (não só no cliente).
- Cada ação gera exatamente UMA linha em admin_actions (verificar no SQL Editor).
- bun run build limpo.

NÃO FAZER
- Não duplicar a fórmula do webhook — extrair e partilhar.
- Não criar UI de gestão de roles de admin (decisão fechada: só SQL).
- Não tocar no fluxo do webhook além do refactor de extração.
- Não implementar adminGrantPlan como ON CONFLICT (user_id) — não existe essa constraint.
```

**Validar no Lovable:** conceder um plano promocional a uma conta de teste e confirmar no app
publicado que o plano funciona e que o painel de receita não mexeu.

---

## A4 — Suspender / reativar conta

### Contexto e decisões
- **Bloqueio primário:** `supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration })` —
  grava em `auth.users`, fora do alcance de RLS `public`; bloqueia novo login e refresh na origem.
- **Limite honesto (não esconder):** um access token já emitido vale até ao `exp` (verificação
  stateless em `auth-middleware.ts`, que é **gerado — nunca editar**). A janela residual é o TTL do
  token (tipicamente 1h). A forma de revogar sessões ativas na versão instalada de
  `@supabase/supabase-js` é **validada durante esta fase, não assumida**.
- **Fecho pragmático:** o abuso que custa dinheiro converge em
  `checkAndRecordUsage`/`requireUsageAllowed` (`access-control.server.ts`) — o hook de suspensão
  entra aí, com erro **distinto** (D7).
- **Proteções:** bloquear suspensão de si próprio e de contas com role admin. Ordem das escritas:
  Auth API primeiro, Postgres depois (evita "suspenso no banco mas ainda logável").
- Abuso **anónimo** fica fora do alcance desta mecânica (é por `user_id`) — registado no backlog,
  não resolver aqui.

### Prompt para o Claude Code

```
Lê o CLAUDE.md. A0–A3 concluídas.

FASE A4 — Suspensão e reativação de contas.

PASSO 0 — VALIDAÇÃO DE API (antes de codificar)
1. Confirmar na versão INSTALADA de @supabase/supabase-js a assinatura real de auth.admin.updateUserById com ban_duration (formato da duração, ex. "876000h" para indefinido prático).
2. Investigar se essa versão expõe revogação de sessões/refresh tokens por userId. Se existir de forma documentada e simples, usar após o ban; se não existir ou for ambígua, NÃO improvisar — deixar comentário no código explicando que a janela residual é o TTL do access token, e reportar o que foi encontrado.

IMPLEMENTAÇÃO
1. Criar src/lib/user-suspension.server.ts:
   - hasActiveSuspension(userId): existe linha em user_suspensions (via supabaseAdmin).
   - suspendUser(userId, actorId, reason): PRIMEIRO updateUserById com ban_duration; SÓ SE tiver sucesso, INSERT em user_suspensions (evita "suspenso no Postgres mas ainda logável"). Se o insert falhar depois do ban, reverter o ban e devolver erro.
   - reactivateUser(userId, actorId, reason): reverter o ban (ban_duration "none" ou o equivalente validado no Passo 0) + DELETE em user_suspensions.
2. Em src/lib/admin-actions.functions.ts: adminSuspendUserFn / adminReactivateUserFn — requireSupabaseAuth → assertAdmin → zod (motivo min 3) → PROTEÇÕES: rejeitar se targetId === actorId ("não podes suspender a tua própria conta") e rejeitar se o alvo tiver role admin em user_roles ("remover role via SQL primeiro") → helper → recordAdminAction ('suspend_user'/'reactivate_user').
3. Hook de bloqueio: em src/lib/access-control.server.ts, no topo de checkAndRecordUsage/requireUsageAllowed, se o userId autenticado tiver suspensão ativa → devolver erro com código distinto ACCOUNT_SUSPENDED e mensagem "A tua conta foi suspensa. Contacta cvflexivel@gmail.com." — NUNCA a mensagem genérica de limite.
4. Cliente: onde os erros dessas chamadas são tratados, mostrar a mensagem de suspensão como tal (toast/estado distinto do "atingiu o limite").
5. UI em users/$id.tsx: botão "Suspender conta" (alert-dialog destrutivo, motivo obrigatório) → "Reativar conta" conforme o estado; badge "Suspenso" no topo do detalhe e na lista. Dupla suspensão (suspender quem já está suspenso) devolve erro claro, não duplica.
6. NÃO tocar em auth-middleware.ts (gerado — seria sobrescrito pelo sync).

CRITÉRIOS DE ACEITAÇÃO (testar manualmente em bun dev com uma conta de teste)
- Suspender: a conta de teste não consegue fazer novo login; com sessão ainda válida, qualquer ação de IA/download devolve a mensagem de suspensão (não a de limite); CVs/dados intactos no banco.
- Reativar: login volta a funcionar; IA/download voltam ao normal; linha removida de user_suspensions.
- Suspender a própria conta → rejeitado. Suspender uma conta admin → rejeitado com a mensagem de remover role primeiro.
- Cada suspensão/reativação gera linha em admin_actions com motivo.
- bun run build limpo.

NÃO FAZER
- Não editar auth-middleware.ts.
- Não apagar/alterar dados do utilizador suspenso.
- Não improvisar chamadas de revogação de sessão não confirmadas no Passo 0.
```

**Validar no Lovable:** repetir suspensão + tentativa de uso com a conta de teste no ambiente
publicado (o comportamento do ban na Auth API só conta quando validado contra o projeto real).

---

## A5 — Visualizador de auditoria

### Contexto e decisões
- Os dados existem desde A0 e já têm linhas reais (A3/A4). Esta fase é só leitura + UI.
- Leitura exclusivamente via server function com `assertAdmin` — a tabela continua invisível a
  `authenticated`.

### Prompt para o Claude Code

```
Lê o CLAUDE.md. A0–A4 concluídas.

FASE A5 — Página /admin/auditoria.

1. Criar src/lib/admin-audit.functions.ts: listAdminActions({ page, pageSize, actionType?, targetUserId? }) — requireSupabaseAuth → assertAdmin → query paginada a admin_actions ordenada por created_at DESC, resolvendo nomes/emails atuais de actor e alvo quando as FKs não são nulas, e usando o snapshot do metadata quando são (conta apagada).
2. Rota src/routes/_authenticated/admin/auditoria.tsx: tabela (data, ator, ação com badge colorido por tipo, alvo, motivo, expandir metadata) + filtro por tipo de ação; paginação. Ligar a tab "Auditoria" do layout A0.
3. No detalhe do utilizador (users/$id.tsx), a tab "Histórico admin" reutiliza a mesma server function filtrada por targetUserId (se ainda não o faz).

CRITÉRIOS DE ACEITAÇÃO
- Todas as ações feitas em A3/A4 aparecem, com motivo legível.
- Filtro por tipo funciona; paginação funciona.
- Conta não-admin não acede (guard + assertAdmin).
- bun run build limpo.
```

---

## Backlog registado (NÃO construir nesta ronda)

- `marketing_spend` (input manual mensal) — só então reintroduzir CAC/LTV:CAC/Payback.
- Instrumentação server-side de "bateu no limite" para o funil (D8).
- Log persistido de webhooks PaySuite falhados (hoje: 500 sem rasto).
- Exportação CSV de utilizadores/pagamentos.
- Alerta automático de custo de IA anómalo por utilizador/dia (reaproveitar `sendTransactionalEmail`).
- Bloqueio de abusadores **anónimos** (fingerprint/IP) — a suspensão atual é só por `user_id`.
- Revogação imediata de sessões ativas, se a validação do Passo 0 da A4 concluir que não há API limpa na versão instalada.
- **Exclusão permanente (não é backlog):** impersonation e UI de gestão de roles admin — reabrir só com proposta escrita própria.

---

## Fases de execução (cada uma termina com `bun run build` + commit + checkbox marcado aqui)

- [x] **A0 — Fundamentos:** migrations, guard de rota, reorganização em sub-rotas, RPC de crédito.
- [x] **A1 — KPIs reais:** matar o objeto `DEMO`.
- [x] **A2 — Lista + detalhe de utilizadores (só leitura).**
- [ ] **A3 — Conceder/ajustar/revogar plano e créditos.**
- [ ] **A4 — Suspender/reativar conta.**
- [ ] **A5 — Visualizador de auditoria.**

---

## Checklist de fecho da ronda A0–A5

- [ ] `admin_actions` e `user_suspensions` criadas; UPDATE/DELETE em `admin_actions` falha mesmo com service_role (A0).
- [ ] Guard de rota redireciona não-admins antes de renderizar qualquer página `/admin/*` (A0).
- [ ] Zero resquícios de `DEMO`; nenhuma tile sem fonte real; CAC/LTV/Payback e "Favorável para investir" removidos; "Bateu no limite" marcado indisponível (A1).
- [ ] Lista pesquisável + detalhe completo por utilizador, distinguindo plano pago de plano `admin` (A2).
- [ ] Conceder/estender/revogar plano e ajustar créditos funcionam, sem linha em `payments`, com motivo obrigatório e auditoria 1:1 (A3).
- [ ] Suspensão bloqueia login e IA/download com mensagem própria; reativação restaura tudo; auto-suspensão e suspensão de admin rejeitadas (A4).
- [ ] `/admin/auditoria` mostra todas as ações com filtros (A5).
- [ ] Cada fase: `bun run build` limpo, migrations + tipos em commit separado, `supabase db pull` antes de tocar em schema.
- [ ] Pendências antigas que esta ronda **não** resolve e continuam abertas: logout na sidebar (não confirmado como bug real, verificar se necessário), rotas órfãs `/analise` e `/vagas` (confirmado: existem mas não estão em `NAV_ITEMS`), CRUD de `analyses`. Não deixar morrer.
