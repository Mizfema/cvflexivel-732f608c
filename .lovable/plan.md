
# Plano de implementação — CV Flexível

Adaptei o teu plano à stack real deste projeto. Mudanças importantes face ao documento original:

- **Stack**: o projeto **não é** Vite+React clássico — é **TanStack Start** (SSR, file-based routing em `src/routes/`). O esqueleto e o routing já existem.
- **Backend**: Supabase **já está ligado** (Lovable Cloud). Não há "Etapa Liga o Supabase" — passamos diretamente a criar tabelas e RLS.
- **Edge Functions → Server Functions**: nesta stack, lógica servidor vive em `createServerFn` (`src/lib/*.functions.ts`), **não** em Supabase Edge Functions. O `llm-proxy` e o `reliefweb-search` viram server functions.
- **LLM**: usamos o **Lovable AI Gateway** (Gemini 2.5 / GPT-5 incluídos, sem gerir chaves), conforme a tua escolha.
- **Idioma**: tudo em **PT-PT**. EN só na Fase 3.
- **Vagas locais**: filtro por defeito = **Moçambique** (ReliefWeb `country=Mozambique` + tabela `local_jobs`).

A regra de ouro mantém-se: **uma etapa = uma alteração testável**, só avançamos quando a anterior estiver verde.

---

## Fase 0 — Fundação visual e portas

### Etapa 0a — Direções de design (antes de codar)
Antes de mexer em código, gero **3 direções de design** renderizadas (HTML+Tailwind) com:
- Paleta, tipografia e layout fixos a escolher por ti (3 perguntas visuais: cor, fontes, layout).
- 3 variações distintas em composição/densidade/hierarquia/energia.
- Referência: landing de `/` + preview do `/editor`.

Tu escolhes uma direção. Os tokens dessa direção são copiados para `src/styles.css` (paletas, fontes, raio, sombras) e usados em todo o app. As 5 paletas / 4 fontes / 3 densidades do plano original ficam para a Etapa 6 (personalização do CV em si, não da app).

**Pronto quando:** uma direção escolhida, tokens em `src/styles.css`, header com logo "CV Flexível" aplicado.

### Etapa 0b — Esqueleto de rotas
Criar rotas vazias em `src/routes/`:
- `index.tsx` (já existe — substituir placeholder)
- `editor.tsx`
- `analise.tsx`
- `vagas.tsx`
- `_authenticated/admin.tsx` (gate de role admin via `has_role`)

Cada rota com `head()` próprio (title/description PT-PT). Header partilhado em `__root.tsx`.

**Pronto quando:** as 4 rotas navegam e renderizam o layout base.

### Etapa 1 — Landing com 4 portas
Em `/`:
- Headline: *"Descobre o que a vaga realmente avalia — e alinha o teu CV."*
- Sub: *"Para vagas de ONGs, desenvolvimento, consultoria e administração pública. Em português."*
- 4 cartões (porta 1 com mais peso visual):
  1. Tenho CV + vaga → `/editor?modo=cv-vaga`
  2. Tenho CV, sem vaga → `/editor?modo=cv`
  3. Tenho vaga, sem CV → `/editor?modo=entrevista-vaga`
  4. Não tenho nada → `/editor?modo=entrevista-zero`
- Microcopy: *"Sem registo. Nesta fase nem te pedimos o CV."*
- **Sem login em lado nenhum.**

**Pronto quando:** as 4 portas levam ao editor com o modo correto na query string.

---

## Fase 1 — Schema + persistência anónima

### Etapa 2 — Schema Supabase + RLS + rascunho local

**Migration única** (vai pedir aprovação tua antes de correr):

Tabelas (todas com RLS, GRANTs corretos, `created_at`/`updated_at`):
- `profiles` — `id (FK auth.users)`, `full_name`, `email`, `phone`, `city`, `country`, `linkedin`, `website`, `headline`
- `cvs` — `user_id`, `title`, `sections jsonb`, `template`, `design jsonb`
- `analyses` — `cv_id`, `job_tdr text`, `coverage jsonb`
- `cover_letters` — `cv_id`, `job_tdr`, `content`
- `interview_preps` — `cv_id`, `job_tdr`, `questions jsonb`
- `local_jobs` — campos do plano + `is_active`, `country` default `'Mozambique'`
- `reliefweb_cache` — `payload jsonb`, `fetched_at`
- `user_roles` (enum `app_role`: `admin`, `user`) + função `has_role(uuid, app_role)` security definer

RLS:
- Tabelas pessoais: `auth.uid() = user_id`
- `local_jobs`: SELECT público (anon+authenticated), INSERT/UPDATE/DELETE só `has_role(auth.uid(),'admin')`
- `user_roles`: SELECT só authenticated; sem self-grant

**Rascunho anónimo:** `localStorage` com chave `cv-flexivel:draft`. Hook `useDraftCv()` que faz merge + sync. Ao fazer login (Etapa 7), migrar draft → tabela `cvs`.

**Pronto quando:** migration aprovada, edito qualquer campo (placeholder), recarrego, persiste.

---

## Fase 2 — Editor e análise (núcleo do produto)

### Etapa 3 — Editor de CV
`/editor` com:
- **Coluna esquerda** (mobile: tab "Editar"): secções editáveis — Perfil, Experiência[], Formação[], Competências[], Idiomas[]; botão "Adicionar secção" (Cursos, Estágios, Certificados, Realizações, Atividades, Qualidades).
- **Coluna direita** (mobile: tab "Pré-ver"): preview ao vivo do CV.
- Resumo com rich-text leve (TipTap minimal: bold, itálico, listas).
- Estado central via Zustand (ou `useReducer` + Context) → escreve em `useDraftCv`.

**Pronto quando:** edito qualquer campo, preview atualiza, persiste em reload.

### Etapa 4 — Server function `analyze-coverage` + `/analise`
- `src/lib/llm.functions.ts` → `analyzeCoverage({ cv, jobTdr })` usando `createServerFn` + Lovable AI Gateway (`google/gemini-3-flash-preview`).
- Schema de saída (Zod / `Output.object`):
  ```
  { sections: { [secao]: { score, presentes[], emFalta[] } },
    requisitosEliminatoriosNaoCumpridos: [{requisito, mitigacao}],
    keywords: { presentes[], emFalta[] } }
  ```
- Página `/analise`: cole de TdR + botão "Analisar". Mostra cobertura por secção, keywords, eliminatórios. **Sem "probabilidade de entrevista"** — só "cobertura X de Y".
- Se logado, guarda em `analyses`. Se anónimo, guarda no draft local.
- Botão "Voltar a analisar" recalcula.

**Pronto quando:** colo TdR e vejo análise honesta, com lista de eliminatórios e mitigações.

### Etapa 5 — Modo entrevista guiada
- Server function `generateCvFromInterview({ answers, jobTdr? })` (action `generate_cv`).
- UI conversacional mobile-first em `/editor` quando `?modo=entrevista-*`: perguntas curtas em passos.
- Se há TdR: perguntas são direcionadas aos requisitos.
- **Nunca inventar experiência** — system prompt obriga a só transformar (não fabricar). Se faltar info, pergunta de novo.
- Ao terminar, preenche o editor; user pode editar tudo.

**Pronto quando:** sem CV inicial, respondo a 8–12 perguntas e o editor fica preenchido com texto profissional ancorado nas minhas respostas.

### Etapa 6 — Templates + personalização visual do CV
Modal "Escolher template":
- **Tab ATS** (Clássico, Moderno, Compacto): 1 coluna, sem tabelas/imagens/ícones/sidebars. Rótulo: *"Legibilidade máxima — 6 verificações OK"* (nunca "garantido ATS").
- **Tab Visual**: layouts com sidebar.

Modal "Personalização": 4 fontes (Inter, Lato, Georgia, Source Serif), 5 paletas (Ardósia, Marinho, Esmeralda, Bordeaux, Grafite — todas WCAG AA), 3 densidades (Compacto/Normal/Espaçoso). Aplica em tempo real à preview e guarda em `cvs.design`.

**Pronto quando:** trocar template/fonte/paleta/densidade muda a preview imediatamente.

### Etapa 7 — Exportar PDF/DOCX + login (único gate)
- Botão "Descarregar".
- Se anónimo: modal pede **magic link** (Supabase Auth, email/password também disponível). Após login: server function migra `localStorage` draft → `cvs` (insert) + cria `profiles` se faltar.
- Geração:
  - **PDF**: `@react-pdf/renderer` no cliente, com texto **estruturado real** (não screenshot).
  - **DOCX**: lib `docx` no cliente.
- Ambos a partir de `cv.sections`. Verificar que parsers ATS extraem texto.
- Permite "Guardar como versão" (`title` editável, ex.: *"CV — Coordenador World Vision"*).

**Pronto quando:** login só ao exportar, PDF abre num parser e o texto sai limpo, versão fica na conta.

### Etapa 8 — Carta de apresentação
- Server function `generateCoverLetter({ cv, jobTdr })`.
- Botão em `/editor` ou `/analise`: "Gerar carta" → editor de texto com a carta, botão exportar PDF/DOCX.
- Guarda em `cover_letters`.

**Pronto quando:** gero, edito e exporto carta ligada à vaga.

### Etapa 9 — Preparação de entrevista
- Server function `generateInterviewQa({ cv, jobTdr, coverage })`.
- Gera perguntas focadas em **fraquezas detetadas** (eliminatórios, keywords em falta), por competência (STAR), específicas do setor (incl. safeguarding quando aplicável).
- Devolve **pontos de discurso**, não guiões. Aviso visível: *"Articula com palavras tuas; nunca inventes."*
- Guarda em `interview_preps`.

**Pronto quando:** vejo perguntas dirigidas às minhas lacunas com pontos estruturados.

---

## Fase 3 — Painel de vagas (Moçambique)

### Etapa 10 — Painel ReliefWeb
- Server function `searchReliefweb({ filters })` — chama API pública ReliefWeb com `country=Mozambique` por defeito + filtros derivados do perfil (categoria, experiência, tema). Cache em `reliefweb_cache` (TTL 1h).
- `/vagas`: lista vagas alinhadas, mostra organização, localização, **data de fecho sempre visível**.
- Rótulo: *"Vagas do setor de desenvolvimento, via ReliefWeb"*.
- Botão "Usar como alvo" → `/editor?modo=cv-vaga&jobId=...` (TdR pré-carregado).

**Pronto quando:** vejo vagas de Moçambique relevantes e envio uma para o editor como TdR.

### Etapa 11 — Admin de vagas locais
- `/admin` em `_authenticated/` + check `has_role(auth.uid(),'admin')`.
- Formulário rápido para `local_jobs` (todos os campos, foco em poucos cliques).
- Vagas locais aparecem em `/vagas` lado a lado com ReliefWeb, mesmo matching.
- Trigger SQL ou query filter: vagas com `closing_date < now()` → `is_active=false` (não aparecem).

**Pronto quando:** insiro vaga local em <1 min, aparece no painel; vagas expiradas desaparecem.

---

## Fase 4 — Só com tração

### Etapa 12 — Monetização, EN, polimento
- Freemium: análise + painel grátis; otimização de CV/carta/preparação + exportar/versões ilimitadas = pago.
- Pagamentos: Stripe (ou alternativa local moçambicana se preferires — M-Pesa exigiria gateway terceiro, posso investigar se quiseres).
- Geração CV/carta em EN (toggle no editor; AI traduz mantendo factos).
- Política de privacidade clara + opção *"não guardar"* (modo zero-retention).
- Onboarding e empty states.

---

## Detalhes técnicos (referência)

```text
src/
├── routes/
│   ├── __root.tsx          (header, providers)
│   ├── index.tsx           (landing — 4 portas)
│   ├── editor.tsx          (editor + entrevista guiada)
│   ├── analise.tsx
│   ├── vagas.tsx
│   ├── _authenticated.tsx  (gate auth)
│   └── _authenticated/admin.tsx
├── lib/
│   ├── llm.functions.ts        (analyze, generate_cv, cover_letter, interview_qa)
│   ├── reliefweb.functions.ts  (search + cache)
│   ├── ai-gateway.server.ts    (helper Lovable AI)
│   ├── draft.ts                (localStorage + migrate)
│   └── pdf/, docx/             (geradores estruturados)
├── components/
│   ├── editor/                 (sections, preview, template-modal)
│   ├── analise/                (coverage cards)
│   └── vagas/                  (job-card, filters)
└── styles.css                  (tokens da direção escolhida + paletas CV)
```

**Auth**: Supabase magic link via `supabase.auth.signInWithOtp`. Trigger `on_auth_user_created` cria `profiles` automaticamente. `user_roles` separada (security definer `has_role`).

**RLS**: padrão `auth.uid() = user_id` em tabelas pessoais; `local_jobs` SELECT público + admin-only writes via `has_role`.

**AI Gateway**: provider helper em `src/lib/ai-gateway.server.ts`, modelo padrão `google/gemini-3-flash-preview`. Erros 429/402 surfaced na UI com mensagens claras.

**Geração PDF/DOCX**: 100% client-side a partir de dados estruturados — texto real, nunca screenshot. Templates ATS validados num parser real (jsPDF não, `@react-pdf` sim).

---

## Ordem resumida

0a Direções de design → 0b Rotas → 1 Landing 4 portas → 2 Schema+rascunho → 3 Editor → 4 Análise → 5 Entrevista guiada → 6 Templates+visual → 7 Export+login → 8 Carta → 9 Prep entrevista → 10 ReliefWeb (Moçambique) → 11 Admin local → 12 Monetização/EN.

**Próximo passo se aprovares:** começo pela **Etapa 0a** — gero 3 direções de design renderizadas, fazendo-te 3 perguntas visuais (paleta, tipografia, layout) antes.
