# Plano — Página de login premium

## Objetivo
Transformar `/auth` numa página visualmente marcante, adicionar login/cadastro com Google, e botão de ver palavra-passe.

## Mudanças

### 1. `src/routes/auth.tsx` (refatorar)
- **Layout split-screen** (`grid lg:grid-cols-2`):
  - **Esquerda (visual)**: fundo creme/navy com:
    - Marcas d'água de CVs modernos flutuando (3-4 cartões `<div>` estilizados representando seções de CV — header com avatar, barras de skills, linhas de experiência), rotacionados e sobrepostos, com `opacity-40` e `blur-sm` nos de trás.
    - Animação flutuante suave (`@keyframes float` em `styles.css`).
    - Gradiente radial navy → cream + blobs desfocados (`bg-gradient-radial`, `blur-3xl`).
    - Grid pattern sutil sobreposto.
    - Citação/tagline: "O teu CV, adaptado a cada vaga."
  - **Direita (formulário)**: card centralizado mantendo identidade serif/navy atual.
- **Mostrar senha**: ícone `Eye`/`EyeOff` (lucide) dentro do input à direita, alterna `type` entre `password`/`text`.
- **Google OAuth**:
  - Botão `Continuar com Google` no topo do formulário (com ícone SVG do Google).
  - Divisor "ou" entre Google e email.
  - Handler: `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth' }})`.
- Em mobile (`<lg`): só a coluna direita visível, com fundo simplificado (gradiente + 1-2 watermarks).

### 2. `src/styles.css`
- Adicionar `@keyframes float` (translateY suave 6s ease-in-out infinite, com delays diferentes via classes utility).
- Classe `.cv-watermark` para os cartões decorativos.

### 3. Habilitar provedor Google no Supabase
- Chamar `supabase--configure_social_auth` com provider `google` (requer ação do utilizador no dashboard Supabase + Google Cloud Console; será explicado no chat).

## Fora de escopo
- Reset de palavra-passe (não pedido).
- Outros provedores (Apple, GitHub).
- Alterar lógica de redirect/sessão existente.

## Ficheiros tocados
- `src/routes/auth.tsx` (refatorado)
- `src/styles.css` (keyframes float)
