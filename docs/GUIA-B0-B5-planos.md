# Guia B0–B5 — Painel Admin: gestão de planos, promoções e pacotes de créditos

> **Aprovado em 14/07/2026**, após ronda de censura do especialista externo do dono sobre a
> proposta inicial (`docs/PROPOSTA-ADMIN-PLANOS-V1.md`, agora substituída — este documento é a
> fonte de verdade da execução). Guia de implementação para colar no Claude Code, uma fase de
> cada vez. Marque `[x]` em cada fase concluída **neste arquivo**.
>
> Regra de ouro desta ronda: **a ordem das fases não é negociável.** Schema (B0) antes de backend
> (B1); backend testado antes de UI (B2); só depois é que o fluxo de dinheiro passa a ler dados
> dinâmicos (B3); a página pública vem a seguir (B4); e a peça mais arriscada em custo (B5, bypass
> de fair-use) fica isolada no fim, sozinha.
> **Nenhum selo, contagem ou "ilimitado" que não corresponda a uma consequência mecânica real.**
> Countdown que não muda nada ao expirar = mentira na UI; "ilimitado" sem teto técnico = risco de
> custo aberto. As duas coisas estão proibidas por desenho neste guia.

---

## Prompt de Retomada (colar no início de toda sessão nova)

```text
Lê o arquivo docs/GUIA-B0-B5-planos.md inteiro antes de qualquer coisa. É o guia aprovado de
gestão de planos no painel admin (fases B0–B5). Verifica nos checkboxes da secção "Fases de
execução" qual foi a última fase concluída e reporta o estado — não implementes nada ainda.
Lembra-te das regras do CLAUDE.md: bun (nunca npm), supabase db pull + regenerar types antes de
qualquer trabalho de banco, bun run build antes de qualquer push, e a lição da Fase A3: toda
função SECURITY DEFINER precisa de REVOKE explícito na mesma migration (este guia, por desenho,
não cria nenhuma RPC nova — se surgir necessidade, aplicar o REVOKE desde o primeiro commit).
```

---

## Decisões fechadas (não reabrir durante a implementação)

| # | Decisão | Resolução |
|---|---|---|
| Q1 | "Ilimitado" literal | **Nunca sem teto.** Todo plano com bypass de fair-use mantém um teto técnico por hora, invisível na copy — armazenado **por plano** em `plan_prices.fair_use_hourly_cap` (editável no admin sem deploy), **não** em variável de ambiente (env var exige redeploy — contradiria o objetivo deste guia). Valor concreto por plano é decisão do dono/especialista antes de ligar em produção. |
| Q2 | Duração sub-diária | `period_minutes` é o novo campo canónico. `period_days` vira legado (mantido, nunca lido por código novo). O critério de backfill é **"o plano tem período próprio?"** — confirmado por auditoria de código na B0, não assumido por nome de plano. |
| Q3 | Edição afeta assinaturas ativas? | **Não — edição é prospetiva** (preço/duração/créditos já estão snapshotados em `subscriptions`/`payments`/`credit_balances`). **Exceção única e deliberada:** `bypasses_fair_use` e `fair_use_hourly_cap` são lidos por lookup vivo a cada request — funciona como **kill switch**: desligar a flag mata o bypass imediatamente para todos os assinantes ativos desse plano. Documentado no código, não descoberto em produção. |
| Q4 | Apagar plano | **Nunca `DELETE`.** "Remover" = `enabled = false`. O slug é referenciado historicamente em `subscriptions.plan`/`payments.plan`/`credit_balances.package_id`. |
| Q5 | Overrides finos por operação de IA | **Não construir nesta ronda.** "Mais créditos" = editar `credits`; assinatura já inclui tudo. Reabrir só com pedido explícito de plano parcial. |
| Q6 | Multi-moeda / cupões individuais / A/B | Fora de âmbito — backlog. |
| N1 | Período de graça vs. planos curtos | **`GRACE_DAYS` nunca se aplica a planos sub-diários** (`period_minutes < 1440` expira no minuto exato do fim do período). Sem esta regra, um "ilimitado 12h" viraria 12h + N dias de graça com bypass ativo — o pior lugar possível para tolerância. Todos os usos de `GRACE_DAYS` são auditados na B1 antes de qualquer mudança. |
| N2 | Promoção com consequência real | Novo campo `promo_price_mzn` (nullable). **Preço efetivo** = promo se `promo_ends_at` no futuro, senão preço base — calculado por **uma única função no servidor**, usada pelo checkout e pelo `/planos`. O countdown passa a ser verdade mecânica: quando expira, o preço volta sozinho ao normal, sem memória humana. `/planos` mostra preço base riscado + preço promo. |
| N3 | Campos públicos | `getPlanPrices()` (usado pela página pública) passa a devolver **allowlist explícita** de campos. `bypasses_fair_use`, `fair_use_hourly_cap` e `enabled` de planos arquivados nunca chegam ao browser de um visitante. |
| N4 | Lembretes de expiração | Planos com `period_minutes < 1440` são **excluídos** de `plan-reminders` — "o teu plano expira em 0 dias" no minuto da compra é absurdo. Confirmado: `plan-reminders.server.ts` hoje calcula um `soonCutoff` de 3 dias fixos e escreve sempre "expira em X dias" na copy do e-mail — um plano de 12h cairia nesse cutoff de imediato e geraria um e-mail sem sentido. |
| N5 | Slug e `kind` imutáveis após criação | Mudar a natureza de um plano a meio da vida = criar plano novo. `updateAdminPlanFn` rejeita ambos. |

---

## Porquê esta ordem

| Fase | O quê | Porque nesta posição |
|---|---|---|
| B0 | Schema: duração flexível, tipo, promoção (com preço promocional), teto por plano | Fundação — nada do resto compila sem os campos. Migração aditiva, zero mudança de comportamento. |
| B1 | Backend de CRUD + generalização para minutos + regra de graça + preço efetivo | Escrita antes de UI; a generalização de `computeExtendedPeriodEnd` e a auditoria de `GRACE_DAYS`/validade de créditos são pré-requisitos de qualquer plano sub-diário. |
| B2 | UI `/admin/planos` | Só depois de o backend existir e estar testado a frio. |
| B3 | Checkout + webhook + concessão manual leem `plan_prices` dinamicamente (com preço efetivo) | Mexe em fluxo de dinheiro — vem depois do CRUD validado, nunca em paralelo. |
| B4 | `/planos` dinâmica + selo/countdown + preço riscado + tempo restante sub-diário na UI do utilizador | Só faz sentido com dados dinâmicos reais por trás. |
| B5 | Bypass de fair-use + teto horário por plano | A peça mais arriscada (Q1) — isolada por último, mesmo padrão da A4: testada a fundo antes do push. |

**Fluxo por fase (igual ao habitual):** implementar → `bun dev` (BD real) → `bun run build` →
commit da fase → push `main` → validar no Lovable. Migrations + tipos regenerados em **commit
separado** do código. Antes de qualquer fase que toque schema: `supabase db pull` (ou o workaround
sem Docker do projeto) + regenerar `types.ts` conforme o CLAUDE.md — se o pull falhar por
link/login, PARAR e avisar.

---

## B0 — Schema: duração flexível, tipo de plano, promoção com preço, teto por plano

### Contexto e decisões
- Migração **aditiva**, nunca destrutiva: `period_days`, `credits`, `label`, `enabled` continuam a
  existir e a ser lidos pelo código atual até a B1/B3 migrarem os leitores.
- Novos campos além dos da proposta original: `promo_price_mzn NUMERIC` (N2) e
  `fair_use_hourly_cap INT` (Q1). Nascem aqui para não haver segunda migration de schema.
- O backfill de `period_minutes` segue o **critério real do código** (auditado no Passo 0), não o
  nome do plano: planos cujo `period_days` alimenta a duração de assinatura OU a validade de
  créditos recebem `period_days * 1440`; planos sem período próprio ficam `NULL`.
- `kind` substitui as duas inferências frágeis atuais (`credits IS NULL` e o string-check do
  webhook).
- `id UUID UNIQUE` como chave técnica de edição (a `PRIMARY KEY (plan)` fica intocada — zero
  migração de FK).
- Estender o `CHECK` de `admin_actions.action_type` com `'create_plan'`, `'update_plan'`,
  `'archive_plan'` (nome real da constraint confirmado no banco antes do `DROP`).

### Prompt para o Claude Code

```
Lê o CLAUDE.md e cumpre as regras invioláveis (Bun, rotas só em src/routes/, nunca tocar em
vite.config.ts, fluxo de banco obrigatório).

FASE B0 — Schema de planos: duração flexível, tipo, promoção com preço, teto por plano.

PASSO 0 — SINCRONIZAÇÃO E AUDITORIA (antes de qualquer código)
1. supabase db pull + regenerar types.ts (Out-File -Encoding utf8 no PowerShell, nunca `>`). Se
   falhar por link/login, PARAR e avisar.
2. Confirmar no banco o nome real da constraint de admin_actions.action_type.
3. AUDITORIA DE LEITORES DE period_days — mapear e reportar-me ANTES da migration:
   a) Todos os pontos que leem plan_prices.period_days (assinatura E validade de créditos —
      incluir o caminho do webhook que define credit_balances.expires_at).
   b) Todos os usos de GRACE_DAYS (onde a graça é somada e o que ela afeta).
   c) O que plan-reminders.server.ts lê para decidir lembretes.
   Este mapa decide o backfill correto de period_minutes (que planos têm período próprio) e é
   pré-requisito da B1. NÃO prosseguir para a migration sem apresentar o mapa ao dono.
4. Ler src/lib/subscription.server.ts, subscription.functions.ts, routes/planos.tsx e
   routes/api/paysuite-webhook.ts inteiros.

MIGRATION (uma migration, commit separado, tipos regenerados depois)
1. ALTER TABLE plan_prices:
   - ADD COLUMN id UUID NOT NULL DEFAULT gen_random_uuid(), CONSTRAINT plan_prices_id_key UNIQUE (id);
   - ADD COLUMN period_minutes INT; backfill segundo o mapa do Passo 0.3 (period_days * 1440 para
     planos com período próprio; NULL para os restantes);
   - ADD COLUMN kind TEXT; backfill 'subscription_unlimited' (mensal/trimestral) e 'credit_pack'
     (avulso/recarga); depois SET NOT NULL + CHECK (kind IN ('subscription_unlimited','credit_pack'));
   - ADD COLUMN bypasses_fair_use BOOLEAN NOT NULL DEFAULT false;
   - ADD COLUMN fair_use_hourly_cap INT; -- teto por hora, só relevante quando bypasses_fair_use
   - ADD COLUMN is_promotional BOOLEAN NOT NULL DEFAULT false, promo_badge_text TEXT,
     promo_ends_at TIMESTAMPTZ, promo_price_mzn NUMERIC; -- promo com preço efetivo real (N2)
   - ADD COLUMN features JSONB NOT NULL DEFAULT '[]'::jsonb;
   - ADD COLUMN display_order INT NOT NULL DEFAULT 0,
     visible_on_pricing_page BOOLEAN NOT NULL DEFAULT true.
2. UPDATE recarga: visible_on_pricing_page=false, display_order=99 (preserva o comportamento
   atual de nunca aparecer em /planos).
3. Backfill display_order dos 3 planos visíveis (avulso=1, mensal=2, trimestral=3) para a ordem
   atual de /planos não mudar no dia do deploy.
4. Alargar o CHECK de admin_actions.action_type (nome real do Passo 0.2) com 'create_plan',
   'update_plan', 'archive_plan'.
5. NÃO tocar em period_days, credits, label, enabled.

CRITÉRIOS DE ACEITAÇÃO
- bun run build limpo; checkout, webhook, /planos e o GrantPlanDialog continuam a funcionar sem
  NENHUMA mudança de comportamento (fase só de schema).
- SELECT * FROM plan_prices mostra os 4 planos com kind, period_minutes, display_order e
  visible_on_pricing_page coerentes com o mapa do Passo 0.3.
- Migration + types.ts em commit próprio.

NÃO FAZER
- Não remover nenhuma coluna existente.
- Não escrever código de aplicação nesta fase.
- Não criar nenhuma função SECURITY DEFINER.
```

---

## B1 — Backend: CRUD de planos, minutos como unidade, graça, preço efetivo

### Contexto e decisões
- `computeExtendedPeriodEnd(currentPeriodEndIso, periodMinutes)` — mudança de unidade, não de
  lógica (`base + periodMinutes * 60_000`). Todos os chamadores atualizados no mesmo commit.
- **Regra de graça (N1):** com o mapa da B0 em mãos, `GRACE_DAYS` passa a aplicar-se **só** quando
  o plano ativo tem `period_minutes >= 1440`. Planos sub-diários expiram no minuto exato.
- **Achado do Passo 0 (auditoria B0):** `getGraceDays()` existe **duplicada**, sem partilha de
  código, em `subscription.server.ts:9-12` (usada por `expireDuePlans`/`hasActivePlan`) e em
  `admin-users.functions.ts:11-14` (usada por `pickActivePlan`) — são 3 call-sites em 2 ficheiros
  que precisam da regra N1, não 1. **Decisão do dono (14/07/2026): manter as duas cópias
  independentes** (não deduplicar nesta ronda) — aplicar a regra N1 em cada uma separadamente.
  Também confirmado que `avulso` (não só mensal/trimestral) tem período próprio — alimenta a
  validade dos créditos no webhook (`paysuite-webhook.ts:90-109`, único ponto que lê
  `plan_prices.period_days` ao vivo, não por snapshot); `recarga` não tem (`period_days` já é
  `NULL` na tabela).
- **Preço efetivo (N2):** `getEffectivePlanPrice(planRow)` — função única, exportada de
  `subscription.server.ts`: devolve `promo_price_mzn` se `is_promotional && promo_ends_at > now()`,
  senão `price_mzn`. É a ÚNICA fonte de preço para checkout (B3) e para `/planos` (B4).
- `getActivePlanTimeLeft(userId)` devolve minutos restantes; `getActivePlanDaysLeft` mantido por
  compatibilidade como `floor(timeLeft / 1440)` — sem duplicar query.
- **Validade de créditos:** se o mapa da B0 mostrar que o caminho do webhook/`grantCredits` deriva
  `expires_at` de `period_days`, esse caminho migra para `period_minutes` AQUI (um só calendário
  canónico no sistema). Se mostrar que não deriva, deixar comentário no código a explicar porquê.
- **Lembretes (N4):** planos com `period_minutes < 1440` excluídos de `plan-reminders`.
- CRUD nunca faz `DELETE`; toda mutação: `assertAdmin` → zod → helper → `recordAdminAction` com
  motivo obrigatório (`target_user_id = NULL`, alvo no `metadata` como `{ planId, planKey }`).
- Validações de negócio no servidor: slug `^[a-z0-9_]+$` imutável; `kind` imutável (N5);
  `promo_price_mzn` obrigatório e `> 0` e `< price_mzn` quando `is_promotional=true` (promo mais
  cara que o normal = erro); `fair_use_hourly_cap` obrigatório e `> 0` quando
  `bypasses_fair_use=true` (a flag nunca pode existir sem teto — Q1 imposta pelo schema de
  validação, não por disciplina).

### Prompt para o Claude Code

```
Lê o CLAUDE.md. B0 concluída (schema alargado, mapa de leitores de period_days/GRACE_DAYS em mãos).

FASE B1 — CRUD de planos no backend + generalização de duração + graça + preço efetivo.

1. src/lib/subscription.server.ts:
   - computeExtendedPeriodEnd passa a receber periodMinutes (base + periodMinutes * 60_000);
     atualizar os chamadores existentes (webhook, adminGrantPlan) no mesmo commit.
   - REGRA DE GRAÇA (decisão N1 fechada): GRACE_DAYS só se aplica quando o plano da assinatura
     ativa tem period_minutes >= 1440. Sub-diário expira no minuto exato. Aplicar em TODOS os
     pontos do mapa da B0 que somam graça; comentar a regra no código.
   - getEffectivePlanPrice(planRow): promo_price_mzn se is_promotional && promo_ends_at no
     futuro, senão price_mzn. Exportada — será a única fonte de preço do checkout (B3) e do
     /planos (B4).
   - getActivePlanTimeLeft(userId): minutos restantes (number | null). getActivePlanDaysLeft
     mantido, reimplementado sobre a mesma query (floor(min/1440)).
   - adminGrantPlan(userId, planKey, actorId, reason): busca a linha em plan_prices (existe +
     enabled=true + kind='subscription_unlimited', senão erro "plano não encontrado ou
     desativado"); usa period_minutes. Continua sem inserir em payments (D4 da ronda A).
2. Validade de créditos: conforme o mapa da B0 — se o caminho webhook/grantCredits deriva
   expires_at de period_days, migrar para period_minutes aqui; senão, comentário explicando.
3. plan-reminders.server.ts: excluir planos com period_minutes < 1440 (N4).
4. Criar src/lib/admin-plans.functions.ts (createServerFn, requireSupabaseAuth + assertAdmin em
   todas, padrão do projeto):
   - listAdminPlans(): todos os planos (incl. desativados), por display_order.
   - createAdminPlanFn({...todos os campos, reason}): zod completo — slug ^[a-z0-9_]+$; reason
     min 3; SE is_promotional: promo_price_mzn obrigatório, > 0 e < price_mzn; SE
     bypasses_fair_use: fair_use_hourly_cap obrigatório e > 0 (a flag NUNCA existe sem teto);
     kind='credit_pack' exige credits > 0; kind='subscription_unlimited' exige
     period_minutes > 0 → INSERT enabled=true → recordAdminAction('create_plan').
   - updateAdminPlanFn({ id, ...campos, reason }): slug e kind IMUTÁVEIS (rejeitar tentativas);
     mesmas validações condicionais → UPDATE by id → recordAdminAction('update_plan').
   - archiveAdminPlanFn({ id, reason }): enabled=false, visible_on_pricing_page=false →
     recordAdminAction('archive_plan'). NUNCA DELETE.
   - reactivateAdminPlanFn({ id, reason }): enabled=true (visible_on_pricing_page NÃO volta
     automaticamente — decisão separada do admin).
5. Erro amigável em slug duplicado (capturar violação de PK).

CRITÉRIOS DE ACEITAÇÃO (script Bun temporário contra BD real, apagado depois — padrão A3/A4)
- Criar "ilimitado_12h" (subscription_unlimited, periodMinutes=720, bypassesFairUse=true,
  fairUseHourlyCap=um valor de teste) → aparece em listAdminPlans.
- Criar plano com bypassesFairUse=true SEM cap → rejeitado no servidor.
- Criar plano promocional com promo_price_mzn >= price_mzn → rejeitado.
- Editar preço de um plano → assinatura concedida ANTES da edição mantém current_period_end
  original (Q3 — prospetivo).
- Arquivar → adminGrantPlan contra o plano falha com "plano não encontrado ou desativado".
- computeExtendedPeriodEnd(720) estende exatamente 12h a partir de max(now, current_period_end).
- Com um plano de teste sub-diário expirado há minutos: hasActivePlan devolve false JÁ (sem
  graça); com um plano mensal expirado há menos de GRACE_DAYS: comportamento atual inalterado.
- getEffectivePlanPrice devolve promo antes de promo_ends_at e o preço base 1 minuto depois
  (testar com promo_ends_at próximo).
- Cada mutação gera exatamente 1 linha em admin_actions com motivo.
- bun run build limpo.

NÃO FAZER
- Não implementar UI nesta fase.
- Nenhum DELETE em plan_prices em nenhum caminho.
- Não permitir mudar slug/kind via update.
- Não criar função SECURITY DEFINER — toda escrita via supabaseAdmin em createServerFn.
- Não tocar em access-control.server.ts (isso é a B5).
```

---

## B2 — UI admin `/admin/planos`

### Contexto e decisões
- Nova sub-rota + tab "Planos" no layout do admin (Visão geral | Utilizadores | Auditoria |
  **Planos**).
- Só primitivas existentes de `src/components/ui/` — nenhuma dependência nova.
- Seletor de duração humano: `<Select>` de unidade (Horas / Dias / Semanas / Meses) + valor
  numérico — convertido para `period_minutes` no submit ("3 meses" = 90 × 1440, mesma convenção
  do `trimestral`).
- Formulário condicionado ao `kind`: `subscription_unlimited` esconde `credits`; `credit_pack`
  esconde `bypasses_fair_use`/cap. `is_promotional` ligado revela texto do selo +
  `promo_price_mzn` + data/hora de fim. `bypasses_fair_use` ligado revela o campo do teto por hora
  com aviso "só para promoções de curta duração — o teto é obrigatório e invisível ao utilizador".

### Prompt para o Claude Code

```
Lê o CLAUDE.md. B0–B1 concluídas.

FASE B2 — UI /admin/planos.

1. Rota src/routes/_authenticated/admin/planos/index.tsx: tabela (listAdminPlans) — label, kind
   (badge), preço (mostrar promo com preço base riscado quando promoção vigente), duração
   formatada ("12h", "30 dias", "90 dias"), créditos (ou "—"), promocional (badge + tempo
   restante se vigente), visível em /planos, ativo/inativo, ordem. "Novo plano" e clique na linha
   abrem o mesmo formulário (dialog/sheet) em modo criar/editar; arquivar/reativar por linha via
   alert-dialog com motivo obrigatório.
2. Formulário partilhado criar/editar:
   - identificador (slug, só no criar, regex validada cliente E servidor), label, tipo (imutável
     no editar), preço MZN, duração (valor+unidade), créditos (se credit_pack), features
     (textarea, uma linha por bullet — array JSON), ordem, visível em /planos (switch),
     promocional (switch — texto do selo + promo_price_mzn + datetime-local de fim), bypassa
     fair-use (switch, só em assinatura — campo obrigatório de teto por hora + aviso).
   - Motivo obrigatório (mesma UX das dialogs A3/A4). Toast sonner; refetch após ação.
3. Ligar a tab "Planos" em admin/route.tsx.

CRITÉRIOS DE ACEITAÇÃO
- Criar, editar, arquivar e reativar pela UI com refetch imediato.
- Ligar "promocional" sem preço promo, ou "bypass" sem teto → bloqueado no cliente E rejeitado
  no servidor (testar contornando o cliente).
- Campos escondem/mostram corretamente conforme o tipo.
- Não-admin redirecionado em /admin/planos (guard do layout).
- Nenhuma dependência nova. bun run build limpo.

NÃO FAZER
- Nesta fase o CRUD ainda não afeta /planos nem checkout (B3/B4) — gestão de dados isolada.
```

---

## B3 — Checkout, webhook e concessão manual leem `plan_prices` dinamicamente

### Contexto e decisões
- A fase que **mexe em dinheiro** — mesmo cuidado da A3: testar em `bun dev` com dados reais antes
  do push, validar no Lovable antes da B4.
- Validação de plano em **runtime** contra `plan_prices` (existe + `enabled` + `kind` compatível
  com o endpoint), substituindo o union estático e o `z.enum`.
- **O checkout usa `getEffectivePlanPrice` no servidor** — o preço nunca vem do cliente, e a
  promoção expira mecanicamente (N2).
- Snapshot `payments.plan_kind` gravado na criação do checkout; webhook decide por ele, com
  fallback ao string-check antigo só para linhas com `plan_kind` null (pagamentos pendentes
  anteriores ao deploy — comentado no código).
- `GrantPlanDialog` passa a listar planos de `plan_prices` (subscription_unlimited + enabled),
  período pré-preenchido do plano com override manual opcional (mantém a flexibilidade atual).

### Prompt para o Claude Code

```
Lê o CLAUDE.md. B0–B2 concluídas.

FASE B3 — Checkout, webhook e concessão manual data-driven.

MIGRATION
1. ALTER TABLE payments ADD COLUMN plan_kind TEXT (nullable para linhas antigas; preenchido daqui
   para a frente). Commit separado + tipos.

CÓDIGO
1. src/lib/subscription.functions.ts:
   - createSubscriptionCheckout: validar plan como string existente em plan_prices
     (kind='subscription_unlimited', enabled=true; senão "plano indisponível"); o valor cobrado
     vem de getEffectivePlanPrice(planRow) — NUNCA do cliente. Gravar payments.plan_kind.
   - createCreditCheckout: idem para kind='credit_pack'.
2. src/routes/api/paysuite-webhook.ts: substituir a condição hardcoded por
   payment.plan_kind === 'credit_pack'; fallback ao string-check antigo APENAS quando plan_kind é
   null (linhas anteriores a esta fase) — comentar o porquê e a data.
3. src/routes/_authenticated/admin/users/$id.tsx: GrantPlanDialog usa listAdminPlans()
   (subscription_unlimited + enabled), período pré-preenchido do plano, override manual opcional.
4. Remover SUBSCRIPTION_PLANS e o z.enum antigo (grep antes de apagar — nada mais pode importá-los).

CRITÉRIOS DE ACEITAÇÃO (bun dev com dados reais)
- Checkout de assinatura e de pacote de créditos idênticos ao comportamento atual para os 4
  planos existentes (regressão zero).
- Plano novo criado em /admin/planos completa um checkout de teste SEM alteração de código.
- Plano promocional vigente cobra o preço promo; o MESMO plano com promo_ends_at no passado cobra
  o preço base (testar os dois lados da fronteira).
- Editar o preço de um plano com um pagamento PENDENTE em trânsito: o webhook conclui com o valor
  do snapshot em payments, não com o preço novo (Q3 na prática).
- Webhook processa pagamentos antigos (plan_kind null) e novos — testar os dois caminhos.
- GrantPlanDialog lista planos vindos de plan_prices, incluindo um criado na B2.
- bun run build limpo.

NÃO FAZER
- Não mudar computeExtendedPeriodEnd (feito na B1).
- Não tocar em access-control.server.ts (B5).
- Preço nunca aceite do cliente em nenhum endpoint.
```

**Validar no Lovable (obrigatório antes da B4):** um checkout de teste real no ambiente publicado
— esta fase mexe no caminho de pagamento em produção.

---

## B4 — `/planos` dinâmica: cards data-driven, promo com preço riscado, countdown honesto, tempo restante sub-diário

### Contexto e decisões
- Os blocos `<PlanCard>` manuais viram `.map()` sobre `getPlanPrices()` filtrado a
  `visible_on_pricing_page && enabled`, ordenado por `display_order`.
- **N3:** `getPlanPrices()` passa a devolver allowlist explícita de campos públicos (label, preço
  base, preço efetivo/promo, duração, créditos, features, selo, `promo_ends_at`, ordem).
  `bypasses_fair_use` e `fair_use_hourly_cap` **nunca** chegam ao browser público.
- Promoção vigente: preço base riscado + preço promo (via `getEffectivePlanPrice` no servidor) +
  selo + countdown. Ao expirar, o countdown esconde o selo client-side E o preço efetivo volta
  sozinho ao base — as duas coisas em sincronia porque bebem da mesma função.
- **Countdown atrás de um guard client-side**, montado só depois da hidratação (`useEffect` com um
  `useState` de "já montei", o padrão React habitual para evitar mismatch de SSR em conteúdo
  dependente do relógio — o `RichTextField.tsx` já evita um problema parecido de SSR/hidratação no
  editor TipTap via `immediatelyRender: false`, mas esse é um mecanismo específico do TipTap, não
  o mesmo padrão; aqui o guard é o genérico de React). `setInterval` de 1 minuto chega.
- `features` renderizadas como **texto React puro** — `dangerouslySetInnerHTML` proibido neste
  caminho (conteúdo editável por admin numa página pública).
- **Tempo restante sub-diário na UI do utilizador:** onde hoje se mostra "X dias restantes"
  (sidebar/indicador de plano), usar `getActivePlanTimeLeft` — "X dias" quando ≥ 1440 min, senão
  "Xh Ym". Um comprador do plano de 12h nunca pode ver "0 dias restantes".

### Prompt para o Claude Code

```
Lê o CLAUDE.md. B0–B3 concluídas.

FASE B4 — /planos dinâmica + promoção honesta + tempo restante sub-diário.

1. getPlanPrices() (server): allowlist explícita de campos públicos — label, price_mzn, preço
   efetivo (getEffectivePlanPrice), promo_badge_text, promo_ends_at, period_minutes, credits,
   features, display_order, kind. NUNCA devolver bypasses_fair_use, fair_use_hourly_cap, nem
   planos enabled=false ou visible_on_pricing_page=false.
2. src/routes/planos.tsx: substituir os blocos <PlanCard> hardcoded por .map() sobre
   getPlanPrices(), ordenado por display_order. Features vêm do array (texto puro — PROIBIDO
   dangerouslySetInnerHTML). Confirmar visualmente que os 3 planos atuais ficam iguais ao layout
   de hoje.
3. PlanCard: quando há promoção vigente → preço base riscado + preço efetivo em destaque + selo +
   countdown ("Termina em 3h 42min"; dias/horas se > 48h). Countdown montado só client-side (guard
   de "já montei" pós-hidratação, setInterval de 1 min); ao expirar, selo e preço riscado
   desaparecem sem reload.
4. Tempo restante do plano na UI do utilizador (sidebar/indicador onde hoje aparece em dias):
   usar getActivePlanTimeLeft — formatar "X dias" se >= 1440 min, senão "Xh Ym".
5. Teste ao vivo em bun dev: plano promocional com promo_ends_at daqui a 2 minutos — confirmar
   que selo E preço promo desaparecem sozinhos ao expirar, sem warnings de hydration na consola.

CRITÉRIOS DE ACEITAÇÃO
- /planos visualmente idêntica para os 3 planos atuais.
- Plano novo criado no admin aparece em /planos na posição certa, sem deploy.
- Promoção: preço riscado + countdown, e o preço cobrado no checkout (B3) coincide SEMPRE com o
  preço mostrado (mesma função de preço efetivo dos dois lados).
- Nenhum campo sensível (bypass/cap) no payload de rede da página pública (verificar no network
  tab do browser).
- Utilizador com plano de 12h vê "11h 32min restantes", nunca "0 dias".
- bun run build limpo, zero warnings de hydration.

NÃO FAZER
- Não mudar ordem/preço dos planos existentes sem confirmação visual antes do commit.
- Não renderizar features com HTML.
```

---

## B5 — Bypass de fair-use com teto por plano (a fase mais delicada)

### Contexto e decisões
- Aditivo a `checkAndRecordUsage` — a lógica existente para planos normais fica intocada. O ramo
  novo só entra quando a assinatura ativa aponta para um plano com `bypasses_fair_use=true`.
- **O teto vem da coluna do plano (`fair_use_hourly_cap`), não de env var** — ajustável no admin
  sem deploy, por plano. A B1 já garantiu por validação que a flag nunca existe sem teto.
- **Exceção Q3/N3 documentada no código:** este lookup é vivo de propósito — desligar
  `bypasses_fair_use` no admin mata o bypass imediatamente para todos os assinantes ativos (kill
  switch de abuso).
- Erro ao atingir o teto: o **mesmo** `LimitReachedError` existente, mensagem genérica ("Muitas
  operações num curto espaço de tempo, tenta novamente daqui a pouco") — nunca expor o número,
  nunca criar tipo de erro novo (um erro distinto denunciaria a existência e o valor do teto).
- `ai-cost-alert.server.ts`: confirmar (sem alterar) que o alerta de custo agrega por
  `ai_usage.cost_usd` independentemente do plano — cobre picos vindos deste tipo de plano por
  construção.
- A calibração do valor do teto por plano é **decisão do dono/especialista** feita no formulário do
  admin antes de pôr o plano à venda — não é escolha do implementador.

### Prompt para o Claude Code

```
Lê o CLAUDE.md. B0–B4 concluídas. O teto horário de cada plano com bypass vem da coluna
plan_prices.fair_use_hourly_cap (obrigatória quando a flag está ligada — validado desde a B1).

FASE B5 — Bypass de fair-use para planos promocionais + teto horário por plano.

1. src/lib/access-control.server.ts, em checkAndRecordUsage: depois de confirmar plano ativo
   (isPremium), obter a linha de plan_prices do plano da assinatura ativa (join por
   subscriptions.plan). Se bypasses_fair_use=true:
   - Saltar os tectos max_per_day/max_per_month do tier premium.
   - Aplicar o teto horário do plano: contar linhas de ai_usage da última 1h para o userId;
     se >= fair_use_hourly_cap, devolver o MESMO LimitReachedError existente com mensagem
     genérica "Muitas operações num curto espaço de tempo, tenta novamente daqui a pouco" —
     nunca expor o número, nunca criar erro novo.
   - Comentário obrigatório no código: este lookup é VIVO de propósito (exceção documentada à
     regra de edição prospetiva) — desligar a flag no admin corta o bypass imediatamente para
     todos os assinantes ativos (kill switch de abuso).
2. Confirmar, sem alterar, que ai-cost-alert.server.ts agrega custo por ai_usage.cost_usd sem
   filtrar por plano (cobre picos deste tipo de plano por construção) — reportar a confirmação.
3. Zero mudança de copy nos ecrãs do utilizador — o teto é invisível (nunca em /planos, nunca no
   card do plano, nunca em mensagens com o valor).

CRITÉRIOS DE ACEITAÇÃO (script Bun temporário contra BD real, padrão A4; conta de QA)
- Conceder o plano "ilimitado_12h" (com cap de teste BAIXO, ex. 5) a uma conta de QA: os tectos
  diários/mensais do premium NÃO se aplicam; a 6ª operação dentro de 1h é barrada com a mensagem
  genérica.
- Desligar bypasses_fair_use no admin com a conta de QA ainda ativa: a operação seguinte volta a
  estar sujeita aos tectos normais do premium (kill switch confirmado ao vivo).
- Premium normal (sem bypass): regressão zero nos tectos de sempre.
- Passadas as 12h (ou com current_period_end forçado no passado via SQL de teste): hasActivePlan
  false imediatamente — sem graça (regra N1 da B1 confirmada de ponta a ponta com o bypass).
- bun run build limpo.

NÃO FAZER
- Não remover TODOS os limites em nenhum caminho — bypass sem teto não pode existir (Q1).
- Não expor o valor do teto em erros, logs de cliente ou documentação pública.
- Não alterar ai-cost-alert.server.ts.
- Não criar tipo de erro novo para o teto horário.
```

**Validar no Lovable:** conceder um "ilimitado 12h" real (com cap de produção decidido pelo dono)
a uma conta de teste: gerar CVs/cartas/entrevistas repetidamente sem bater nos tectos normais,
forçar deliberadamente o teto horário e confirmar a mensagem genérica, e confirmar a expiração
exata às 12h sem graça.

---

## Backlog registado (NÃO construir nesta ronda)

- Overrides finos por operação de IA por plano (Q5) — só com pedido explícito de plano parcial.
- Remoção definitiva de `plan_prices.period_days` depois de confirmado que nenhum código o lê.
- Cupões/códigos individuais por utilizador (distinto de "plano em promoção para todos").
- Multi-moeda / preços por região; testes A/B de preço; afiliados/referral; desconto de fidelidade.
- Relatório de conversão por promoção (compras durante a janela) — liga ao backlog PostHog da
  ronda A.
- Agendamento de promoções (início futuro automático) — hoje a promo começa quando o admin grava.

---

## Fases de execução (cada uma termina com `bun run build` + commit + checkbox marcado aqui)

- [x] **B0 — Schema:** `period_minutes`, `kind`, promoção com `promo_price_mzn`,
      `fair_use_hourly_cap`, `display_order`/`visible_on_pricing_page` + mapa de leitores de
      `period_days`/`GRACE_DAYS`.
- [x] **B1 — Backend de CRUD** + minutos como unidade + regra de graça (N1) +
      `getEffectivePlanPrice` (N2) + exclusão de lembretes sub-diários (N4).
- [ ] **B2 — UI `/admin/planos`** (criar/editar/arquivar/reativar, validações condicionais).
- [ ] **B3 — Checkout + webhook + concessão manual** dinâmicos, preço efetivo no servidor,
      snapshot `plan_kind`.
- [ ] **B4 — `/planos` dinâmica** + preço riscado + countdown honesto + tempo restante sub-diário
      + allowlist pública (N3).
- [ ] **B5 — Bypass de fair-use** com teto por plano + kill switch vivo documentado.

## Checklist de fecho da ronda B0–B5

- [ ] Nenhum dos 5 pontos hardcoded do diagnóstico continua no código (`SUBSCRIPTION_PLANS`, enum
      de créditos, `PLAN_OPTIONS`, cards JSX fixos, branch de string no webhook).
- [ ] Criar, editar, arquivar e reativar planos de ponta a ponta pela UI, sem deploy nem SQL
      manual.
- [ ] Um "ilimitado 12h" pode ser criado, vendido/concedido e usado sem os tectos normais — mas
      com teto horário invisível obrigatório (Q1) e **sem período de graça** (N1).
- [ ] O preço cobrado no checkout coincide sempre com o preço mostrado em `/planos`, incluindo
      antes/depois de `promo_ends_at` (N2 — countdown com consequência real).
- [ ] Edição/arquivamento nunca retroage sobre assinaturas/pagamentos existentes (Q3), com a única
      exceção documentada do kill switch de bypass.
- [ ] Nenhum `DELETE` em `plan_prices` em nenhum fluxo (Q4).
- [ ] Nenhum campo sensível (`bypasses_fair_use`, teto) exposto no payload público de `/planos`
      (N3).
- [ ] Cada criação/edição/arquivamento/concessão gera exatamente 1 linha em `admin_actions`.
- [ ] `bun run build` limpo em cada fase; migrations + tipos em commit próprio; `supabase db pull`
      antes de qualquer fase de schema.
- [ ] Validado no Lovable (não só `bun dev`): checkout real (B3) e ciclo completo do "ilimitado
      12h" com teto e expiração exata (B5) — as duas fases que mexem em dinheiro/custo real.
