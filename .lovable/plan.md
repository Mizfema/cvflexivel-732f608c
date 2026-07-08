## Plano para corrigir as falhas de IA no app

O problema é comum a todas as funcionalidades de IA: as respostas do modelo nem sempre vêm no formato JSON exacto esperado pelo código. Quando o modelo devolve campos aninhados, arrays onde o app espera string, nomes alternativos de campos, texto antes/depois do JSON, ou JSON parcial, o Zod rejeita a resposta e a função falha. Isso afecta análise de CV, criação de CV para vaga específica, carta de apresentação, simulação de entrevista e sugestões de IA.

### 1. Centralizar a robustez das respostas de IA
- Criar/ajustar helpers em `src/lib/llm.functions.ts` para:
  - extrair JSON mesmo quando vem dentro de markdown ou texto misturado;
  - reparar erros comuns simples: vírgulas finais, caracteres de controlo, arrays em campos textuais;
  - normalizar strings, arrays, objectos e HTML antes da validação;
  - detectar respostas truncadas e devolver erro amigável.

### 2. Remover o ponto frágil do output estruturado experimental
- Substituir o uso de `experimental_output: Output.object(...)` em geração de CV por entrevista.
- Usar o mesmo padrão mais previsível das outras funções: `generateText` + prompt pedindo JSON + extração/normalização + validação.
- Isto evita que uma falha de validação interna do AI SDK quebre a experiência antes de podermos recuperar a resposta.

### 3. Normalizar cada funcionalidade antes do Zod
Aplicar normalizadores específicos para cada resposta:

- **Análise de cobertura**
  - Garantir `resumo`, `cobertura`, `keywords`, `requisitosEliminatoriosNaoCumpridos`, `totalRequisitos` e `requisitosCobertos` mesmo quando o modelo muda nomes ou omite arrays.
  - Normalizar `score` para 0–3 e `tipo` para um dos valores permitidos.

- **CV para vaga específica / alinhamento CV ↔ TdR**
  - Reaproveitar e reforçar o normalizador existente.
  - Corrigir casos em que `perfil` vem dentro de `sections`, `cv`, `curriculo`, etc.
  - Converter `descricao` em string HTML quando vier como array de bullets.
  - Garantir arrays vazios para secções ausentes.

- **CV gerado por entrevista**
  - Adicionar normalização semelhante ao alinhamento.
  - Converter descrições em HTML seguro.
  - Garantir `perfil`, `experiencia`, `formacao`, `competencias` e `idiomas` sempre presentes.

- **Carta de apresentação**
  - Aceitar respostas como `{ content }`, `{ carta }`, `{ letter }` ou texto HTML directo extraído do JSON.
  - Sanitizar para HTML seguro antes de mostrar/salvar.

- **Simulação de entrevista**
  - Aceitar `{ perguntas }`, `{ questions }` ou array directo.
  - Normalizar categorias para `comportamental`, `tecnica`, `sobre_empresa` ou `eliminatoria`.
  - Garantir pergunta e resposta como strings.

- **Sugestões de campos**
  - Aceitar `{ suggestions }`, `{ sugestoes }` ou array directo.
  - Converter tudo para strings limpas e limitar o resultado ao intervalo esperado.

### 4. Melhorar mensagens de erro para o utilizador
- Trocar erros técnicos enormes de Zod por mensagens claras, por exemplo:
  - “A IA devolveu uma resposta incompleta. Tenta novamente ou reduz o tamanho do CV/TdR.”
  - “A resposta da IA veio num formato inesperado. Já tentámos corrigir automaticamente, mas não foi possível.”
- Manter detalhes técnicos apenas em `console.warn/error` no servidor para depuração.

### 5. Reduzir risco com documentos muito longos
- Truncar/controlar inputs gigantes antes do prompt quando necessário, preservando início, experiência, formação e requisitos principais.
- Isto reduz respostas truncadas e JSON malformado em CVs/TdRs longos.

### 6. Validar o fluxo principal depois da implementação
- Testar pelo menos estes caminhos:
  - analisar CV com TdR;
  - criar CV para vaga específica;
  - gerar carta genérica;
  - gerar carta para vaga específica;
  - gerar preparação/simulação de entrevista.
- Confirmar que o erro vermelho com HTML/JSON bruto deixa de aparecer e que a UI recebe dados utilizáveis.

### Detalhes técnicos
- Principal arquivo a alterar: `src/lib/llm.functions.ts`.
- Não será necessário mexer no banco de dados.
- Não será necessário mudar o provedor de IA nem pedir novas chaves, pois `LOVABLE_API_KEY` já existe.
- O foco é tornar a camada de servidor tolerante a variações reais das respostas da IA, sem inventar dados do candidato.