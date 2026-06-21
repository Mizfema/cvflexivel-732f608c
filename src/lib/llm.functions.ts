import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import type { CvDraft } from "./cv-types";
import type { CoverageAnalysis } from "./coverage-types";

const inputSchema = z.object({
  cv: z.any(),
  jobTdr: z.string().min(20, "Cola um TdR mais detalhado."),
});

const outputSchema = z.object({
  resumo: z
    .string()
    .describe(
      "2-3 frases em PT-PT a explicar a cobertura geral, sem inventar probabilidades de entrevista.",
    ),
  cobertura: z.array(
    z.object({
      secao: z.string(),
      score: z.number().int().min(0).max(3),
      presentes: z.array(z.string()),
      emFalta: z.array(
        z.object({
          requisito: z.string().describe("O requisito em falta."),
          tipo: z
            .enum(["tem_nao_mostrou", "parcial_transferivel", "lacuna_real"])
            .describe(
              "tem_nao_mostrou = CV tem evidência clara mas não a destaca; " +
              "parcial_transferivel = experiência relacionada mas não idêntica; " +
              "lacuna_real = sem qualquer evidência no CV.",
            ),
          accao_sugerida: z
            .string()
            .describe(
              "Para tem_nao_mostrou: sugere reformulação/destaque no CV. " +
              "Para parcial_transferivel: sugere como recontextualizar a experiência adjacente. " +
              "Para lacuna_real: sugere APENAS vias legítimas (curso, certificação, menção na carta, declarar nível real) " +
              "— NUNCA instruas a adicionar ao CV algo que não existe.",
            ),
        }),
      ),
    }),
  ),
  keywords: z.object({
    presentes: z.array(z.string()),
    emFalta: z.array(z.string()),
  }),
  requisitosEliminatoriosNaoCumpridos: z.array(
    z.object({
      requisito: z.string(),
      mitigacao: z.string(),
    }),
  ),
  totalRequisitos: z.number().int().min(0),
  requisitosCobertos: z.number().int().min(0),
});

function cvToText(cv: CvDraft): string {
  const p = cv.sections.perfil;
  const lines: string[] = [];
  lines.push(`# ${p.nome || "Sem nome"} — ${p.headline || ""}`.trim());
  if (p.resumo) lines.push(`\nResumo: ${p.resumo}`);
  if (cv.sections.experiencia.length) {
    lines.push("\n## Experiência");
    cv.sections.experiencia.forEach((e) => {
      lines.push(
        `- ${e.cargo} · ${e.organizacao} (${e.inicio || ""}—${e.fim || ""}) ${e.local || ""}`,
      );
      if (e.descricao) lines.push(`  ${e.descricao}`);
    });
  }
  if (cv.sections.formacao.length) {
    lines.push("\n## Formação");
    cv.sections.formacao.forEach((f) =>
      lines.push(
        `- ${f.curso} · ${f.instituicao} (${f.inicio || ""}—${f.fim || ""})`,
      ),
    );
  }
  if (cv.sections.competencias.length) {
    lines.push(
      "\n## Competências: " +
        cv.sections.competencias.map((c) => c.nome).join(", "),
    );
  }
  if (cv.sections.idiomas.length) {
    lines.push(
      "\n## Idiomas: " +
        cv.sections.idiomas.map((i) => `${i.idioma} (${i.nivel || "?"})`).join(", "),
    );
  }
  cv.sections.extras.forEach((sec) => {
    lines.push(`\n## ${sec.titulo}`);
    sec.itens.forEach((it) =>
      lines.push(`- ${it.titulo}${it.descricao ? " — " + it.descricao : ""}`),
    );
  });
  return lines.join("\n");
}

const SYSTEM = `És um especialista em recrutamento para ONGs, desenvolvimento, consultoria e administração pública em Moçambique e PALOP. Analisas a cobertura entre um CV e os Termos de Referência (TdR) de uma vaga.

Regras absolutas:
- Responde sempre em PORTUGUÊS EUROPEU (PT-PT).
- Nunca inventes experiência que não está no CV.
- Nunca dês "probabilidade de entrevista" — só cobertura objectiva.
- Sê honesto: se há requisito eliminatório não cumprido, diz claramente e sugere mitigação realista (formação, voluntariado, recontextualização).
- Score por secção: 0=ausente, 1=fraco, 2=parcial, 3=totalmente coberto.
- "keywords" = termos técnicos do TdR (ferramentas, metodologias, sectores). Compara contra o texto do CV.
- "requisitosEliminatoriosNaoCumpridos" = só requisitos que o TdR marca como obrigatórios E que o CV não satisfaz.
- totalRequisitos / requisitosCobertos = contagem honesta sobre o conjunto de requisitos extraídos do TdR.

Classificação de cada requisito em falta (campo "emFalta" dentro de cada secção):
Para cada requisito que o CV não cobre totalmente, procura no CV evidência directa ou adjacente e classifica:
- "tem_nao_mostrou": o CV contém evidência clara deste requisito, mas não a destaca ou formula adequadamente. Sugere reformulação.
- "parcial_transferivel": o CV mostra experiência relacionada mas não idêntica. Sugere como recontextualizar essa experiência.
- "lacuna_real": não existe qualquer evidência no CV. NUNCA sugiras adicionar ao CV algo que não existe. Sugere APENAS vias legítimas: curso, certificação, menção na carta de motivação, declarar o nível/estado real, ou avaliar a adequação à vaga.`;

function extractJson(response: string): unknown {
  let cleaned = response
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  const start = cleaned.search(/[\{\[]/);
  if (start === -1) throw new Error("Resposta sem JSON.");
  const openChar = cleaned[start];
  const closeChar = openChar === "[" ? "]" : "}";
  const end = cleaned.lastIndexOf(closeChar);
  if (end === -1) throw new Error("JSON truncado na resposta.");
  cleaned = cleaned.substring(start, end + 1);
  try {
    return JSON.parse(cleaned);
  } catch {
    const repaired = cleaned
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      .replace(/[\x00-\x1F\x7F]/g, " ");
    return JSON.parse(repaired);
  }
}

export const analyzeCoverage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<CoverageAnalysis> => {
    const gateway = createLovableAiGatewayProvider(process.env.LOVABLE_API_KEY!);

    const cvText =
      typeof data.cv === "string" ? data.cv : cvToText(data.cv as CvDraft);
    const prompt = `## CV do candidato\n${cvText}\n\n## Termos de Referência da vaga\n${data.jobTdr}\n\nResponde APENAS com um objecto JSON válido (sem markdown, sem comentários, sem texto antes ou depois) com esta forma exacta:
{
  "resumo": string,
  "cobertura": [{ "secao": string, "score": 0|1|2|3, "presentes": string[], "emFalta": [{ "requisito": string, "tipo": "tem_nao_mostrou"|"parcial_transferivel"|"lacuna_real", "accao_sugerida": string }] }],
  "keywords": { "presentes": string[], "emFalta": string[] },
  "requisitosEliminatoriosNaoCumpridos": [{ "requisito": string, "mitigacao": string }],
  "totalRequisitos": number,
  "requisitosCobertos": number
}`;

    const callOnce = async () => {
      const { text } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system: SYSTEM,
        prompt,
      });
      const json = extractJson(text);
      return outputSchema.parse(json) as CoverageAnalysis;
    };

    try {
      try {
        return await callOnce();
      } catch (e) {
        console.warn("analyzeCoverage: 1ª tentativa falhou, a repetir.", e);
        return await callOnce();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429"))
        throw new Error("Limite de pedidos atingido. Tenta de novo dentro de 1 minuto.");
      if (msg.includes("402"))
        throw new Error("Créditos de AI esgotados nesta workspace. Adiciona créditos para continuar.");
      throw new Error(`Falha na análise: ${msg}`);
    }
  });

// =================== Entrevista guiada ===================

const interviewInputSchema = z.object({
  answers: z.array(
    z.object({
      pergunta: z.string(),
      resposta: z.string(),
    }),
  ),
  jobTdr: z.string().optional(),
});

const cvDraftSectionsSchema = z.object({
  perfil: z.object({
    nome: z.string().default(""),
    headline: z.string().default(""),
    email: z.string().default(""),
    telefone: z.string().default(""),
    cidade: z.string().default(""),
    pais: z.string().default("Moçambique"),
    linkedin: z.string().optional(),
    website: z.string().optional(),
    resumo: z.string().optional(),
  }),
  experiencia: z.array(
    z.object({
      cargo: z.string(),
      organizacao: z.string(),
      local: z.string().optional(),
      inicio: z.string().optional(),
      fim: z.string().optional(),
      descricao: z.string().optional(),
    }),
  ),
  formacao: z.array(
    z.object({
      curso: z.string(),
      instituicao: z.string(),
      local: z.string().optional(),
      inicio: z.string().optional(),
      fim: z.string().optional(),
      descricao: z.string().optional(),
    }),
  ),
  competencias: z.array(z.object({ nome: z.string() })),
  idiomas: z.array(
    z.object({
      idioma: z.string(),
      nivel: z
        .enum(["basico", "intermedio", "avancado", "fluente", "nativo"])
        .optional(),
    }),
  ),
});

const INTERVIEW_SYSTEM = `És um redator de CVs especializado em ONGs, desenvolvimento, consultoria e administração pública em Moçambique e PALOP. Transformas respostas de entrevista em conteúdo estruturado de CV.

Regras absolutas:
- Responde sempre em PORTUGUÊS EUROPEU (PT-PT).
- NUNCA inventes experiência, datas, organizações, formação, certificações ou números. Se a pessoa não disse, deixa em branco.
- Podes reformular, profissionalizar e estruturar — não podes acrescentar factos.
- Para "descricao" das experiências, usa bullets curtos começando por verbos de ação (Coordenei, Implementei, Geri), só com informação que veio na entrevista.
- "resumo" do perfil: 2-3 frases ancoradas estritamente no que foi dito.
- Se o utilizador deu nome, contactos, cidade, usa-os tal e qual.
- Se houve TdR, prioriza realçar competências/experiências da pessoa que se cruzam com o TdR — sem fabricar.`;

export const generateCvFromInterview = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => interviewInputSchema.parse(input))
  .handler(async ({ data }) => {
    const gateway = createLovableAiGatewayProvider(process.env.LOVABLE_API_KEY);

    const answersBlock = data.answers
      .map((a, i) => `P${i + 1}: ${a.pergunta}\nR${i + 1}: ${a.resposta}`)
      .join("\n\n");

    const prompt = [
      "## Respostas da entrevista",
      answersBlock,
      data.jobTdr ? `\n## Termos de Referência da vaga\n${data.jobTdr}` : "",
      "\nGera as secções do CV em JSON estruturado, ancorado nestas respostas.",
    ].join("\n");

    try {
      const { experimental_output } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system: INTERVIEW_SYSTEM,
        prompt,
        experimental_output: Output.object({ schema: cvDraftSectionsSchema }),
      });
      return experimental_output;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429"))
        throw new Error("Limite de pedidos atingido. Tenta dentro de 1 minuto.");
      if (msg.includes("402"))
        throw new Error("Créditos de AI esgotados nesta workspace.");
      throw new Error(`Falha a gerar CV: ${msg}`);
    }
  });

