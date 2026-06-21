import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import type { CvDraft, CvSections, AlignmentResult } from "./cv-types";
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

// =================== Alinhamento CV ↔ TdR ===================

const alignInputSchema = z.object({
  cv: z.string().min(20, "Cola ou carrega um CV mais completo."),
  jobTdr: z.string().min(20, "Cola um TdR mais detalhado."),
});

const alignOutputSchema = z.object({
  perfil: z.object({
    nome: z.string(),
    headline: z.string(),
    email: z.string(),
    telefone: z.string(),
    cidade: z.string(),
    pais: z.string(),
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
  alteracoes: z.array(
    z.object({
      tipo: z
        .enum(["reformulado", "recontextualizado"])
        .describe(
          "reformulado = texto reescrito para usar terminologia do TdR, sem mudar o significado. " +
          "recontextualizado = experiência adjacente reposicionada para evidenciar relevância ao TdR.",
        ),
      campo: z
        .string()
        .describe("Secção e item afectado, e.g. 'Experiência · UNICEF — Gestor de Projectos' ou 'Perfil · headline'."),
      de: z.string().describe("Texto original (trecho relevante, não o campo inteiro)."),
      para: z.string().describe("Texto reescrito correspondente."),
      justificacao: z
        .string()
        .describe("1 frase curta a explicar porquê — que requisito do TdR esta alteração visa cobrir."),
    }),
  ),
});

const ALIGN_SYSTEM = `És um redator de CVs especializado em ONGs, desenvolvimento, consultoria e administração pública em Moçambique e PALOP. Recebes um CV existente e os Termos de Referência (TdR) de uma vaga, e REESCREVES o CV para o alinhar ao máximo com o TdR — usando EXCLUSIVAMENTE informação que já consta no CV de entrada.

Princípio central — ZERO INVENÇÃO:
O CV de saída é uma reformulação do CV de entrada, nunca uma ampliação. Tudo o que escreveres tem de ter origem verificável no texto do CV original. Se um requisito do TdR não tem qualquer suporte no CV, NÃO o adiciones — simplesmente omite-o.

O que NUNCA podes fazer:
- Inventar experiência profissional, projectos, cargos, organizações ou sectores que não existam no CV.
- Inventar ou alterar datas (anos de início/fim, duração).
- Inventar formação académica, cursos, certificações ou graus.
- Inventar idiomas ou alterar níveis de proficiência declarados.
- Inventar ferramentas, softwares, metodologias ou frameworks que o candidato não mencionou.
- Inventar resultados quantitativos (percentagens, valores monetários, números de beneficiários) não presentes no CV.
- Adicionar competências que não se podem derivar directamente da experiência descrita no CV.

O que DEVES fazer (dentro do que existe):
- Reformular títulos de cargos para usar a terminologia do TdR, quando o cargo original for equivalente.
- Reescrever descrições de experiência para realçar as competências e responsabilidades pedidas no TdR que o candidato efectivamente exerceu.
- Reordenar secções e experiências para que as mais relevantes ao TdR apareçam primeiro.
- Ajustar o "headline" para reflectir o cargo/área da vaga, mantendo-se fiel ao perfil real.
- Reescrever o "resumo" do perfil (2-3 frases) orientado à vaga, ancorado na experiência real.
- Para "descricao", usar bullets curtos começando por verbos de ação (Coordenei, Implementei, Geri), realçando resultados e competências relevantes ao TdR que já existam no CV.
- Priorizar em "competencias" as que casam com o TdR — sem acrescentar novas.
- Se o CV contém informação dispersa (cursos, certificações, voluntariado) que não encaixa nas secções standard, incorporá-la na secção mais relevante.

Dados pessoais:
Mantém TODOS os dados pessoais (nome, email, telefone, cidade, país, linkedin, website) exactamente como estão no CV original.

Registo de alterações ("alteracoes"):
Para CADA mudança significativa que fizeres, adiciona uma entrada no array "alteracoes":
- tipo "reformulado": reescreveste texto para usar terminologia do TdR sem mudar o significado factual.
- tipo "recontextualizado": reposicionaste experiência adjacente para evidenciar relevância a um requisito do TdR.
- "campo": identifica a secção e o item (ex: "Experiência · UNICEF — Gestor de Projectos", "Perfil · headline").
- "de": trecho original relevante (não o campo inteiro — só a parte que mudou).
- "para": o trecho reescrito correspondente.
- "justificacao": 1 frase curta explicando que requisito do TdR esta alteração visa cobrir.
Não registes mudanças triviais (pontuação, capitalização). Regista apenas alterações substantivas.

Responde sempre em PORTUGUÊS EUROPEU (PT-PT).`;

export const alignCvToTdr = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => alignInputSchema.parse(input))
  .handler(async ({ data }): Promise<AlignmentResult> => {
    const gateway = createLovableAiGatewayProvider(process.env.LOVABLE_API_KEY);

    const prompt = `## CV actual do candidato\n${data.cv}\n\n## Termos de Referência da vaga\n${data.jobTdr}\n\nReescreve o CV para o alinhar ao máximo com este TdR. Devolve o CV reestruturado em JSON, incluindo o array "alteracoes" com cada mudança substantiva.`;

    try {
      const { experimental_output } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system: ALIGN_SYSTEM,
        prompt,
        experimental_output: Output.object({ schema: alignOutputSchema }),
      });

      const raw = experimental_output as z.infer<typeof alignOutputSchema>;

      const addId = () => crypto.randomUUID();
      const sections: CvSections = {
        perfil: {
          nome: raw.perfil.nome,
          headline: raw.perfil.headline,
          email: raw.perfil.email,
          telefone: raw.perfil.telefone,
          cidade: raw.perfil.cidade,
          pais: raw.perfil.pais || "Moçambique",
          linkedin: raw.perfil.linkedin,
          website: raw.perfil.website,
          resumo: raw.perfil.resumo,
        },
        experiencia: raw.experiencia.map((e) => ({ id: addId(), ...e })),
        formacao: raw.formacao.map((f) => ({ id: addId(), ...f })),
        competencias: raw.competencias.map((c) => ({ id: addId(), ...c })),
        idiomas: raw.idiomas.map((i) => ({ id: addId(), ...i })),
        extras: [],
      };

      return {
        sections,
        alteracoes: (raw.alteracoes ?? []).map((a) => ({
          tipo: a.tipo,
          campo: a.campo,
          de: a.de,
          para: a.para,
          justificacao: a.justificacao,
        })),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429"))
        throw new Error("Limite de pedidos atingido. Tenta dentro de 1 minuto.");
      if (msg.includes("402"))
        throw new Error("Créditos de AI esgotados nesta workspace.");
      throw new Error(`Falha ao alinhar CV: ${msg}`);
    }
  });

