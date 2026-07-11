# Adendo ao briefing de precificação — Alinhamento com o app real

> Preparado em 10/07/2026. Companheiro de `docs/BRIEFING-PRECIFICACAO.md` e `docs/PLANO-EXECUCAO.md`.
> **Motivo deste adendo:** o briefing original e a infraestrutura já construída assumem um modelo
> (**assinatura com acesso ilimitado**), mas há em paralelo um apetite por um modelo de **créditos
> consumíveis** (mockup de planos, briefing secção 8.2). Os dois coexistem hoje **sem ponte** — e,
> mais importante, o app mede o custo de IA de uma forma que **não sustenta o preço de nenhum dos
> dois modelos** sem um ajuste prévio. Este documento dá ao especialista os factos técnicos reais
> (extraídos do código, não de suposição) para precificar e empacotar de forma que **encaixe no que
> o app realmente faz** — e não o contrário.

---

## 0. Assunção de responsabilidade (para leitura interna, não afeta o especialista)

O plano de assinatura foi desenhado sobre uma descrição do app que **agrupou todas as funções de
IA como se tivessem custo equivalente**. Ao ler o código, isso revela-se falso: as operações de IA
diferem em custo por um fator de várias vezes, mas o sistema trata-as como uma coisa só. Qualquer
precificação herda esse erro se não o corrigir primeiro. Este adendo existe para expor o dado real
e evitar que o especialista precifique sobre uma premissa errada.

---

## 1. A desconexão central: dois modelos, nenhuma ponte

| | Modelo A — **Assinatura ilimitada** (o que está construído) | Modelo B — **Créditos consumíveis** (o mockup / desejo) |
|---|---|---|
| Lógica de acesso | Plano ativo = **uso ilimitado** de IA por 30 dias | Cada ação premium **consome N créditos** de um saldo |
| Grátis é limitado por… | **contagem** (ex.: 4 usos de IA/mês) que **renova sozinha** | **saldo de créditos** que **expira** |
| Onde vive hoje | Tabela `access_policies` + `subscriptions` + `hasActivePlan()` | **não existe** — nenhuma tabela de saldo/consumo de créditos |
| Fricção mental do utilizador | baixa ("tenho plano, uso à vontade") | alta ("estou a gastar créditos") |
| Risco de margem | **utilizador premium de alto uso pode custar mais que a mensalidade** | baixo, se o preço/crédito cobrir o custo real |
| Estado no plano aprovado | Fase 1 (feito) | **backlog da Fase 2**, "não misturar na infra de assinatura" (PLANO-EXECUCAO 1.4) |

**Consequência para o especialista:** decidir "quanto cobrar" **depende de qual modelo** se adota,
e essa decisão ainda está aberta. Não é possível dar um preço mensal coerente sem, antes, escolher
se o eixo é assinatura ou créditos — ou como os dois se combinam (ver secção 5). Este adendo
recomenda tratar isto como **a primeira pergunta**, antes das quatro perguntas da secção 8 do
briefing.

---

## 2. O dado que muda tudo: as operações de IA **não** têm custo equivalente

O app tem **6 operações que usam IA**. Todas correm no mesmo modelo (`google/gemini-3-flash-preview`,
US$0,50/M tokens de entrada, US$3,00/M de saída, sem tecto de tokens de saída). Mas o **volume de
tokens** — logo o custo — varia enormemente entre elas:

| # | Operação (nome no código) | O que faz | Peso de custo | Chave de acesso hoje |
|---|---|---|---|---|
| 1 | `generateFieldSuggestions` | Sugestão pontual num campo (resumo, bullet) — micro-interação | **muito baixo** | `ai_suggestions` |
| 2 | `analyzeCoverage` | Analisa CV vs vaga, devolve cobertura/lacunas | médio | `cv_analysis` |
| 3 | `alignCvToTdr` | Reescreve o CV inteiro alinhado à vaga | **alto** | `ai_suggestions` |
| 4 | `generateCoverLetter` | Gera carta de apresentação | médio | `cover_letter` |
| 5 | `generateInterviewPrep` | Gera perguntas/preparação de entrevista | médio-alto | `interview_prep` |
| 6 | `generateCvFromInterview` | Constrói o CV a partir de uma "entrevista" multi-turno com a IA | **o mais alto** | `ai_suggestions` |

### O problema concreto (o que "faltou delimitar")

As operações **1, 3 e 6** — as três com o custo **mais díspar de toda a lista** — partilham **o mesmo
balde `ai_suggestions`**. Isto significa que hoje:

- Uma **sugestão de campo** (dezenas de tokens) conta **exatamente igual** a um **CV via entrevista**
  (multi-turno, o mais caro de todos) para efeito de limite e de custo.
- No grátis, ambos consomem 1 dos "4 usos/mês" indistintamente.
- No premium, ambos são "ilimitados" — e é exatamente aqui que mora o risco que o próprio briefing
  levanta (secção 6): *"não haver utilizadores premium cujo custo de IA ultrapasse a mensalidade"*.
  Com `generateCvFromInterview` ilimitado e sem tecto de tokens, **esse cenário é plausível**, não
  hipotético.

**Tradução para pricing:** qualquer preço — por crédito ou por mês — que trate estas 6 operações
como uma unidade só está a subsidiar as caras à custa das baratas e a expor a margem. O primeiro
passo de qualquer modelo é **atribuir um peso de custo diferente por operação**.

---

## 3. Peso de custo recomendado por operação (ponto de partida, a validar com dados reais)

Enquanto não há export real do `ai_usage` (ver secção 7), esta é a **hierarquia relativa** que o
especialista deve usar como esqueleto — os números finais saem dos dados, mas a **ordem** é certa:

| Operação | Peso sugerido (em "créditos", se modelo B) | Racional |
|---|---|---|
| Sugestão de campo (`generateFieldSuggestions`) | **0 (grátis/ilimitado) ou 0,2** | É micro-interação de edição — é isca de engajamento, não produto. Cobrar por clique mata a feature. |
| Análise de CV (`analyzeCoverage`) | 1 | Uma chamada estruturada de tamanho médio. |
| Carta (`generateCoverLetter`) | 1 | Idem. |
| Preparação de entrevista (`generateInterviewPrep`) | 1–2 | Saída maior. |
| CV alinhado à vaga (`alignCvToTdr`) | 2 | Reescreve o documento inteiro. |
| CV via entrevista (`generateCvFromInterview`) | **2–3** | Multi-turno, o mais caro; tem de pesar mais. |
| Download / troca de template / edição | **0 (sempre grátis)** | Não usa IA; é o que gera engajamento (regra de ouro do plano). |

> Nota de produto (regra de ouro, já fechada — não reabrir): **nunca limitar o que engaja e não
> custa** (edição, preview, troca de template). Só se limita/cobra o que custa (IA) e o que captura
> valor (download). A tabela acima respeita isso: as duas linhas de peso 0 são intencionais.

---

## 4. O que o app **realmente** oferece e limita hoje (fonte de verdade para a copy dos planos)

Estes são os limites **atualmente em produção** (tabela `access_policies`), que o mockup de planos
já **contradiz sem querer** — útil para o especialista calibrar o quão generoso/apertado é o grátis:

| Ação | Anónimo | Conta grátis | Plano ativo |
|---|---|---|---|
| Analisar CV | 1× no total (parcial/desfocado) | 1×/24h, **3/mês** | ilimitado |
| IA — sugestões + CV alinhado + CV via entrevista (**mesmo balde**) | 1 amostra | 2/24h, **4/mês** | ilimitado |
| Download template grátis | ❌ | 1/dia, **3/mês** | ✅ |
| Download template premium | ❌ | ❌ (só experimenta) | ✅ |
| Carta de apresentação | ❌ | 1×/24h, **3/mês** | ✅ |
| Preparação de entrevista | ❌ | ❌ (só vitrine) | ✅ |

**Ponto de atenção para o especialista:** no mockup de créditos, "grátis = 5 créditos/mês" e uma
candidatura completa custa ~5 créditos → **grátis = 1 candidatura/mês**. Isto é **bem mais apertado**
do que o grátis atual (análise 3 + IA 4 + carta 3, contados em separado). Trocar para créditos, com
os números do mockup, é **reduzir silenciosamente o grátis** — decisão legítima, mas tem de ser
consciente, pois muda a taxa de conversão e o funil que o PostHog vai medir.

**Vantagem operacional (importante para o pricing):** todos estes números vivem em tabela
(`access_policies`), não em código. Mudar qualquer limite é um `UPDATE`, **sem deploy**. Logo, a
primeira proposta de preço/limite **não precisa de ser perfeita** — é ajustável com dados reais
poucas semanas após o lançamento. O especialista deve propor sabendo que é iterável.

---

## 5. Como os dois modelos podem coexistir (recomendação de arquitetura de oferta)

O plano aprovado já quer **ambos**: assinatura mensal (Fase 1) **e** pacote de créditos avulso
(Fase 2, confirmado pelo dono). A forma coerente de os juntar, sem canibalizar a conversão:

- **Assinatura mensal = "ilimitado" continua a ser a oferta âncora** (o negócio bom, recorrência).
  Preço a definir (`PLAN_PRICE_MZN`) — é o bloqueador nº 1 do briefing.
- **Créditos avulsos = a porta para quem não quer assinar** (uso pontual). Regra de ouro: o avulso
  tem de **parecer pior negócio que assinar** (briefing 8.2), senão corta a conversão para o plano.
  → Na prática: preço/crédito do avulso deve tornar "5 candidaturas avulsas" **mais caro** que
  "1 mês de plano".
- **O peso por operação (secção 3) aplica-se aos dois:** no plano ilimitado, define o **tecto de
  abuso** (ex.: rate-limit alto em `generateCvFromInterview` para o premium não drenar margem); no
  avulso, define **quantos créditos cada ação consome**.

> **Nota técnica que o especialista deve saber:** o modelo de créditos **ainda não existe no código**
> (não há tabela de saldo nem de consumo de créditos). O mockup de planos é uma **proposta visual**,
> não uma feature construída. Portanto o especialista **não está limitado pelo que já existe** ao
> desenhar o pacote de créditos — pode propor a estrutura ideal, e a implementação segue a proposta,
> não o contrário. (Isto é o oposto da assinatura, essa já construída e cara de mudar.)

---

## 6. Defesas de margem que o pricing deve assumir como pré-requisito

Independentemente do modelo escolhido, estas duas correções técnicas **têm de acontecer** para o
preço fechar — o especialista deve assumi-las como dadas e precificar em cima delas:

1. **Separar as 6 operações de IA por peso de custo** (secção 3), em vez do balde único
   `ai_suggestions`. Sem isto, nenhum preço tem margem previsível.
2. **Pôr um tecto de tokens de saída por chamada** (hoje não existe — briefing 6) e **rate-limit por
   sessão** nas sugestões de campo. Sem isto, um único utilizador entusiasmado (ou um script)
   distorce o custo médio sobre o qual o preço foi calculado.

---

## 7. Dados reais a puxar antes de fechar o preço (checklist para o especialista)

O painel admin interno (já construído, lê `ai_usage` no Supabase) tem os dados abaixo. Pedir este
export **antes** de fixar preço — substitui suposição por medição:

- [ ] **Custo médio de IA por operação** (as 6 da secção 2), em USD, dos últimos 30 dias —
      idealmente já **separado** por operação e não pelo balde `ai_suggestions`. Se ainda vier
      agregado, pedir a separação (é o dado que valida os pesos da secção 3).
- [ ] **Distribuição de uso:** quantas chamadas de cada operação por utilizador ativo/mês. Revela
      se `generateCvFromInterview` (a cara) é rara ou comum — muda o risco de margem do ilimitado.
- [ ] **Custo do utilizador do topo (p95/p99):** o utilizador que mais consome IA custa quanto/mês?
      É esse que a mensalidade tem de cobrir, não a média.
- [ ] **Taxa de transação da PaySuite** (pendente do dono — briefing 7): afeta a margem líquida real.
- [ ] **Volume atual de utilizadores ativos** e proporção anónimo/grátis, para dimensionar o funil
      de conversão (meta: 2–5% convertem — PLANO-EXECUCAO secção 4).

---

## 8. Resumo executivo para o especialista

1. **Antes de precificar, escolher o eixo:** assinatura ilimitada (construída) vs créditos
   (desejada, não construída) vs combinação (secção 5). É a decisão que destrava todas as outras.
2. **As 6 operações de IA não têm custo igual** — três das mais díspares partilham hoje o mesmo
   balde. Qualquer preço tem de as separar por peso (secção 3) primeiro.
3. **O grátis do mockup (créditos) é mais apertado que o grátis atual** — se for por créditos, é uma
   redução consciente do funil, não um detalhe.
4. **O avulso deve ser sempre pior negócio que assinar**, para não canibalizar a recorrência.
5. **Tudo é iterável sem deploy** (limites em tabela) — a primeira proposta pode e deve ser
   validada com dados reais do painel/PostHog poucas semanas após o lançamento.
6. **Puxar o export real de `ai_usage`** (secção 7) antes de fixar qualquer número.
