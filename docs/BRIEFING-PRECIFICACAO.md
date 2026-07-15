# Briefing para especialista de precificação — CVelite

> Preparado em 10/07/2026. Objectivo: dar a um especialista externo de pricing/planos toda a
> informação de produto, custo e restrições de negócio necessária para propor preços e desenhar
> pacotes — sem que ele precise de acesso ao código. Fonte de verdade complementar:
> `docs/PLANO-EXECUCAO.md` (plano de monetização aprovado).

---

## 1. O produto, em uma frase

**CVelite** é um editor de currículos com IA para o mercado moçambicano: cria, melhora,
alinha o CV a uma vaga específica, gera carta de apresentação e prepara entrevistas — tudo em
português, pensado para uso a partir do telemóvel.

**Estágio actual:** produto funcional, com utilizadores reais (anónimos e contas grátis) a usar
as funcionalidades de IA, mas **ainda sem nenhuma receita** — a infraestrutura de planos e
pagamento já está construída (ver secção 7), à espera de: (a) o preço a definir por este
briefing, e (b) credenciais reais do processador de pagamento.

---

## 2. Utilizador e mercado

- **Mercado principal:** Moçambique. Idioma: português (variante moçambicana).
- **Dispositivo:** mobile-first — a maioria dos utilizadores acede por telemóvel, com carteira
  móvel (M-Pesa, e-Mola) como meio de pagamento natural, não cartão de crédito.
- **Perfil típico observado nos exemplos do produto:** candidatos a emprego no sector de
  desenvolvimento/ONGs, função pública e sector privado — pessoas a candidatar-se a uma vaga
  concreta, não só a "ter um CV pronto".
- **Poder de compra:** preços em Meticais (MZN). Não assumir paridade com preços de SaaS
  ocidentais (US$9,99/mês, por exemplo) sem ajustar à realidade local — isto é precisamente o
  que se pede ao especialista para calibrar.

---

## 3. O que o produto oferece hoje

### 3.1 Funcionalidades

| Funcionalidade | O que faz | Usa IA? |
|---|---|---|
| Editor de CV manual | Criar/editar CV campo a campo, trocar template e fonte | Não |
| Análise de CV vs vaga | Compara o CV a uma vaga/TdR e devolve cobertura, lacunas e sugestões de correcção | Sim |
| CV alinhado à vaga | Reescreve/realinha o CV à terminologia e requisitos de uma vaga específica | Sim |
| CV a partir de entrevista | Gera as secções do CV a partir de respostas dadas numa "entrevista" conduzida pela IA | Sim |
| Sugestões de campo | Sugestões de melhoria pontuais em campos do CV (resumo, descrição de experiência, etc.) | Sim |
| Carta de apresentação | Gera carta de apresentação personalizada para uma vaga | Sim |
| Preparação de entrevista | Gera perguntas e pontos de preparação para entrevista com base no CV/vaga | Sim |
| Download (DOCX) | Exporta o CV editado em ficheiro | Não |

### 3.2 Templates

10 templates de design ao todo:
- **6 grátis:** clássico, moderno, compacto, visual-sidebar, executivo, editorial.
- **4 premium:** contraste, retrato, destaque, direto.

Regra de ouro já decidida (não reabrir): **templates premium podem ser usados e editados por
qualquer pessoa livremente** — só o *download* do resultado com template premium exige plano
activo. A restrição nunca incide sobre o que gera engajamento (edição, preview), só sobre o que
tem custo real (IA) ou o que captura o valor final (download).

---

## 4. Modelo de negócio já decidido (não reabrir esta parte)

- **Freemium em 3 níveis:** anónimo → conta grátis → plano activo.
- **Filosofia "pescar primeiro":** nunca exigir cadastro à entrada. O utilizador experimenta,
  vê valor real, e só encontra o pedido de cadastro/pagamento no momento de valor máximo
  percebido (resultado parcial desfocado, tentativa de download, template premium).
- **Limites nunca são vitalícios** — renovam todo mês; a conta grátis nunca "morre" nem perde
  acesso permanentemente.
- **Nunca se limita o que não custa** (edição manual, preview) — só se limita o que custa (IA)
  e o que captura valor (download, carta, preparação de entrevista).

Isto define o **espaço de decisão** do especialista: ele **não** está a decidir o que fica grátis
vs pago em termos de funcionalidade — isso já está fechado (matriz abaixo). O que falta é
**quanto cobrar** e **como empacotar a oferta paga** (ver secção 8).

---

## 5. Matriz de acesso v1.0 (já implementada, ponto de partida dos limites)

| Acção | Anónimo | Conta grátis | Plano activo |
|---|---|---|---|
| Editar CV, trocar template/fonte, pré-visualizar (inclusive premium) | ilimitado | ilimitado | ilimitado |
| Analisar CV vs vaga | 1× (resultado parcial, desfocado) | 1×/24h, 3/mês | ilimitado |
| IA (sugestões, CV alinhado à vaga, CV via entrevista) | 1 amostra | 2 usos, depois espera 24h; máx. 4/mês | ilimitado |
| Download com template grátis | não permitido (pede conta) | 1/dia, 3/mês | sim |
| Download com template premium | não permitido | não permitido (só experimenta) | sim |
| Carta de apresentação | não permitido | 1 amostra parcial, 1×/24h, 3/mês | sim |
| Preparação de entrevista | não permitido | não permitido (só vitrine) | sim |

**Detalhe técnico relevante para o pricing:** estes limites vivem numa tabela no banco de dados
(`access_policies`), não no código. Mudar qualquer número acima é um `UPDATE` na base de dados,
**não exige novo deploy**. Isto significa que **testes A/B de preço e de posição de limite são
baratos de fazer depois do lançamento** — o especialista pode (e deve) propor a primeira versão
sabendo que ela será ajustada com dados reais, não é uma decisão irreversível.

---

## 6. Estrutura de custo variável #1 — Inteligência Artificial

Este é o custo directo mais relevante por utilizador activo, e a única componente de custo que
já tem número exacto e confirmado hoje:

| Item | Valor |
|---|---|
| Modelo usado em todas as funcionalidades de IA | `google/gemini-3-flash-preview` |
| Fornecedor | Lovable AI Gateway (repasse do preço da Google, **sem markup**) |
| Preço de entrada (tokens do prompt: CV + vaga + instruções) | US$ 0,50 por 1 milhão de tokens |
| Preço de saída (tokens gerados pela IA) | US$ 3,00 por 1 milhão de tokens |

**Como isto se traduz em custo por uso:** cada chamada às 4 funcionalidades de IA listadas na
secção 3.1 gasta um número de tokens que varia com o tamanho do CV e da vaga colada pelo
utilizador — não há um tecto fixo de tokens de saída configurado por chamada. Não existem ainda
dados de produção suficientes para dar uma média fiável de custo por chamada (poucos
utilizadores até agora, sem nenhum pagante). **Antes de fechar o preço final, recomenda-se**
puxar do painel administrativo interno (já construído, mostra custo real em USD por
funcionalidade nos últimos 30 dias, `ai_usage` no Supabase) uma amostra de uso real para
calibrar o custo médio por utilizador/mês — o especialista pode pedir esse export em vez de
trabalhar só com estimativas.

Ordem de grandeza para orientar a conversa inicial (não é dado medido, é para dar escala): um CV
+ vaga típicos rondam alguns milhares de caracteres de entrada e uma resposta estruturada de
saída — a um preço de US$0,50/US$3,00 por milhão de tokens, o custo de IA de uma única chamada
tende a ficar numa fracção pequena de um cêntimo de dólar, mas o volume por utilizador/mês
(especialmente premium, que tem uso ilimitado) é o que precisa de ser modelado com cuidado para
não haver utilizadores "premium" cujo custo de IA ultrapasse a mensalidade cobrada.

---

## 7. Estrutura de custo variável #2 — Processamento de pagamento

- **Processador único: PaySuite** (agregador moçambicano) — cobre M-Pesa, e-Mola, mKesh e cartão
  no mesmo checkout/API. Stripe foi avaliado e **descartado** (não opera para comerciantes em
  Moçambique).
- **Modelo é pré-pago, não subscrição com débito automático:** o utilizador paga, o plano fica
  activo por 30 dias, expira, e recebe lembrete para renovar manualmente. Nenhum dos métodos
  disponíveis (M-Pesa/e-Mola/mKesh/cartão via PaySuite) tem cobrança recorrente automática em
  Moçambique.
- **Implicação directa para o pricing:** como não há renovação automática, a fricção de renovar
  todo mês é maior do que num SaaS ocidental com cartão salvo. Isto é uma das razões pelas quais
  se pede ao especialista para avaliar **planos de duração mais longa com desconto** (ex.:
  3/6/12 meses) — reduz a frequência de fricção de pagamento, mesmo sem renovação automática.
- **Taxas do próprio PaySuite sobre cada transacção** ainda não foram confirmadas pelo lado do
  negócio — assinalar como ponto em aberto a confirmar com o utilizador/dono do produto antes de
  fechar a margem líquida por plano.
- **Moeda:** Meticais (MZN). Não há prioridade actual em cobrar em USD/EUR (o público-alvo é
  moçambicano; Stripe, que serviria cartões internacionais, está parqueado).

---

## 8. O que falta decidir — perguntas em aberto para o especialista

Estas são as decisões de negócio que este briefing existe para resolver:

1. **Preço do plano mensal, em MZN.** Este é o bloqueador principal — toda a infraestrutura de
   pagamento já está pronta e só espera este número (env var `PLAN_PRICE_MZN`).
2. **Pacote avulso de créditos, além da assinatura.** O dono do produto confirmou que quer esta
   opção (para quem só precisa de um uso pontual, não quer assinar), mas ainda não há: preço por
   crédito, quantos créditos por pacote, nem regra de expiração dos créditos comprados. Este item
   é backlog da Fase 2 — não deve ser misturado na tabela `subscriptions` da assinatura mensal,
   mas o preço relativo entre "1 mês de plano" e "N créditos avulsos" precisa de ser coerente
   (o avulso deve parecer pior negócio que assinar, para não cortar a conversão para assinatura).
3. **Planos de duração mais longa com desconto** (3/6/12 meses) — ver racional na secção 7.
   Se recomendado, precisa de: percentual de desconto por duração e se conta como um "plano"
   separado ou como multiplicador do mensal.
4. **Confirmar taxa de transacção da PaySuite** — necessário para calcular a margem líquida real
   de cada plano vendido (pendente do dono do produto, não do especialista, mas afecta a
   recomendação final).

**Fora do escopo deste especialista** (já decidido, não pedir revisão): o que é grátis vs pago
por funcionalidade (secção 5), a escolha de processador de pagamento (secção 7), o modelo
freemium de 3 níveis (secção 4).

---

## 9. Como o negócio vai medir sucesso

- **Meta da Fase 1 (lançamento dos planos):** 2–5% dos utilizadores activos convertem para o
  plano pago. Se não bater esta meta, a resposta esperada é **rever preço e posição do paywall
  com dados reais do PostHog** — não abandonar o modelo freemium.
- Existe já painel de analytics (PostHog) e painel administrativo interno com custo de IA em
  tempo real — qualquer proposta de preço pode (e deve) ser validada/ajustada com dados reais
  poucas semanas após o lançamento, graças aos limites viverem em tabela (secção 5).

---

## 10. Formato de resposta esperado

Idealmente, a resposta do especialista cobre:
- Preço mensal recomendado em MZN (com raciocínio: custo de IA por utilizador estimado, poder de
  compra local, comparáveis de mercado moçambicano/africano se existirem).
- Estrutura do pacote de créditos avulsos (preço por crédito, tamanho do pacote, validade).
- Recomendação sobre planos de duração longa (vale a pena? que desconto?).
- Qualquer suposição assumida por falta de dado real (ex.: custo médio de IA por utilizador) deve
  ser explicitada, para ser validada com os dados reais do painel administrativo assim que
  houver volume.
