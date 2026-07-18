
## Objetivo

Quando o utilizador abrir **/perfil**, ver um cartão com o plano de assinatura ativo (ou pacote avulso / grátis) e ter um botão claro para fazer **upgrade** para um plano superior ao que já tem.

## O que fica visível no /perfil

Novo bloco "A minha assinatura" acima do formulário de dados pessoais, com um dos 4 estados:

- **Premium ativo** — mostra `label` do plano (ex.: "Ilimitado 30 dias"), preço pago, data de expiração e tempo restante formatado (reusar `formatPlanTimeLeft`). Botão **"Fazer upgrade"** só aparece se existir pelo menos um plano superior.
- **Pacote avulso ativo** — mostra créditos restantes + validade. Botões **"Recarregar"** e **"Assinar Premium"**.
- **Grátis** — mostra "Plano grátis" + análises restantes no mês. Botão **"Ver planos"**.
- **Admin** — badge "Premium · Ilimitado (admin)", sem botão de upgrade.

Cada botão navega para `/planos` (fluxo de checkout já existente, não duplicamos lógica de pagamento).

## Regra de upgrade

Um plano é considerado "superior" ao atual quando `effective_price_mzn > effective_price_mzn do plano atual` **e** é do mesmo `kind: subscription_unlimited`. Se o utilizador estiver em avulso/grátis, qualquer `subscription_unlimited` conta como upgrade.

Na `/planos`, quando chegar via `?from=perfil`, marcar o plano atual com badge "O teu plano atual" e desativar o botão de compra desse cartão específico (evita o utilizador re-comprar o mesmo plano por engano). Planos inferiores continuam clicáveis mas ganham um aviso subtil "É inferior ao plano ativo".

## Ficheiros a alterar / criar

**Novo server function** em `src/lib/subscription.functions.ts`:

- `getMyActivePlan` — devolve, para o utilizador autenticado:
  - `tier`: `"premium" | "avulso" | "free" | "admin"`
  - Se premium: `{ plan, label, priceMzn, periodEnd, minutesLeft, periodMinutes }` lido de `subscriptions` (status active mais recente) + `plan_prices`
  - Se avulso: `{ balance, expiresAt, packageId, label }`
  - Se grátis: `{ analysesRemaining }`
  - Se admin: `{}` (flag basta)

  Reutiliza `hasActivePlan`, `getActivePlanTimeLeft`, `getActiveCreditBalance`, `checkIsAdmin` já existentes — nova função só orquestra e junta o `label`/`price` do plano atual via query a `subscriptions.plan` + `plan_prices`.

**Novo componente** `src/components/perfil/ActivePlanCard.tsx`:
- Rende o cartão consoante o `tier`
- Botões usam `<Link to="/planos" search={{ from: "perfil" }}>`

**Alterações em `src/routes/_authenticated/perfil.tsx`**:
- Chamar `getMyActivePlan` no `useEffect` inicial (em paralelo com `getProfile`)
- Renderizar `<ActivePlanCard />` acima do formulário

**Alterações em `src/routes/planos.tsx`**:
- Estender `searchSchema` com `from: z.enum(["perfil"]).optional()`
- Chamar `getMyActivePlan` quando autenticado, guardar `currentPlan`
- Nos cartões de subscription:
  - Se `plan === currentPlan.plan` → botão desativado, badge "O teu plano atual"
  - Se `effective_price_mzn < currentPlan.effective_price_mzn` → nota "Inferior ao plano ativo" (ainda comprável, mas avisa)
- Cartões de credit_pack ficam iguais (avulso é ortogonal a subscription)

## Fora de âmbito

- Sem prorated/refund/troca — na PaySuite (pré-pago) o "upgrade" é literalmente comprar um plano novo; o backend/webhook existente já sobrepõe `current_period_end`, portanto não precisa de novo endpoint.
- Sem cancelamento de plano (nem existe hoje).
- Sem alterações a `plan_prices`, RLS ou schema DB.

## Verificação

- `bun run build` passa
- `/perfil` mostra o cartão correto em cada tier (testar como grátis e como premium)
- Clicar "Fazer upgrade" no /perfil leva a /planos com o plano atual marcado como "atual"
- Comprar um plano superior via /planos continua a funcionar (fluxo PaySuite não muda)
