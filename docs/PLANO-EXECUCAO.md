# Plano de Execução — Monetização do CV Flexível

> **Aprovado em 09/07/2026.** Este documento é a fonte de verdade do plano de monetização.
> Como usar: no início de cada sessão nova do Claude Code, cole o **Prompt de Retomada** (secção 2).
> Depois cole o prompt da próxima fase pendente. Marque `[x]` em cada fase concluída **neste arquivo**.

---

## 1. Contexto e decisões aprovadas

### 1.1 Diagnóstico (estado em 09/07/2026)

- O app funciona (editor de CV, cartas com IA, análise de vagas, preparação de entrevistas, export DOCX) mas **não gera receita nenhuma**.
- As server functions de IA (`src/lib/llm.functions.ts`) **não exigem autenticação nem têm limite** — qualquer pessoa consome IA paga pela empresa.
- Não existe analytics, painel admin, sistema de planos nem pagamento.
- Existem só 4 templates (`src/lib/cv-design-presets.ts`): classico, moderno, compacto, visual-sidebar.

### 1.2 Decisões de negócio já tomadas (NÃO reabrir discussão)

1. **Modelo:** freemium com 3 níveis — anônimo → conta grátis → plano ativo.
2. **Filosofia de conversão:** "pescar primeiro" — nunca exigir cadastro na porta de entrada. O usuário usa, vê valor, e o cadastro/pagamento aparece no momento de máximo valor percebido (resultado parcial desfocado, download, template premium).
3. **Pagamentos — PaySuite como agregador único (decisão revista em 10/07/2026):**
   - **Stripe fica PARQUEADO** — não opera para comerciantes em Moçambique, não há entidade legal viável no curto prazo. Não reabrir sem novo pedido explícito do usuário.
   - **PaySuite** é o único processador: cobre M-Pesa, e-Mola, mKesh e cartão no mesmo checkout/API. Modelo **pré-pago**: paga → plano ativo por 30 dias → expira → lembrete de renovação (nenhum destes métodos tem débito recorrente automático).
   - `subscriptions.provider = 'paysuite'`; o método escolhido dentro do checkout (mpesa/emola/mkesh/card) fica em `subscriptions.payment_method` / `payments.payment_method`, só para analytics — a integração é uma só.
   - `hasActivePlan()` continua a única verificação server-side de plano ativo.
4. **Home com apenas 3 botões** (anti-poluição):
   - **"Criar meu CV grátis"** (primário) → abre modal com: "Criar do zero" e "Tenho CV, quero apenas melhorar" (fluxos já existentes, só renomeados/reorganizados).
   - **"Analisar meu CV"** (secundário).
   - **"CV para uma vaga"** (secundário).
5. **Templates:** criar 6–10 templates modernos; premium = experimenta no editor à vontade, mas só baixa com plano.

### 1.3 Matriz de acesso v1.0 (APROVADA — implementar exatamente isto)

| Ação | Anônimo | Conta grátis | Plano ativo |
|---|---|---|---|
| Editar/melhorar CV manual, trocar template, pré-visualizar (inclusive premium) | ilimitado | ilimitado | ilimitado |
| Analisar CV | 1× (resultado parcial/desfocado) | 1×/24h, 3/mês | ilimitado |
| IA (sugestões, CV sob medida para vaga) | 1 amostra | 2 usos → espera 24h; máx 4/mês | ilimitado |
| Download com template grátis | ❌ (pede conta) | 1/dia, 3/mês | ✅ |
| Download com template premium | ❌ | ❌ (experimenta, não baixa) | ✅ |
| Carta de apresentação | ❌ | 1 amostra parcial, 1×/24h, 3/mês | ✅ |
| Preparação de entrevista | ❌ | ❌ (só vitrine) | ✅ |

**Regras de ouro (valem para todas as fases):**

- **Nunca limitar o que engaja e não custa** (edição manual, preview) — só limitar o que custa (IA) e o que captura (download).
- **Limites renovam mensalmente** — nunca tetos vitalícios; conta grátis nunca "morre".
- **Toda verificação de limite/plano é server-side** (nas server functions). O cliente só exibe o estado; nunca decide.
- **Limites vivem numa tabela de política no banco** (`access_policies`), não em constantes no código — mudar um limite tem de ser um UPDATE, não um deploy.
- Cooldown de 24h sempre exibido com contador + botão de upgrade ao lado ("Não quer esperar? Assine").
- Anônimos têm rate-limit invisível por IP/dispositivo por baixo de tudo (anti-abuso, não anti-usuário).

### 1.4 Decisões de negócio ainda PENDENTES (perguntar ao usuário quando chegar a fase)

- [ ] Preço do plano mensal (em MZN; referência USD/EUR já não é prioridade com Stripe parqueado).
- [ ] Modelagem de pacote avulso de créditos além da assinatura (usuário confirmou em 10/07/2026 que quer isto, mas ainda sem preço por crédito nem regra de expiração — não misturar na infra de assinatura da Fase 1.4, avaliar no backlog da Fase 2).
- [ ] Conta/chave do PostHog (analytics) — o usuário precisa criar.
- [x] ~~Conta Stripe~~ — decidido em 10/07/2026: Stripe parqueado (não opera para comerciantes em Moçambique). PaySuite escolhido como agregador único.
- [ ] Credenciais da API PaySuite (merchant id, API key/secret, webhook secret) — aguardando o usuário. Até lá, Fase 1.4c é implementada com placeholders em env vars.

---

## 2. Prompt de Retomada (colar no início de TODA sessão nova)

```text
Leia o arquivo docs/PLANO-EXECUCAO.md inteiro antes de qualquer coisa. Ele é a fonte de
verdade do plano de monetização aprovado. Verifique nos checkboxes da secção 3 qual foi a
última fase concluída, confira no código se ela está mesmo implementada e commitada, e
diga-me qual é a próxima fase pendente. Não implemente nada ainda — só reporte o estado.
Lembre-se das regras do CLAUDE.md: bun (nunca npm), supabase db pull + regenerar types
antes de qualquer trabalho de banco, bun run build antes de qualquer push.
```

---

## 3. Fases e prompts de execução

Executar **em ordem**. Cada fase termina com: `bun run build` passando, commit na `main`, e o checkbox marcado aqui.

### FASE 0 — Controle e visão (sem mudança visível para o usuário)

#### [x] 0.1 — Tabela de política + registro de uso + rate-limit de IA

```text
Leia docs/PLANO-EXECUCAO.md (secções 1.3 e regras de ouro) e implemente a Fase 0.1:

1. Rode supabase db pull e regenere os types antes de tudo.
2. Crie via migration as tabelas:
   - access_policies: feature (text), tier (anonymous|free|premium), max_per_day int null,
     max_per_month int null, cooldown_hours int null, enabled bool. Popule com a matriz 1.3
     do plano. RLS: leitura pública, escrita só service role.
   - ai_usage: id, user_id (null para anônimo), anon_fingerprint (hash de IP+user-agent,
     null para logado), feature, created_at, tokens_in, tokens_out. RLS: usuário lê só o
     próprio; insert só via service role/server function.
3. Crie src/lib/access-control.server.ts com uma função checkAndRecordUsage(feature, user,
   fingerprint) que: lê a política da tabela, conta o uso na janela (24h/mês), e retorna
   { allowed, reason, remainingToday, remainingMonth, retryAt }. Sem exceções hardcoded.
4. Aplique checkAndRecordUsage em TODAS as server functions de IA (src/lib/llm.functions.ts
   e qualquer *.functions.ts que chame o AI gateway). Anônimo continua PODENDO usar
   (matriz 1.3) — o objetivo aqui é registrar e limitar abuso, não bloquear humanos.
   Quando negado, retornar erro estruturado { code: "LIMIT_REACHED", retryAt, upgrade: true }
   para a UI tratar depois (Fase 1.3).
5. Rate-limit anônimo por baixo: máx 10 chamadas de IA/dia por fingerprint,
   independentemente da feature (anti-bot, valor na access_policies como feature "_global").
6. bun run build, commit.
```

#### [x] 0.2 — Painel admin mínimo

```text
Leia docs/PLANO-EXECUCAO.md e implemente a Fase 0.2 (painel admin):

1. supabase db pull + types. Crie coluna/tabela de role admin (ex: tabela user_roles com
   RLS) e marque meu usuário como admin via migration ou instrução SQL que você me passa.
2. Rota src/routes/_authenticated/admin.tsx (seguir convenções de rota do CLAUDE.md),
   acessível só a admins (verificação server-side, não só no cliente).
3. Painel com: total de usuários, novos por semana, usuários ativos (7d), chamadas de IA
   por dia (últimos 30 dias, gráfico com recharts que já está instalado), custo estimado
   de IA, top features usadas. Fonte: ai_usage + auth.users via server function admin.
4. bun run build, commit.
```

#### [x] 0.3 — Analytics (PostHog) — REQUER chave do usuário

```text
Leia docs/PLANO-EXECUCAO.md e implemente a Fase 0.3 (analytics). Tenho a chave do PostHog:
[COLAR AQUI project API key + host].

1. Instale posthog-js com bun (atenção ao minimumReleaseAge do bunfig.toml).
2. Inicialize no cliente (src/routes/__root.tsx), respeitando SSR do TanStack Start
   (só no browser). Chave via env VITE_ (injeção já existe no vite.config — não tocar nele).
3. Eventos mínimos: page views automáticos + cv_created, cv_downloaded, ai_used (com
   feature), signup, login, template_selected (com id), limit_hit (com feature e tier).
   Identify no login com user id.
4. bun run build, commit.
```

### FASE 1 — Funil e receita

#### [x] 1.1 — Home nova: 3 botões + modal

```text
Leia docs/PLANO-EXECUCAO.md (secção 1.2, item 4) e implemente a Fase 1.1 (home nova):

1. Reformule src/routes/index.tsx com hierarquia clara acima da dobra:
   - CTA primário dominante "Criar meu CV grátis" → abre modal (Dialog do Radix já
     instalado) com dois botões: "Criar do zero" e "Tenho CV, quero apenas melhorar",
     cada um levando ao fluxo JÁ EXISTENTE correspondente (não recriar fluxos, só ligar).
   - CTAs secundários: "Analisar meu CV" e "CV para uma vaga" → rotas existentes.
   - APENAS esses 3 botões como ações. Nada de poluição.
2. Prova visual: grade/carrossel dos templates (usar os existentes por ora; a Fase 1.2
   adiciona os novos) mostrando previews reais de CV bonito.
3. Estados de hover/focus caprichados, contraste AA, responsivo mobile-first (a maioria
   dos usuários de carteira móvel está no telemóvel).
4. Registrar eventos PostHog nos 3 botões e nas 2 opções da modal (se Fase 0.3 feita).
5. bun run build, commit.
```

#### [x] 1.2 — Templates modernos (6–10 novos) + flag premium

```text
Leia docs/PLANO-EXECUCAO.md e implemente a Fase 1.2 (templates novos):

1. Estude a arquitetura atual: src/lib/cv-design-presets.ts, src/lib/templates/themes.ts,
   e os componentes de render do CV. Siga o padrão existente — templates são presets de
   design + tema, separados do conteúdo.
2. Crie 6 a 10 templates novos e modernos, variados: duas colunas com faixa lateral de
   cor, minimalista tipográfico, criativo com foto em destaque, executivo sóbrio,
   moderno com header colorido, e pelo menos 2 otimizados para ATS (uma coluna, sem
   elementos gráficos). Todos têm de ficar corretos na paginação e no export.
3. Adicione campo isPremium aos templates. Distribuição: os 4 atuais + 1–2 novos = grátis;
   o resto = premium. Na galeria, premium tem selo "Premium" mas É selecionável e
   editável por qualquer um (regra de ouro: nunca limitar o que engaja).
4. O bloqueio de download premium fica para a Fase 1.3 — aqui só o selo e a flag.
5. Teste cada template no preview paginado e no export DOCX. bun run build, commit.
```

#### [x] 1.3 — Gates progressivos (implementar a matriz na UI)

```text
Leia docs/PLANO-EXECUCAO.md (matriz 1.3 COMPLETA e regras de ouro) e implemente a
Fase 1.3 (gates progressivos). A infraestrutura checkAndRecordUsage já existe (Fase 0.1).

1. Resultado parcial para anônimo: na análise de CV, mostrar as 2–3 primeiras observações
   e desfocar o resto (blur + overlay "Crie uma conta grátis para ver a análise completa"
   com botão para /auth). O conteúdo completo NÃO pode estar no DOM/response do anônimo —
   a server function retorna só a parte visível + flag hasMore (senão basta inspecionar).
2. Carta de apresentação (conta grátis): gerar amostra = primeiro parágrafo visível,
   resto desfocado, CTA de plano. Mesma regra: o resto não desce ao cliente.
3. Download: bloquear conforme a matriz (anônimo → modal de cadastro; grátis com template
   premium → modal de plano; grátis além de 1/dia ou 3/mês → modal de plano com contador).
   Verificação server-side na geração do arquivo, não só esconder o botão.
4. Cooldowns: quando LIMIT_REACHED, exibir contador regressivo até retryAt + botão
   "Não quer esperar? Veja os planos".
5. Preparação de entrevista: para não-assinante, página vira vitrine (screenshot/descrição
   + CTA de plano). Cartas para anônimo: idem.
6. Emitir evento PostHog limit_hit em todo gate. bun run build, commit.
```

#### [x] 1.4a — Infra de planos (comum a Stripe e carteiras móveis)

```text
Leia docs/PLANO-EXECUCAO.md (secção 1.2 item 3) e implemente a Fase 1.4a (infra de planos).
Decisões de preço: [COLAR AQUI preço mensal em MZN e USD/EUR quando decidido].

1. supabase db pull + types. Crie via migration:
   - subscriptions: id, user_id, plan (text), status (active|expired|canceled|pending),
     provider (stripe|mpesa|emola), provider_ref, current_period_end timestamptz,
     created_at. RLS: usuário lê só a própria; escrita só service role.
   - payments: id, user_id, subscription_id, provider, amount, currency, status
     (pending|confirmed|failed), provider_ref, created_at. Mesma RLS.
2. src/lib/subscription.server.ts com hasActivePlan(userId): status=active AND
   current_period_end > now(). É a ÚNICA porta de verificação de plano — Stripe e
   carteiras móveis convergem aqui. Integrar ao checkAndRecordUsage (tier premium).
3. Página /planos: comparativo grátis vs premium (usar a matriz 1.3 como copy), botão de
   assinar com escolha de método: Cartão (Stripe) | M-Pesa | e-Mola. Botões ainda
   inertes — as integrações vêm em 1.4b e 1.4c.
4. bun run build, commit.
```

#### [x] 1.4c — PaySuite (checkout redirecionado + webhook)

```text
Leia docs/PLANO-EXECUCAO.md (secção 1.2 item 3, revista em 10/07/2026) e implemente a Fase
1.4c (PaySuite). Credenciais (ainda não disponíveis — implementar com placeholders em env
vars até o usuário fornecer): PAYSUITE_API_KEY, PAYSUITE_WEBHOOK_SECRET, PAYSUITE_BASE_URL
(default https://paysuite.tech/api/v1), PLAN_PRICE_MZN, GRACE_DAYS (default 2).

Referência da API (paysuite.tech/docs, consultada em 10/07/2026): POST /payments cria um
pedido de pagamento (amount, reference, method?: credit_card|mpesa|emola, description,
return_url, callback_url) e devolve { id, status: pending, checkout_url }. O cliente é
redirecionado para checkout_url — é lá, na página hospedada da PaySuite, que ele escolhe
o método (incluindo mKesh) e introduz o número/cartão; nós NÃO recolhemos o número de
telemóvel diretamente. GET /payments/{id} consulta o estado. Webhook chega em callback_url
com { event: "payment.success"|"payment.failed", data, request_id }, assinado em
X-Webhook-Signature via HMAC-SHA256 do corpo com PAYSUITE_WEBHOOK_SECRET.

1. Migration: subscriptions/payments.provider aceitam 'paysuite' (mantém 'stripe' no CHECK,
   parqueado); payments ganha method (mpesa|emola|mkesh|card), reference (nossa referência
   única) e paid_at; índice UNIQUE parcial em payments.provider_ref (transaction.id da
   PaySuite) para idempotência. RLS existente mantida (usuário só lê a própria; escrita só
   service role).
2. src/lib/paysuite.server.ts: cliente fino sobre a API (createPaymentRequest,
   getPaymentStatus, verifyWebhookSignature). Chaves só server-side.
3. /planos com um único botão "Assinar" por plano (sem escolha de método — isso acontece no
   checkout da PaySuite); pode mostrar logos M-Pesa/e-Mola/mKesh/Visa como selo de confiança,
   só visual. Server function cria subscriptions+payments em "pending" (reference única
   user+plano+período) e devolve checkout_url para o cliente redirecionar.
4. Rota de webhook (API route do TanStack Start): valida a assinatura, responde em <5s.
   payment.success → UPDATE condicional (WHERE status='pending', idempotente mesmo com
   retries) marca payments.confirmed + method + paid_at, e ESTENDE
   subscriptions.current_period_end = max(now, current_period_end) + período do plano,
   status=active — só na primeira confirmação. payment.failed → payments.failed, não mexe
   na subscription.
5. hasActivePlan(userId) continua a única porta: status=active AND current_period_end (mais
   GRACE_DAYS de graça, configurável) > now(). expireDuePlans só marca "expired" depois da
   graça passar.
6. Aviso no app a partir de 3 dias antes de vencer ("O teu plano expira em X dias — renova
   pela PaySuite").
7. Script dev-only (sem sandbox da PaySuite) que gera um payment.success assinado com HMAC
   válido e faz POST ao webhook local, para validar a extensão de período sem pagamento real.
8. bun run build, commit. Não é possível testar de ponta a ponta sem credenciais reais —
   avisar o usuário explicitamente disso no fim.
```

#### [ ] 1.4d — Recorrência: motor de lembretes + planos longos

```text
Leia docs/PLANO-EXECUCAO.md. A PaySuite (M-Pesa/e-Mola/mKesh/cartão) é pré-pago, sem débito
automático — a "recorrência" tem de ser simulada por lembretes e pela opção de planos mais
longos (ex.: 3/6/12 meses) que reduzem a frequência de renovação manual.

1. E-mails/notificações transacionais (Supabase) quando o plano está a X dias de expirar
   (aproveitar o aviso já calculado por getPlanExpiryWarning) e quando expira de facto.
2. Avaliar planos de duração maior (não só 30 dias) com desconto, para reduzir fricção de
   renovação — decisão de preço/duração ainda pendente do usuário.
3. Painel admin: taxa de renovação (quantos pagam de novo depois de expirar) para medir se o
   modelo pré-pago está a reter.

NÃO implementar ainda — só manter este item documentado até ser priorizado.
```

### Parqueado (futuro)

#### [PARQUEADO] 1.4b — Stripe (cartões, renovação automática)

> **Decidido em 10/07/2026: NÃO implementar.** Stripe não opera para comerciantes em
> Moçambique. PaySuite (1.4c) cobre cartão também, no mesmo checkout que M-Pesa/e-Mola/mKesh.
> Só reabrir esta fase se o usuário pedir explicitamente — por exemplo, se surgir uma
> entidade legal estrangeira para servir clientes internacionais (fora de Moçambique) e o
> pagamento por cartão via PaySuite não for suficiente para esse público.

### FASE 2 — Crescimento (contínuo, após Fase 1 completa)

#### [ ] 2.x — Backlog (priorizar com dados do PostHog)

```text
Leia docs/PLANO-EXECUCAO.md. A Fase 1 está completa e com receita ativa. Itens da Fase 2,
a priorizar conforme os funis do PostHog (me mostre os dados que precisa e eu trago):

- Landing pages SEO por caso de uso ("CV para [área]", "carta de apresentação com IA",
  "modelo de CV moçambique") como rotas públicas com conteúdo real.
- Link público de partilha do CV com selo "Feito com [nome do app]" → cada CV partilhado
  vira canal de aquisição.
- E-mails transacionais via Supabase: CV incompleto, limite renovado, plano a expirar.
- Testes de preço e de posição de paywall usando a tabela access_policies (UPDATE, sem
  deploy) — medir conversão antes/depois no PostHog.
- Ritmo contínuo: 1–2 templates premium novos por mês.
```

### FASE 3 — B2B (só se Fase 2 validar receita B2C)

#### [ ] 3.x — Exploração B2B

```text
Leia docs/PLANO-EXECUCAO.md. Explorar segunda linha de receita:
- Licença institucional (universidades, centros de emprego, consultorias): admin da
  instituição convida N candidatos com plano incluído; preço por assento.
- Produto para recrutadores reutilizando a análise de vagas/CV já construída (triagem).
Começar por proposta de modelo de dados + pricing para eu validar antes de codar.
```

---

## 4. Critérios de sucesso por fase (para a empresa acompanhar)

| Fase | Sinal de sucesso | Se falhar |
|---|---|---|
| 0 | Custo de IA visível e limitado; painel mostra números reais | — (fase de infraestrutura, sempre vale) |
| 1 | 2–5% dos usuários ativos convertem para pago | Rever preço e posição do paywall com dados do PostHog, não desistir do modelo |
| 2 | CAC orgânico ~zero; crescimento mensal de signups | Reavaliar canais; SEO demora 3–6 meses, ter paciência |
| 3 | 1–2 contratos institucionais piloto | Manter foco B2C |
