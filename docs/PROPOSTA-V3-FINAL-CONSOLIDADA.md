# Proposta V3 — Planos, precificação e implementação

> **Documento único de decisão.** Consolida `BRIEFING-PRECIFICACAO.md`, `ADENDO-PRECIFICACAO-ALINHAMENTO.md`, e o feedback do especialista interno sobre a V2. Substitui todas as versões anteriores (V1 passes sem créditos; V2 créditos em todos os planos). **Aprovado pelo dono do produto em 11/07/2026 — fonte de verdade para a implementação faseada.**
>
> **Contexto adicional:** a primeira versão do app foi comprometida num incidente de segurança. Este repositório é a reconstrução (segunda versão). Os dados históricos de `ai_usage` da primeira versão foram perdidos — não se sabe ainda se a segunda versão também perdeu dados, ou se já tem alguma actividade real registada desde antes deste relançamento (ver secção 10, nota sobre timeline dos dados — recomenda-se puxar `ai_usage` desta versão já, sem esperar semanas).
>
> **Como ler este documento:**
> - **[FECHADO]** = decisão tomada, não reabrir.
> - **[DADO]** = número a fixar depois do lançamento com dados reais; entra no ar com placeholder.
> - **[BLOQUEADOR]** = tem de estar feito antes do lançamento; sem isto, o resto não funciona.

---

## 1. Decisão de eixo (responde à secção 1 do Adendo)

**[FECHADO] Modelo híbrido:**

- **Assinatura ilimitada** = eixo principal e âncora. É o que já está construído (`subscriptions` + `hasActivePlan()`); muda-se o mínimo.
- **Créditos ponderados** = exclusivo do pacote avulso. Não existe no código; constrói-se do zero com pesos por operação — **nunca com peso uniforme**.
- **Fair-use invisível** = defesa técnica anti-abuso no plano ilimitado. Tectos diários por operação que ficam acima do uso legítimo máximo. **Nunca aparecem na copy de venda**; aparecem só quando alguém os atinge, com mensagem suave e não-punitiva.

**Racional:** reconstruir a Fase 1 para créditos universais custaria semanas para resolver um risco (revendedor abusivo) que se resolve com rate-limits em horas. Complexidade de packaging não é o alavancador nesta fase — o alavancador é conversão do funil grátis→pago. O modelo híbrido dá o melhor dos dois modelos sem os custos de nenhum.

---

## 2. Tabela de preços final

| Oferta | Preço (MZN) | Conteúdo | Validade | Onde aparece |
|---|---|---|---|---|
| Grátis | 0 | Limites atuais (secção 4) | renova todo mês | Página `/planos` |
| Avulso "1 candidatura" | **149** | 8 créditos ponderados + downloads desbloqueados | 30 dias | Página `/planos` |
| **Mensal (alvo de conversão)** | **349** | Ilimitado com fair-use invisível (secção 5) | 30 dias | Página `/planos` |
| Trimestral | **749** | Idem mensal | 90 dias | Página `/planos` |
| Recarga extra | 79 | +4 créditos | herda validade do pacote | **Só in-app**, quando saldo do avulso desce abaixo de 3 créditos |

**`PLAN_PRICE_MZN = 349`** — desbloqueia o bloqueador nº 1 do briefing.

### Regra crítica sobre a recarga

**A recarga extra de 79 MZN NÃO aparece na página `/planos` nem no card do avulso.** Aparece **exclusivamente** no in-app, quando o utilizador do avulso já comprou e está a esgotar os créditos (banner ao chegar a ≤3 créditos, modal ao chegar a 0). Racional:

1. **Preserva a integridade matemática da ancoragem na primeira compra** — se a recarga aparecer na página de planos, um utilizador atento calcula `149 + 79 = 228 MZN por 12 créditos`, o que quebraria a leitura da barra "2 candidaturas = 298 MZN" antes mesmo de decidir comprar.
2. **Alinha o produto com o que a recarga é** — retenção, não aquisição.
3. **Melhora o momento psicológico da recarga** — utilizador com créditos a acabar no meio de uma candidatura tem alta disposição para pagar 79 MZN.

**Nota honesta (decisão consciente, não bug):** isto não elimina o facto de que, uma vez dentro do produto, "avulso + recarga" (228 MZN / 12 créditos) acaba por ficar mais barato que "2× avulso" (298 MZN / 16 créditos) para quem precisa exactamente de 2 candidaturas. É o mesmo padrão de pacote+recarga usado por operadoras de dados móveis moçambicanas, considerado aceitável — o utilizador que descobre isto já comprou pelo menos uma vez, e a FAQ da página já avisa da existência da recarga in-app para não parecer surpresa escondida.

### Ancoragem visual

Na página de planos, três degraus antes dos cards:

`149 MZN (1 candidatura avulsa) → 298 MZN (2 candidaturas) → **349 MZN (mês inteiro sem contar)**`

Válida do ponto de vista de decisão de primeira compra (ver nota acima sobre o limite desta validade). Meta de conversão inalterada: 2–5% dos ativos convertem (PLANO-EXECUCAO §4).

### Preços — banda de teste

- Mensal: banda 299–449 (piso duro 249; abaixo sinaliza produto amador).
- Avulso: banda 129–179 (piso duro 99).
- Trimestral: mantém desconto ~28% face a 3×mensal.
- Recarga extra: deliberadamente pior negócio da página (19,75 MZN/crédito) — existe para empurrar comprador de pacote para mensal na 2ª compra.

Todos os preços vivem em `access_policies` (ou tabela equivalente): mudar preço = `UPDATE`, sem deploy.

---

## 3. Pesos de crédito por operação (só no avulso)

Aplica-se **apenas ao pacote avulso**. Nos planos mensal e trimestral, tudo é ilimitado — a palavra "crédito" não aparece nesses cards.

| Operação | Peso | Nota |
|---|---|---|
| `generateFieldSuggestions` | **0** | Livre, com rate-limit por sessão **[DADO]** (ex.: 20/sessão). Isca de engajamento — cobrar aqui mata a feature. |
| `analyzeCoverage` | 1 | Chamada estruturada de tamanho médio |
| `generateCoverLetter` | 1 | Idem |
| `generateInterviewPrep` | 2 | **[DADO]** — pode descer a 1 se export mostrar custo médio próximo da carta |
| `alignCvToTdr` | 2 | Reescreve CV inteiro |
| `generateCvFromInterview` | 3 | **[DADO]** — o mais caro; nunca menos de 2 |
| Download / trocar template / editar | 0 | Edição sempre grátis. Download desbloqueia pela validade do pacote/plano, nunca por crédito (regra de ouro do produto) |

**Candidatura completa típica** = análise (1) + CV alinhado (2) + carta (1) + entrevista (2) = **6 créditos**. O pacote traz 8 — folga honesta de 2.

Preço efetivo do avulso ≈ 18,6 MZN/crédito, deliberadamente caro face ao mensal, para não canibalizar assinatura (Briefing §8.2).

---

## 4. Grátis — mantém-se, com uma única correção de balde

**[FECHADO] Não reduzir o funil no lançamento.** Limites atuais preservados, com a única mudança que o Adendo §4 exige (separar o balde `ai_suggestions`, que hoje agrega três operações de custo muito diferente):

| Acção | Grátis (V3) | Mudança vs produção atual |
|---|---|---|
| Editar CV, trocar template, preview | ilimitado | igual |
| Sugestões de campo (`generateFieldSuggestions`) | **livres, com rate-limit por sessão** | saem do balde de 4/mês; passam a livres porque custam ~0 |
| Analisar CV | 3/mês (1×/24h) | igual |
| IA pesada (`alignCvToTdr` + `generateCvFromInterview`) | **2/mês** | balde de 4 usos mistos passa a 2 usos que contam só as operações pesadas |
| Carta de apresentação | 3/mês (amostra parcial) | igual |
| Download template grátis | 3/mês (1/dia) | igual |
| Download premium | pré-visualização com marca d'água | igual |
| Preparação de entrevista | vitrine | igual |

**Efeito líquido:** grátis fica **mais generoso no que engaja e não custa** (sugestões livres) e **mais apertado no que custa caro** (2 operações pesadas em vez de 4 mistas).

---

## 5. Fair-use invisível do "ilimitado" (defesa anti-revendedor)

**[FECHADO] A estrutura, a filosofia, a copy.** Só os **valores dos tectos** são `[DADO]`.

### Filosofia

Ilimitado publicitado + tectos técnicos invisíveis calibrados **acima do uso legítimo máximo**. Utilizador normal (candidato a 3–5 vagas/mês) e utilizador intensivo (candidato desempregado a 40+ vagas/mês) **nunca vêem o limite**. Revendedor de CVs para terceiros bate no limite ao 3º dia e não consegue operar economicamente. É o padrão de todo o SaaS de IA sério (ChatGPT, Notion AI, Grammarly, Jasper) — ninguém publica os números.

### Regras de comunicação

- **Página de planos:** "Tudo ilimitado por 30 dias". Sem asterisco. Sem tabela de tectos.
- **FAQ:** *uma* pergunta honesta — "O 'ilimitado' tem letras pequenas?" — resposta menciona a existência dos tectos sem os quantificar.
- **Mensagem ao bater:** "Atingiste o máximo diário desta funcionalidade. Volta amanhã ou contacta-nos se precisas de mais volume." — a última frase transforma utilizador legítimo raro (recrutador) que bate no limite em oportunidade de venda B2B.

### Tectos diários por operação (valores placeholder — recalibrar semana 4)

| Operação | Tecto/dia **[DADO]** | Racional |
|---|---|---|
| `generateCvFromInterview` | 2 | Ninguém constrói 2 CVs do zero por entrevista no mesmo dia — exceto quem faz CVs de terceiros |
| `alignCvToTdr` | 4 | 4 vagas/dia é procura intensa legítima; 10+/dia é operação comercial |
| `analyzeCoverage` | 10 | |
| `generateCoverLetter` | 5 | |
| `generateInterviewPrep` | 5 | |
| `generateFieldSuggestions` | rate-limit por sessão | |

**Critério de calibração** (após dados reais):
- **Pior caso teórico** (todos os tectos batidos 30 dias seguidos) deve custar **< 50% da mensalidade**.
- **p99 real** de utilizador legítimo deve consumir **< 20% da mensalidade**.

Se qualquer critério for violado, ajustar tectos — **nunca o preço primeiro**.

---

## 6. Pré-requisitos técnicos ([BLOQUEADOR] — não lançar sem)

1. **Separar as 6 operações do balde único `ai_suggestions`** — cada operação com a sua chave de acesso em `access_policies`.
2. **Tecto de tokens de saída por chamada** em todas as 6 operações.
3. **Rate-limit por sessão em `generateFieldSuggestions`**.
4. **Instrumentação de logging por operação desde o dia 1** — operação, tokens in, tokens out, custo USD, user_id. **Não-negociável dado o histórico de perda de dados da primeira versão.**
5. **Fail-safe de custo diário** — alerta automático se o custo total de IA no dia ultrapassar um limiar (ex.: US$5).

---

## 7. Pedido de dados à equipa (para fixar os `[DADO]`)

1. **Custo médio de IA por operação** (nº chamadas, tokens in/out, custo USD/MZN por chamada) — fecha os pesos do avulso (secção 3).
2. **Distribuição de uso por operação** (mediana, p75, p95, p99, máximo) — fecha os tectos diários de fair-use (secção 5).
3. **Custo total de IA por utilizador** (média, p95, p99, utilizador mais caro do mês) — confirma/ajusta os 349 MZN. Regra: p99 real < 20% da mensalidade.
4. **Volume e composição do funil** (utilizadores ativos, proporção anónimo/grátis/plano, % que bateram limite) — dimensiona a meta 2–5%.
5. **Taxa PaySuite** (% de transacção, mínimo fixo se existir) — confirma/ajusta o avulso 149 e a recarga 79.

**Não esperar pelo lançamento para o item 1–3:** se a segunda versão do app já tem alguma actividade em `ai_usage` desde antes deste relançamento, puxar já — mesmo com volume baixo, é melhor que os placeholders.

---

## 8. Plano de implementação faseado

### Fase 0 — Pré-requisitos ([BLOQUEADOR], antes de tudo)

- [ ] Separar as 6 operações do balde `ai_suggestions` — chaves próprias em `access_policies`.
- [ ] Tecto de tokens de saída por chamada em todas as 6 operações.
- [ ] Rate-limit por sessão em `generateFieldSuggestions`.
- [ ] Logging por operação (op, tokens in/out, custo USD, user_id) desde o primeiro request.
- [ ] Fail-safe de custo diário com alerta.

### Fase 1 — Infra de assinatura e preços em tabela

- [ ] Preços em `access_policies` (149, 349, 749, 79) — todos por `UPDATE`, nunca hardcoded.
- [ ] Tectos placeholder da secção 5 em `access_policies` por operação.
- [ ] Limites do grátis (secção 4) atualizados: separar sugestões (livres) das pesadas (2/mês).
- [ ] Webhook PaySuite ligado a extensão de `current_period_end` da assinatura (já existe, revalidar).
- [ ] Mensagens de "atingiste o máximo diário" implementadas — suaves, com CTA "contactar-nos".

### Fase 2 — Página `/planos`

- [ ] Layout de 4 cards: Grátis / Avulso 149 / **Mensal 349 (destaque)** / Trimestral 749.
- [ ] Barra de ancoragem "149 → 298 → **349 mês inteiro sem contar**" acima dos cards.
- [ ] Tabela comparativa.
- [ ] Accordion "Como funcionam os créditos" — só aplicável ao avulso; palavra "crédito" **não aparece** nos cards Mensal/Trimestral.
- [ ] FAQ com a pergunta "O 'ilimitado' tem letras pequenas?" — resposta honesta sem números.
- [ ] Indicador na sidebar: assinantes vêem "Premium · X dias restantes"; donos de pacote vêem "X de 8 créditos · expira em Y dias"; grátis vê "3 análises restantes".
- [ ] **Corrigir antes de implementar:** a FAQ "E se os 8 créditos do avulso não chegarem?" tem erro de matemática na cópia original — dizia que o mensal (349) "sai melhor" que duas compras avulsas (298), o que é falso (298 < 349). Alinhar com a outra FAQ: o mensal só compensa em preço a partir da 3ª candidatura, não da 2ª.

### Fase 3 — Infra de créditos para o avulso

- [ ] Tabela `credit_balances` (user_id, saldo, expires_at, package_id).
- [ ] Tabela `credit_transactions` (user_id, operation, cost, timestamp).
- [ ] Débito com peso por operação (secção 3) implementado no serviço de IA.
- [ ] Compra de avulso → cria saldo de 8 + validade 30 dias.
- [ ] Compra de recarga (79 MZN) → adiciona 4 créditos, herda validade do pacote ativo.
- [ ] Downloads desbloqueados durante validade do pacote (não gastam crédito).

### Fase 4 — Instrumentação e dogfooding

- [ ] PostHog: eventos de "bateu limite grátis por operação", "abriu paywall", "iniciou checkout", "completou pagamento", "atingiu tecto ilimitado".
- [ ] Painel admin: custo IA por utilizador, custo IA por operação, top 10 utilizadores mais caros.
- [ ] **Dogfooding pelo dono:** o dono usa o app durante 3 dias como candidato real a 5 vagas. Se atingir qualquer tecto de fair-use, os tectos estão mal calibrados — subir antes de lançar.

### Fase 5 — Lançamento

**Comunicação do incidente — requer base jurídica preparada antes de qualquer texto público.**

Um app de CVs manuseia dados pessoais (nomes, formação, contactos, historial profissional).

**Estado legal em Moçambique (verificar sempre com advogado antes de publicar, não confiar só neste resumo):**

- Não existe ainda em vigor uma lei geral autónoma de protecção de dados pessoais. A Proposta de Lei de Protecção de Dados Pessoais foi aprovada pelo Conselho de Ministros a 4 de Março de 2026 e segue para votação final na Assembleia da República — entrada em vigor depende dessa votação e publicação em Boletim da República, esperada durante 2026, com período transitório.
- O quadro atual assenta em peças dispersas: Constituição da República (artigo 71), Lei nº 3/2017 de 9 de Janeiro — Lei de Transacções Electrónicas (LTE), artigos 63–65 (que definem a figura de "Processador de Dados"), e o Regulamento do Sistema de Certificação Digital de Moçambique (Decreto nº 59/2019).
- A Lei nº 3/2017 é a LTE, **não** é uma lei geral de protecção de dados — cuidado ao citar isto em qualquer comunicação, é um erro fácil de cometer.

**Sub-passos obrigatórios antes de qualquer texto público:**

- [ ] **Apuramento forense do incidente:** identificar concretamente que dados foram expostos, de que utilizadores, e por quanto tempo. Sem este apuramento, não avançar.
- [ ] **Consulta a advogado moçambicano especializado** para determinar dever de notificação, forma e prazo. Não é decisão de marketing nem de engenharia.
- [ ] Se houver dever de notificação: preparar comunicação formal aos titulares dos dados antes de qualquer comunicação de marketing sobre a reconstrução.
- [ ] Se não houver dever: pode-se optar por comunicar voluntariamente a reconstrução com foco no ativo (nova arquitetura de segurança), sem detalhes do incidente que criem responsabilidade nova.

**Sub-passos comerciais:**

- [ ] Contactar 5–10 utilizadores do piloto anterior para validar volta — em canais privados, não comunicação pública.
- [ ] Rever se algum utilizador contactado é elegível para notificação formal.

### Fase 6 — Calibração (semanas 2–4 após lançamento, ou antes se `ai_usage` já tiver dados)

- [ ] Extrair Dados 1–5 (secção 7).
- [ ] Ajustar por `UPDATE` os `[DADO]` desta proposta (pesos do avulso, tectos ilimitado).
- [ ] Se conversão < 2%: mexer primeiro no **paywall contextual** (posição, copy), só depois no preço.
- [ ] Se p99 do custo por utilizador > 20% da mensalidade: apertar tectos, nunca subir preço.

---

## 9. Registo de decisões (para não reabrir)

| Decisão | Estado |
|---|---|
| Eixo híbrido: assinatura ilimitada + créditos só no avulso | [FECHADO] §1 |
| Grátis não reduz no lançamento | [FECHADO] §4 |
| Pesos por operação (existência e ordem) | [FECHADO] §3 |
| Pesos por operação (valores exatos) | [DADO] pós-lançamento |
| Tectos fair-use (existência, filosofia, comunicação) | [FECHADO] §5 |
| Tectos fair-use (valores exatos) | [DADO] pós-lançamento |
| `PLAN_PRICE_MZN = 349` / avulso 149 / trimestral 749 / recarga 79 | Lançamento, banda de teste 299–449 no mensal |
| V1 (passes sem créditos) | Descartada — estrutura incompleta |
| V2 (créditos em todos os planos) | Descartada — conflito com infra construída + fricção mental desnecessária + risco de peso uniforme |
| Copiar estrutura de packaging do Magnific | Descartada — pressupostos incompatíveis (cartão salvo, custo/operação alto, cliente empresa) |
| Instrumentação de logging por operação desde dia 1 | [FECHADO] §6 — não-negociável dado histórico de perda de dados |
| Recarga de 79 MZN só in-app, nunca na página `/planos` | [FECHADO] §2 |
| Comunicação do incidente como "diferencial de marketing" sem base jurídica | Descartada — Fase 5 exige apuramento forense + parecer jurídico primeiro |

---

## 10. Histórico de revisão (censura externa, 3 rondas)

**Ronda 1 (sobre a V2):** pivot silencioso de modelo, peso uniforme por operação, números sem lastro, avulso mais barato que decoy Sprint, grátis reduzido silenciosamente, Magnific como referência de mecânica de pagamento — todos resolvidos na V3 (ver secção 9).

**Ronda 2 (sobre a V3 inicial):** matemática da ancoragem quebrava com a recarga visível na página (149+79=228 ≠ 298) — corrigido movendo a recarga para in-app apenas. Comunicação do incidente sem base jurídica — corrigido com apuramento forense + parecer jurídico como pré-requisito na Fase 5.

**Ronda 3 (consistência entre ficheiros):** checkout mostrava 799 MZN para o trimestral em vez de 749; paywall modal mostrava 5 créditos em vez de 8; modal de recarga usava peso errado (2 em vez de 1) no exemplo de análise; checkout afirmava "taxa de processamento 0 MZN" como facto confirmado antes de a taxa PaySuite estar validada; citação legal "Lei nº 3/2017 de Protecção de Dados" estava incorrecta (é a Lei de Transacções Electrónicas). Todos corrigidos e verificados — a citação legal corrigida foi confirmada por pesquisa externa em 11/07/2026 (Conselho de Ministros aprovou a proposta de lei geral a 4/03/2026, ainda em discussão na Assembleia).

**Ronda 4 (verificação final antes da implementação):** FAQ da página `/planos` continha uma contradição matemática entre duas respostas — uma dizia que o mensal compensa "a partir de mais que 2 candidaturas" (correcto), outra dizia que compensa "a partir de mais que 1" comparando com "duas compras avulsas" a 298 MZN, que é mais barato que os 349 do mensal. Corrigido na Fase 2 desta versão do documento (ver checklist da Fase 2).

---

## 11. Ficheiros de apoio a este documento

- `docs/mockups/mockup-planos-v3-final.html` — mockup navegável da página `/planos`.
- `docs/mockups/mockup-paywall-modal.html` — mockup do paywall contextual.
- `docs/mockups/mockup-checkout-mpesa.html` — mockup dos 3 passos do checkout M-Pesa/e-Mola.
- `docs/mockups/mockup-recarga-in-app.html` — mockup dos 3 estados in-app da recarga.

---

**Próximo passo:** implementar a Fase 0 (pré-requisitos técnicos) — é bloqueadora de tudo o resto.
