import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

const MOCK_COVERAGE = {
  resumo:
    "⚠️ MOCK (sem LOVABLE_API_KEY) — Esta é uma resposta simulada para desenvolvimento local. " +
    "O CV cobre parcialmente os requisitos da vaga, com boa experiência em gestão de projectos " +
    "mas lacunas em M&A e ferramentas estatísticas.",
  cobertura: [
    {
      secao: "Experiência Profissional",
      score: 2,
      presentes: ["Gestão de projectos", "Coordenação de equipa", "Relatórios a doadores"],
      emFalta: [
        {
          requisito: "M&A",
          tipo: "tem_nao_mostrou",
          accao_sugerida: "O CV menciona 'relatórios a doadores' — reformula para destacar a componente de monitoria e avaliação (ex: 'Elaboração de relatórios de M&A para doadores').",
        },
        {
          requisito: "Gestão de subvenções",
          tipo: "parcial_transferivel",
          accao_sugerida: "A experiência em 'gestão de orçamento' é adjacente — recontextualiza como 'gestão de subvenções e orçamentos de projecto'.",
        },
      ],
    },
    {
      secao: "Formação Académica",
      score: 3,
      presentes: ["Mestrado relevante", "Licenciatura na área"],
      emFalta: [],
    },
    {
      secao: "Competências Técnicas",
      score: 1,
      presentes: ["Excel", "Word"],
      emFalta: [
        {
          requisito: "SPSS",
          tipo: "lacuna_real",
          accao_sugerida: "Sem evidência no CV. Considera um curso online de SPSS (ex: Coursera, 4-6 semanas) ou menciona na carta de motivação a disponibilidade para aprender.",
        },
        {
          requisito: "Power BI",
          tipo: "lacuna_real",
          accao_sugerida: "Sem evidência no CV. Inscreve-te numa certificação Microsoft Power BI (gratuita no Microsoft Learn) antes de candidatar.",
        },
        {
          requisito: "KoboToolbox",
          tipo: "parcial_transferivel",
          accao_sugerida: "O CV mostra experiência com recolha de dados — recontextualiza mencionando ferramentas digitais de recolha se já usaste alguma.",
        },
      ],
    },
    {
      secao: "Idiomas",
      score: 2,
      presentes: ["Português nativo", "Inglês avançado"],
      emFalta: [
        {
          requisito: "Francês",
          tipo: "lacuna_real",
          accao_sugerida: "Sem evidência de Francês no CV. Declara o teu nível real na carta de motivação (mesmo que básico) ou avalia se esta vaga é adequada dado o requisito linguístico.",
        },
      ],
    },
  ],
  keywords: {
    presentes: ["gestão", "coordenação", "relatórios", "doadores", "ONG"],
    emFalta: ["MEAL", "log-frame", "teoria de mudança", "due diligence", "procurement"],
  },
  requisitosEliminatoriosNaoCumpridos: [
    {
      requisito: "Mínimo 5 anos de experiência em M&A (mock)",
      mitigacao: "Recontextualizar experiência de relatórios como componente de M&A; considerar certificação curta em MEAL.",
    },
  ],
  totalRequisitos: 12,
  requisitosCobertos: 7,
};

const MOCK_CV_SECTIONS = {
  perfil: {
    nome: "Utilizador Mock",
    headline: "Profissional de Desenvolvimento",
    email: "mock@dev.local",
    telefone: "+258 84 000 0000",
    cidade: "Maputo",
    pais: "Moçambique",
    resumo: "⚠️ MOCK — CV gerado localmente sem IA. Profissional com experiência em gestão de projectos no setor de desenvolvimento.",
  },
  experiencia: [
    {
      cargo: "Coordenador de Projecto",
      organizacao: "ONG Mock",
      local: "Maputo",
      inicio: "2020-01",
      fim: "atual",
      descricao: "Coordenação de actividades de projecto e elaboração de relatórios.",
    },
  ],
  formacao: [
    {
      curso: "Licenciatura em Relações Internacionais",
      instituicao: "Universidade Eduardo Mondlane",
      inicio: "2014",
      fim: "2018",
    },
  ],
  competencias: [{ nome: "Gestão de Projectos" }, { nome: "Excel" }],
  idiomas: [
    { idioma: "Português", nivel: "nativo" },
    { idioma: "Inglês", nivel: "avancado" },
  ],
};

export function createLovableAiGatewayProvider(
  lovableApiKey?: string,
  initialRunId?: string,
) {
  if (!lovableApiKey) {
    console.warn("MOCK: LOVABLE_API_KEY ausente, a devolver resposta simulada");
    return createMockProvider();
  }

  let runId = initialRunId?.trim() || undefined;

  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) {
        headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
      }
      const response = await fetch(input, { ...init, headers });
      const next = response.headers.get(LOVABLE_AIG_RUN_ID_HEADER);
      if (!runId && next) runId = next.trim() || undefined;
      return response;
    },
  });

  return provider;
}

function createMockProvider() {
  return createOpenAICompatible({
    name: "lovable-mock",
    baseURL: "https://mock.local/v1",
    fetch: async (_input, init) => {
      const body = JSON.parse((init?.body as string) || "{}");
      const systemMsg: string =
        body.messages?.find((m: { role: string }) => m.role === "system")
          ?.content ?? "";

      const isCoverage =
        systemMsg.includes("cobertura") || systemMsg.includes("recrutamento");
      const mockPayload = isCoverage ? MOCK_COVERAGE : MOCK_CV_SECTIONS;
      const jsonStr = JSON.stringify(mockPayload);

      const hasTools = Array.isArray(body.tools) && body.tools.length > 0;
      const toolName = hasTools ? body.tools[0].function.name : "json";

      const message: Record<string, unknown> = { role: "assistant" };
      if (hasTools) {
        message.content = null;
        message.tool_calls = [
          {
            id: "call_mock_" + Date.now(),
            type: "function",
            function: { name: toolName, arguments: jsonStr },
          },
        ];
      } else {
        message.content = jsonStr;
      }

      return new Response(
        JSON.stringify({
          id: "chatcmpl-mock-" + Date.now(),
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: "mock-dev",
          choices: [{ index: 0, message, finish_reason: "stop" }],
          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    },
  });
}
