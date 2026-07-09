import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { optionalIdentity, requireUsageAllowed } from "./access-control.server";
import type { CvDraft, CvSections, AlignmentResult } from "./cv-types";
import type { CoverageAnalysis } from "./coverage-types";
import type { InterviewQuestion } from "./interview-types";
import type { CoverLetterMode, GeneratedCoverLetter } from "./cover-letter-types";
import { htmlToPlainText, toSafeHtml } from "./rich-text";

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

function normalizeGapType(value: unknown): "tem_nao_mostrou" | "parcial_transferivel" | "lacuna_real" {
  const raw = asString(value).toLowerCase();
  if (raw.includes("transfer") || raw.includes("adjacent") || raw.includes("parcial")) {
    return "parcial_transferivel";
  }
  if (raw.includes("real") || raw.includes("ausente") || raw.includes("lacuna") || raw.includes("missing")) {
    return "lacuna_real";
  }
  return "tem_nao_mostrou";
}

function normalizeCoverageJson(value: unknown): unknown {
  const root = asRecord(value);
  const source = asRecord(root.analysis ?? root.analise ?? root.análise ?? root.result ?? root);
  const coberturaRaw = normalizeArray(
    source.cobertura ?? source.coverage ?? source.seccoes ?? source.seções ?? source.sections,
  );
  const keywords = asRecord(source.keywords ?? source.palavras_chave ?? source.palavrasChave);
  const eliminatorios = normalizeArray(
    source.requisitosEliminatoriosNaoCumpridos ??
      source.requisitos_eliminatorios_nao_cumpridos ??
      source.eliminatorios ??
      source.requisitosObrigatoriosNaoCumpridos,
  );

  const cobertura = coberturaRaw.map((item) => {
    const c = asRecord(item);
    const emFalta = normalizeArray(c.emFalta ?? c.em_falta ?? c.missing ?? c.gaps).map((gap) => {
      const g = asRecord(gap);
      return {
        requisito: asString(g.requisito ?? g.requirement ?? g.nome ?? gap) || "Requisito em falta",
        tipo: normalizeGapType(g.tipo ?? g.type),
        accao_sugerida: asString(
          g.accao_sugerida ?? g.ação_sugerida ?? g.acao_sugerida ?? g.sugestao ?? g.suggestion,
        ),
      };
    });
    return {
      secao: asString(c.secao ?? c.secção ?? c.section ?? c.nome) || "Secção",
      score: clampNumber(c.score ?? c.pontuacao ?? c.pontuação, 0, 3, 0),
      presentes: normalizeArray(c.presentes ?? c.found ?? c.cobertos).map(asString).filter(Boolean),
      emFalta,
    };
  });

  const presentes = normalizeArray(keywords.presentes ?? keywords.found ?? keywords.cobertas)
    .map(asString)
    .filter(Boolean);
  const emFalta = normalizeArray(keywords.emFalta ?? keywords.em_falta ?? keywords.missing)
    .map(asString)
    .filter(Boolean);
  const total = clampNumber(source.totalRequisitos ?? source.total_requisitos, 0, 999, cobertura.length);
  const covered = clampNumber(
    source.requisitosCobertos ?? source.requisitos_cobertos,
    0,
    total || 999,
    cobertura.filter((c) => c.score >= 2).length,
  );

  return {
    resumo: asString(source.resumo ?? source.summary) || "Análise concluída com base no CV e no TdR fornecidos.",
    cobertura,
    keywords: { presentes, emFalta },
    requisitosEliminatoriosNaoCumpridos: eliminatorios.map((item) => {
      const r = asRecord(item);
      return {
        requisito: asString(r.requisito ?? r.requirement ?? r.nome ?? item),
        mitigacao: asString(r.mitigacao ?? r.mitigação ?? r.mitigation ?? r.sugestao),
      };
    }),
    totalRequisitos: total,
    requisitosCobertos: covered,
  };
}

function cvToText(cv: CvDraft): string {
  const p = cv.sections.perfil;
  const lines: string[] = [];
  lines.push(`# ${p.nome || "Sem nome"} — ${p.headline || ""}`.trim());
  if (p.resumo) lines.push(`\nResumo: ${htmlToPlainText(p.resumo)}`);
  if (cv.sections.experiencia.length) {
    lines.push("\n## Experiência");
    cv.sections.experiencia.forEach((e) => {
      lines.push(
        `- ${e.cargo} · ${e.organizacao} (${e.inicio || ""}—${e.fim || ""}) ${e.local || ""}`,
      );
      if (e.descricao) lines.push(`  ${htmlToPlainText(e.descricao)}`);
    });
  }
  if (cv.sections.formacao.length) {
    lines.push("\n## Formação");
    cv.sections.formacao.forEach((f) =>
      lines.push(`- ${f.curso} · ${f.instituicao} (${f.inicio || ""}—${f.fim || ""})`),
    );
  }
  if (cv.sections.competencias.length) {
    lines.push("\n## Competências: " + cv.sections.competencias.map((c) => c.nome).join(", "));
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
      lines.push(`- ${it.titulo}${it.descricao ? " — " + htmlToPlainText(it.descricao) : ""}`),
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
  if (!cleaned) throw new Error("Resposta vazia da IA.");

  try {
    return JSON.parse(cleaned);
  } catch {
    // continue with boundary extraction below
  }

  const start = cleaned.search(/[\{\[]/);
  if (start === -1) throw new Error("Resposta sem JSON.");
  const openChar = cleaned[start];
  const closeChar = openChar === "[" ? "]" : "}";
  const end = cleaned.lastIndexOf(closeChar);
  if (end === -1 || end <= start) throw new Error("JSON truncado na resposta.");
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

function extractJsonOrText(response: string): unknown {
  try {
    return extractJson(response);
  } catch {
    return response;
  }
}

function normalizeArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function clampNumber(value: unknown, min: number, max: number, fallback = min): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function friendlyAiError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  console.warn("Resposta de IA inválida", err);
  if (msg.includes("429")) {
    return new Error("Limite de pedidos atingido. Tenta de novo dentro de 1 minuto.");
  }
  if (msg.includes("402")) {
    return new Error("Créditos de AI esgotados nesta workspace. Adiciona créditos para continuar.");
  }
  if (msg.toLowerCase().includes("truncado") || msg.toLowerCase().includes("truncated")) {
    return new Error(
      "A IA devolveu uma resposta incompleta. Tenta novamente ou reduz o tamanho do CV/TdR.",
    );
  }
  if (msg.includes("Expected") || msg.includes("Required") || msg.includes("invalid_type")) {
    return new Error(
      "A IA devolveu uma resposta num formato inesperado. Já tentámos corrigir automaticamente, mas não foi possível.",
    );
  }
  return new Error(msg);
}

function compactForAi(text: string, limit = 18000): string {
  const normalized = text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (normalized.length <= limit) return normalized;
  const head = normalized.slice(0, Math.floor(limit * 0.62));
  const tail = normalized.slice(-Math.floor(limit * 0.32));
  return `${head}\n\n[... conteúdo encurtado para evitar resposta truncada ...]\n\n${tail}`;
}

export const analyzeCoverage = createServerFn({ method: "POST" })
  .middleware([optionalIdentity])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<CoverageAnalysis> => {
    await requireUsageAllowed("cv_analysis", context.userId, context.fingerprint);
    const gateway = createLovableAiGatewayProvider(process.env.LOVABLE_API_KEY!);

    const cvText = compactForAi(typeof data.cv === "string" ? data.cv : cvToText(data.cv as CvDraft));
    const jobTdr = compactForAi(data.jobTdr);
    const prompt = `## CV do candidato\n${cvText}\n\n## Termos de Referência da vaga\n${jobTdr}\n\nResponde APENAS com um objecto JSON válido (sem markdown, sem comentários, sem texto antes ou depois) com esta forma exacta:
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
      return outputSchema.parse(normalizeCoverageJson(json)) as CoverageAnalysis;
    };

    try {
      try {
        return await callOnce();
      } catch (e) {
        console.warn("analyzeCoverage: 1ª tentativa falhou, a repetir.", e);
        return await callOnce();
      }
    } catch (err) {
      throw new Error(`Falha na análise: ${friendlyAiError(err).message}`);
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
      nivel: z.enum(["basico", "intermedio", "avancado", "fluente", "nativo"]).optional(),
    }),
  ),
});

const INTERVIEW_SYSTEM = `És um redator de CVs especializado em ONGs, desenvolvimento, consultoria e administração pública em Moçambique e PALOP. Transformas respostas de entrevista em conteúdo estruturado de CV.

Regras absolutas:
- Responde sempre em PORTUGUÊS EUROPEU (PT-PT).
- NUNCA inventes experiência, datas, organizações, formação, certificações ou números. Se a pessoa não disse, deixa em branco.
- Podes reformular, profissionalizar e estruturar — não podes acrescentar factos.
- Os campos "resumo" e "descricao" devem ser devolvidos em HTML restrito, usando APENAS estas tags: <p>, <ul>, <li>, <strong>, <em>, <u>. Nunca uses markdown, nunca uses outras tags (sem <br>, sem atributos, sem classes).
- Para "descricao" das experiências, usa uma lista <ul><li> com bullets curtos começando por verbos de ação (Coordenei, Implementei, Geri), só com informação que veio na entrevista. Ex.: "<ul><li>Coordenei equipa de 5 pessoas</li></ul>".
- "resumo" do perfil: 2-3 frases ancoradas estritamente no que foi dito, dentro de um único <p>.
- Se o utilizador deu nome, contactos, cidade, usa-os tal e qual.
- Se houve TdR, prioriza realçar competências/experiências da pessoa que se cruzam com o TdR — sem fabricar.`;

export const generateCvFromInterview = createServerFn({ method: "POST" })
  .middleware([optionalIdentity])
  .inputValidator((input: unknown) => interviewInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<z.infer<typeof cvDraftSectionsSchema>> => {
    await requireUsageAllowed("ai_suggestions", context.userId, context.fingerprint);
    const gateway = createLovableAiGatewayProvider(process.env.LOVABLE_API_KEY);

    const answersBlock = data.answers
      .map((a, i) => `P${i + 1}: ${a.pergunta}\nR${i + 1}: ${a.resposta}`)
      .join("\n\n");

    const prompt = [
      "## Respostas da entrevista",
      answersBlock,
      data.jobTdr ? `\n## Termos de Referência da vaga\n${compactForAi(data.jobTdr)}` : "",
      '\nGera as secções do CV em JSON estruturado, ancorado nestas respostas. Responde APENAS com um objecto JSON válido nesta forma: { "perfil": { "nome": string, "headline": string, "email": string, "telefone": string, "cidade": string, "pais": string, "resumo": string }, "experiencia": [{ "cargo": string, "organizacao": string, "local": string, "inicio": string, "fim": string, "descricao": string }], "formacao": [{ "curso": string, "instituicao": string, "local": string, "inicio": string, "fim": string, "descricao": string }], "competencias": [{ "nome": string }], "idiomas": [{ "idioma": string, "nivel": "basico"|"intermedio"|"avancado"|"fluente"|"nativo" }] }. Nunca uses arrays em campos de texto como descricao; usa uma string HTML restrita.',
    ].join("\n");

    const callOnce = async () => {
      const { text } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system: INTERVIEW_SYSTEM,
        prompt,
      });
      const json = extractJson(text);
      return cvDraftSectionsSchema.parse(normalizeAlignmentJson(json));
    };

    try {
      let raw: z.infer<typeof cvDraftSectionsSchema>;
      try {
        raw = await callOnce();
      } catch (e) {
        console.warn("generateCvFromInterview: 1ª tentativa falhou, a repetir.", e);
        raw = await callOnce();
      }
      return {
        ...raw,
        perfil: {
          ...raw.perfil,
          resumo: toSafeHtml(raw.perfil.resumo),
        },
        experiencia: raw.experiencia.map((e) => ({
          ...e,
          descricao: toSafeHtml(e.descricao),
        })),
        formacao: raw.formacao.map((f) => ({
          ...f,
          descricao: toSafeHtml(f.descricao),
        })),
      };
    } catch (err) {
      throw new Error(`Falha a gerar CV: ${friendlyAiError(err).message}`);
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
      nivel: z.enum(["basico", "intermedio", "avancado", "fluente", "nativo"]).optional(),
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
        .describe(
          "Secção e item afectado, e.g. 'Experiência · UNICEF — Gestor de Projectos' ou 'Perfil · headline'.",
        ),
      de: z.string().describe("Texto original (trecho relevante, não o campo inteiro)."),
      para: z.string().describe("Texto reescrito correspondente."),
      justificacao: z
        .string()
        .describe(
          "1 frase curta a explicar porquê — que requisito do TdR esta alteração visa cobrir.",
        ),
    }),
  ),
});

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function asString(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(asString).filter(Boolean).join("\n");
  }
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function normalizeIdiomaNivel(value: unknown) {
  const nivel = asString(value).toLowerCase();
  if (["basico", "intermedio", "avancado", "fluente", "nativo"].includes(nivel)) return nivel;
  if (["básico", "basic"].includes(nivel)) return "basico";
  if (["intermédio", "medio", "médio", "intermediate"].includes(nivel)) return "intermedio";
  if (["avançado", "advanced"].includes(nivel)) return "avancado";
  if (["fluent"].includes(nivel)) return "fluente";
  if (["native", "materno", "materna"].includes(nivel)) return "nativo";
  return undefined;
}

function normalizeAlignmentJson(value: unknown): unknown {
  const root = asRecord(value);
  const source = asRecord(
    root.sections ??
      root.cv ??
      root.curriculo ??
      root.currículo ??
      root.cv_alinhado ??
      root.cvAlinhado ??
      root.resultado ??
      root.result ??
      root,
  );
  const perfil = asRecord(
    source.perfil ?? source.profile ?? source.dadosPessoais ?? source.dados_pessoais,
  );
  const experiencia = Array.isArray(source.experiencia ?? source.experiências ?? source.experience)
    ? (source.experiencia ?? source.experiências ?? source.experience)
    : [];
  const formacao = Array.isArray(
    source.formacao ?? source.formação ?? source.educacao ?? source.education,
  )
    ? (source.formacao ?? source.formação ?? source.educacao ?? source.education)
    : [];
  const competencias = Array.isArray(source.competencias ?? source.competências ?? source.skills)
    ? (source.competencias ?? source.competências ?? source.skills)
    : [];
  const idiomas = Array.isArray(
    source.idiomas ?? source.linguas ?? source.línguas ?? source.languages,
  )
    ? (source.idiomas ?? source.linguas ?? source.línguas ?? source.languages)
    : [];

  return {
    perfil: {
      nome: asString(perfil.nome ?? perfil.name),
      headline: asString(perfil.headline ?? perfil.titulo ?? perfil.title ?? perfil.cargo),
      email: asString(perfil.email),
      telefone: asString(perfil.telefone ?? perfil.phone ?? perfil.telemovel ?? perfil.telemóvel),
      cidade: asString(perfil.cidade ?? perfil.city),
      pais: asString(perfil.pais ?? perfil.país ?? perfil.country) || "Moçambique",
      linkedin: asString(perfil.linkedin) || undefined,
      website: asString(perfil.website ?? perfil.site) || undefined,
      resumo: asString(perfil.resumo ?? perfil.summary ?? perfil.sobre) || undefined,
    },
    experiencia: (experiencia as unknown[]).map((item) => {
      const exp = asRecord(item);
      return {
        cargo: asString(exp.cargo ?? exp.funcao ?? exp.função ?? exp.title ?? exp.position),
        organizacao: asString(
          exp.organizacao ??
            exp.organização ??
            exp.empresa ??
            exp.instituicao ??
            exp.instituição ??
            exp.organization,
        ),
        local: asString(exp.local ?? exp.location) || undefined,
        inicio: asString(exp.inicio ?? exp.início ?? exp.start ?? exp.periodo_inicio) || undefined,
        fim: asString(exp.fim ?? exp.end ?? exp.periodo_fim) || undefined,
        descricao:
          asString(
            exp.descricao ??
              exp.descrição ??
              exp.description ??
              exp.responsabilidades ??
              exp.bullets,
          ) || undefined,
      };
    }),
    formacao: (formacao as unknown[]).map((item) => {
      const edu = asRecord(item);
      return {
        curso:
          asString(edu.curso ?? edu.grau ?? edu.titulo ?? edu.título ?? edu.degree ?? edu.nome) ||
          "Formação",
        instituicao: asString(
          edu.instituicao ?? edu.instituição ?? edu.escola ?? edu.universidade ?? edu.institution,
        ),
        local: asString(edu.local ?? edu.location) || undefined,
        inicio: asString(edu.inicio ?? edu.início ?? edu.start) || undefined,
        fim: asString(edu.fim ?? edu.end) || undefined,
        descricao: asString(edu.descricao ?? edu.descrição ?? edu.description) || undefined,
      };
    }),
    competencias: (competencias as unknown[])
      .map((item) => ({ nome: asString(asRecord(item).nome ?? asRecord(item).name ?? item) }))
      .filter((item) => item.nome),
    idiomas: (idiomas as unknown[])
      .map((item) => {
        const idioma = asRecord(item);
        return {
          idioma: asString(
            idioma.idioma ?? idioma.lingua ?? idioma.língua ?? idioma.language ?? item,
          ),
          nivel: normalizeIdiomaNivel(idioma.nivel ?? idioma.level),
        };
      })
      .filter((item) => item.idioma),
    alteracoes: Array.isArray(
      root.alteracoes ?? root.alterações ?? source.alteracoes ?? source.alterações,
    )
      ? (
          (root.alteracoes ??
            root.alterações ??
            source.alteracoes ??
            source.alterações) as unknown[]
        ).map((item) => {
          const change = asRecord(item);
          const tipo = asString(change.tipo ?? change.type);
          return {
            tipo: tipo === "recontextualizado" ? "recontextualizado" : "reformulado",
            campo: asString(change.campo ?? change.field),
            de: asString(change.de ?? change.from ?? change.original),
            para: asString(change.para ?? change.to ?? change.reescrito),
            justificacao: asString(
              change.justificacao ?? change.justificação ?? change.reason ?? change.motivo,
            ),
          };
        })
      : [],
  };
}

function normalizeInterviewCategory(value: unknown): (typeof interviewCategorias)[number] {
  const raw = asString(value).toLowerCase();
  if (raw.includes("técn") || raw.includes("tecn") || raw.includes("technical")) return "tecnica";
  if (raw.includes("empresa") || raw.includes("organiza") || raw.includes("company")) {
    return "sobre_empresa";
  }
  if (raw.includes("elimin") || raw.includes("filtro") || raw.includes("obrig")) return "eliminatoria";
  return "comportamental";
}

function normalizeInterviewPrepJson(value: unknown): unknown {
  const root = asRecord(value);
  const perguntasRaw = normalizeArray(
    root.perguntas ?? root.questions ?? root.entrevista ?? root.interview ?? value,
  );
  return {
    perguntas: perguntasRaw
      .map((item) => {
        const q = asRecord(item);
        return {
          categoria: normalizeInterviewCategory(q.categoria ?? q.category ?? q.tipo),
          pergunta: asString(q.pergunta ?? q.question ?? q.titulo ?? q.title ?? item),
          resposta_sugerida: asString(
            q.resposta_sugerida ?? q.respostaSugerida ?? q.answer ?? q.suggested_answer ?? q.sugestao,
          ),
        };
      })
      .filter((q) => q.pergunta),
  };
}

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
- Reescrever o "resumo" do perfil (2-3 frases) orientado à vaga, ancorado na experiência real, dentro de um único <p>.
- Os campos "resumo" e "descricao" devem ser devolvidos em HTML restrito, usando APENAS estas tags: <p>, <ul>, <li>, <strong>, <em>, <u>. Nunca uses markdown, nunca uses outras tags (sem <br>, sem atributos, sem classes).
- Para "descricao", usar uma lista <ul><li> com bullets curtos começando por verbos de ação (Coordenei, Implementei, Geri), realçando resultados e competências relevantes ao TdR que já existam no CV.
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
  .middleware([optionalIdentity])
  .inputValidator((input: unknown) => alignInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<AlignmentResult> => {
    await requireUsageAllowed("ai_suggestions", context.userId, context.fingerprint);
    const gateway = createLovableAiGatewayProvider(process.env.LOVABLE_API_KEY);

    const prompt = `## CV actual do candidato\n${compactForAi(data.cv)}\n\n## Termos de Referência da vaga\n${compactForAi(data.jobTdr)}\n\nReescreve o CV para o alinhar ao máximo com este TdR. Responde APENAS com um objecto JSON válido (sem markdown, sem comentários, sem texto antes ou depois) nesta forma exacta:\n{\n  "perfil": { "nome": string, "headline": string, "email": string, "telefone": string, "cidade": string, "pais": string, "linkedin": string, "website": string, "resumo": string },\n  "experiencia": [{ "cargo": string, "organizacao": string, "local": string, "inicio": string, "fim": string, "descricao": string }],\n  "formacao": [{ "curso": string, "instituicao": string, "local": string, "inicio": string, "fim": string, "descricao": string }],\n  "competencias": [{ "nome": string }],\n  "idiomas": [{ "idioma": string, "nivel": "basico"|"intermedio"|"avancado"|"fluente"|"nativo" }],\n  "alteracoes": [{ "tipo": "reformulado"|"recontextualizado", "campo": string, "de": string, "para": string, "justificacao": string }]\n}\nNunca uses arrays em campos de texto como "descricao": devolve uma única string em HTML restrito (<p>, <ul>, <li>, <strong>, <em>, <u> apenas), com os bullets dentro de <ul><li>.`;

    const callOnce = async () => {
      const { text } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system: ALIGN_SYSTEM,
        prompt,
      });
      const json = extractJson(text);
      return alignOutputSchema.parse(normalizeAlignmentJson(json));
    };

    try {
      let raw: z.infer<typeof alignOutputSchema>;
      try {
        raw = await callOnce();
      } catch (e) {
        console.warn("alignCvToTdr: 1ª tentativa falhou, a repetir.", e);
        raw = await callOnce();
      }

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
          resumo: toSafeHtml(raw.perfil.resumo),
        },
        experiencia: raw.experiencia.map((e) => ({
          id: addId(),
          ...e,
          descricao: toSafeHtml(e.descricao),
        })),
        formacao: raw.formacao.map((f) => ({
          id: addId(),
          ...f,
          descricao: toSafeHtml(f.descricao),
        })),
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
      throw new Error(`Falha ao alinhar CV: ${friendlyAiError(err).message}`);
    }
  });

// =================== Preparação de entrevista ===================

const interviewCategorias = ["comportamental", "tecnica", "sobre_empresa", "eliminatoria"] as const;

const interviewPrepInputSchema = z.object({
  jobTdr: z.string().min(20, "Cola um TdR mais detalhado."),
  coverLetter: z.string().min(10, "Cola a tua carta de apresentação."),
  cv: z.string().min(20, "Cola ou carrega um CV mais completo."),
});

const interviewPrepOutputSchema = z.object({
  perguntas: z.array(
    z.object({
      categoria: z.enum(interviewCategorias),
      pergunta: z.string(),
      resposta_sugerida: z.string(),
    }),
  ),
});

const INTERVIEW_PREP_SYSTEM = `És um coach de entrevistas especializado em ONGs, desenvolvimento, consultoria e administração pública em Moçambique e PALOP. Com base nos Termos de Referência (TdR) de uma vaga, na carta de apresentação e no CV de um candidato, preparas uma simulação de entrevista completa e específica para aquela vaga.

Regra absoluta e não negociável — ZERO INVENÇÃO:
- As respostas sugeridas têm de estar ancoradas ESTRITAMENTE no conteúdo do CV e da carta fornecidos.
- NUNCA inventes experiências, empregos, números, resultados ou conquistas que não estejam nos documentos.
- Quando não houver evidência no CV ou na carta para responder bem a uma pergunta, a resposta sugerida deve dizer isso explicitamente — por exemplo: "Não há no teu CV elemento que suporte isto — considera preparar um exemplo real de [algo relevante]." NUNCA fabriques um exemplo para preencher essa lacuna.
- Todas as "resposta_sugerida" são sugestões de discurso para o candidato preparar e adaptar por palavras próprias — nunca as apresentes como factos objectivos.

Outras regras:
- Responde sempre em PORTUGUÊS EUROPEU (PT-PT).
- Gera entre 8 e 12 perguntas no total, distribuídas pelas 4 categorias.
- "comportamental": perguntas sobre competências comportamentais e situações passadas (estilo STAR).
- "tecnica": conhecimento técnico, metodologias e ferramentas exigidas no TdR.
- "sobre_empresa": motivação, conhecimento da organização/sector, "porquê esta vaga/organização".
- "eliminatoria": perguntas-filtro sobre requisitos obrigatórios do TdR (ex: anos mínimos de experiência, disponibilidade, idiomas, certificações exigidas).
- Cada pergunta deve ser específica a esta vaga (usa terminologia do TdR), nunca genérica.
- Quando houver evidência real, estrutura a "resposta_sugerida" pelo método STAR (Situação, Tarefa, Acção, Resultado) com factos do candidato.`;

const MOCK_INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  {
    categoria: "comportamental",
    pergunta:
      "⚠️ MOCK — Fala-me de uma situação em que tiveste de gerir uma equipa sob pressão de prazo.",
    resposta_sugerida:
      "⚠️ MOCK (sem LOVABLE_API_KEY) — Sugestão de discurso: estrutura pelo método STAR usando um exemplo real de coordenação de equipa que conste no teu CV.",
  },
  {
    categoria: "comportamental",
    pergunta:
      "⚠️ MOCK — Descreve um conflito que tiveste com um colega ou parceiro e como o resolveste.",
    resposta_sugerida:
      "⚠️ MOCK (sem LOVABLE_API_KEY) — Não há no teu CV elemento que suporte isto — considera preparar um exemplo real de resolução de conflito antes da entrevista.",
  },
  {
    categoria: "comportamental",
    pergunta: "⚠️ MOCK — Dá um exemplo de uma decisão difícil que tomaste sem supervisão directa.",
    resposta_sugerida:
      "⚠️ MOCK (sem LOVABLE_API_KEY) — Sugestão de discurso: ancora num projecto do teu CV em que tiveste autonomia de decisão.",
  },
  {
    categoria: "tecnica",
    pergunta: "⚠️ MOCK — Que ferramentas usas para monitoria e avaliação de projectos?",
    resposta_sugerida:
      "⚠️ MOCK (sem LOVABLE_API_KEY) — Sugestão de discurso: menciona apenas as ferramentas que já usaste, tal como constam no teu CV.",
  },
  {
    categoria: "tecnica",
    pergunta: "⚠️ MOCK — Como estruturas um relatório para um doador institucional?",
    resposta_sugerida:
      "⚠️ MOCK (sem LOVABLE_API_KEY) — Sugestão de discurso: descreve o processo real que seguiste em experiências anteriores de reporte a doadores.",
  },
  {
    categoria: "tecnica",
    pergunta: "⚠️ MOCK — Que metodologia usaste para gestão de orçamento de projecto?",
    resposta_sugerida:
      "⚠️ MOCK (sem LOVABLE_API_KEY) — Não há no teu CV elemento que suporte isto — considera preparar um exemplo real de gestão orçamental.",
  },
  {
    categoria: "sobre_empresa",
    pergunta: "⚠️ MOCK — Porque queres trabalhar nesta organização especificamente?",
    resposta_sugerida:
      "⚠️ MOCK (sem LOVABLE_API_KEY) — Sugestão de discurso: liga a missão da organização a valores ou experiência já presentes no teu percurso.",
  },
  {
    categoria: "sobre_empresa",
    pergunta: "⚠️ MOCK — O que sabes sobre o sector em que esta organização actua?",
    resposta_sugerida:
      "⚠️ MOCK (sem LOVABLE_API_KEY) — Sugestão de discurso: relaciona o teu conhecimento do sector com experiência concreta do teu CV.",
  },
  {
    categoria: "eliminatoria",
    pergunta: "⚠️ MOCK — Cumpres o requisito mínimo de anos de experiência exigido no TdR?",
    resposta_sugerida:
      "⚠️ MOCK (sem LOVABLE_API_KEY) — Sugestão de discurso: confirma o número de anos com base nas datas reais do teu CV; se não cumprires, sê honesto e destaca experiência adjacente.",
  },
  {
    categoria: "eliminatoria",
    pergunta:
      "⚠️ MOCK — Tens disponibilidade para viajar ou mudar de localização, conforme exigido no TdR?",
    resposta_sugerida:
      "⚠️ MOCK (sem LOVABLE_API_KEY) — Não há no teu CV elemento que suporte isto — confirma a tua disponibilidade real antes da entrevista.",
  },
];

export const generateInterviewPrep = createServerFn({ method: "POST" })
  .middleware([optionalIdentity])
  .inputValidator((input: unknown) => interviewPrepInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<InterviewQuestion[]> => {
    await requireUsageAllowed("interview_prep", context.userId, context.fingerprint);
    if (!process.env.LOVABLE_API_KEY) {
      console.warn("MOCK: LOVABLE_API_KEY ausente, a devolver preparação de entrevista simulada");
      return MOCK_INTERVIEW_QUESTIONS;
    }

    const gateway = createLovableAiGatewayProvider(process.env.LOVABLE_API_KEY);

    const prompt = `## Termos de Referência da vaga\n${compactForAi(data.jobTdr)}\n\n## Carta de apresentação do candidato\n${compactForAi(data.coverLetter, 9000)}\n\n## CV do candidato\n${compactForAi(data.cv)}\n\nGera uma simulação de entrevista específica para esta vaga. Responde APENAS com um objecto JSON válido (sem markdown, sem comentários, sem texto antes ou depois) com esta forma exacta:\n{\n  "perguntas": [{ "categoria": "comportamental"|"tecnica"|"sobre_empresa"|"eliminatoria", "pergunta": string, "resposta_sugerida": string }]\n}`;

    const callOnce = async () => {
      const { text } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system: INTERVIEW_PREP_SYSTEM,
        prompt,
      });
      const json = extractJson(text);
      return interviewPrepOutputSchema.parse(normalizeInterviewPrepJson(json)).perguntas;
    };

    try {
      try {
        return await callOnce();
      } catch (e) {
        console.warn("generateInterviewPrep: 1ª tentativa falhou, a repetir.", e);
        return await callOnce();
      }
    } catch (err) {
      throw new Error(`Falha a gerar preparação de entrevista: ${friendlyAiError(err).message}`);
    }
  });

// =================== Sugestões de IA para campos ===================

const fieldSuggestionSectionTypes = ["summary", "experience", "education", "extra"] as const;
export type FieldSuggestionSectionType = (typeof fieldSuggestionSectionTypes)[number];

const fieldSuggestionsInputSchema = z.object({
  sectionType: z.enum(fieldSuggestionSectionTypes),
  fieldContext: z
    .object({
      cargo: z.string().optional(),
      organizacao: z.string().optional(),
      local: z.string().optional(),
    })
    .optional()
    .default({}),
  existingHtml: z.string().optional().default(""),
  cvHeadline: z.string().optional().default(""),
  language: z.literal("pt").optional().default("pt"),
});

const fieldSuggestionsOutputSchema = z.object({
  suggestions: z.array(z.string()),
});

const FIELD_SUGGESTION_LABELS: Record<FieldSuggestionSectionType, string> = {
  summary: "resumo profissional do perfil do CV",
  experience: "descrição de uma experiência profissional",
  education: "descrição de uma formação académica",
  extra: "descrição de um item de uma secção adicional do CV (curso, certificado, atividade, etc.)",
};

const FIELD_SUGGESTIONS_SYSTEM = `És um redator de CVs especializado em ONGs, desenvolvimento, consultoria e administração pública em Moçambique e PALOP. Geras sugestões de bullets para um campo específico de um CV, para o utilizador escolher e inserir.

Regras absolutas:
- Responde sempre em PORTUGUÊS EUROPEU (PT-PT).
- Gera entre 4 e 6 sugestões. Cada sugestão é UMA frase-bullet curta em texto simples (sem HTML, sem markdown, sem marcador "-" ou "•" no início), começada por um verbo de ação (Coordenei, Geri, Implementei, Elaborei, Apoiei, etc.).
- As sugestões são responsabilidades ou realizações TÍPICAS do cargo/contexto indicado, redigidas de forma profissional.
- PROIBIDO inventar números, percentagens, nomes de projetos, organizações, tecnologias ou quaisquer factos específicos que não tenham sido fornecidos — usa formulações genéricas que o utilizador possa adaptar e completar com os seus próprios factos.
- Nunca repitas ideias que já constam do texto atual do campo (fornecido em "Texto atual do campo") — as sugestões devem ser complementares, nunca duplicadas.
- Se não houver cargo/organização/contexto específico fornecido (ex: resumo sem cargo definido), baseia-te no que existir de contexto geral do CV (ex: título/cargo geral do perfil) para gerares sugestões genéricas mas plausíveis; se não houver contexto nenhum, sugere responsabilidades genéricas de qualquer profissional.`;

function sanitizePlainSuggestion(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/^[-•*]\s*/, "")
    .trim();
}

function normalizeSuggestionsJson(value: unknown): unknown {
  const root = asRecord(value);
  const suggestions = normalizeArray(
    root.suggestions ?? root.sugestoes ?? root.sugestões ?? root.items ?? value,
  )
    .map(asString)
    .map(sanitizePlainSuggestion)
    .filter(Boolean)
    .slice(0, 6);
  return { suggestions };
}

const MOCK_FIELD_SUGGESTIONS: Record<FieldSuggestionSectionType, string[]> = {
  summary: [
    "⚠️ MOCK — Profissional com sólida experiência na coordenação de equipas e projetos multidisciplinares.",
    "⚠️ MOCK — Combina competências técnicas e de gestão para entregar resultados dentro dos prazos definidos.",
    "⚠️ MOCK — Reconhecido(a) pela capacidade de comunicação, organização e resolução de problemas complexos.",
    "⚠️ MOCK — Focado(a) em melhoria contínua de processos e na qualidade da entrega final.",
    "⚠️ MOCK — Experiência de trabalho em equipas multiculturais e ambientes multidisciplinares.",
  ],
  experience: [
    "⚠️ MOCK — Coordenei as atividades diárias da equipa, garantindo o cumprimento de prazos e objetivos.",
    "⚠️ MOCK — Elaborei relatórios periódicos de acompanhamento para a direção e outras partes interessadas.",
    "⚠️ MOCK — Implementei melhorias nos processos internos de trabalho da equipa.",
    "⚠️ MOCK — Colaborei com outras áreas da organização para assegurar o alinhamento de prioridades.",
    "⚠️ MOCK — Participei na definição e monitorização de indicadores de desempenho.",
    "⚠️ MOCK — Apoiei a integração e formação de novos membros da equipa.",
  ],
  education: [
    "⚠️ MOCK — Desenvolvi competências analíticas e de resolução de problemas ao longo do curso.",
    "⚠️ MOCK — Participei em projetos académicos em equipa, com apresentação de resultados.",
    "⚠️ MOCK — Aprofundei conhecimentos teóricos e práticos na área de estudo.",
    "⚠️ MOCK — Concluí trabalhos de investigação sob orientação de docentes da área.",
  ],
  extra: [
    "⚠️ MOCK — Contribuí ativamente para os objetivos definidos nesta atividade.",
    "⚠️ MOCK — Desenvolvi competências relevantes através de participação contínua.",
    "⚠️ MOCK — Colaborei com outros participantes para alcançar os resultados esperados.",
    "⚠️ MOCK — Apliquei conhecimentos adquiridos em contexto prático.",
  ],
};

export const generateFieldSuggestions = createServerFn({ method: "POST" })
  .middleware([optionalIdentity])
  .inputValidator((input: unknown) => fieldSuggestionsInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ suggestions: string[] }> => {
    await requireUsageAllowed("ai_suggestions", context.userId, context.fingerprint);
    if (!process.env.LOVABLE_API_KEY) {
      console.warn("MOCK: LOVABLE_API_KEY ausente, a devolver sugestões de campo simuladas");
      return { suggestions: MOCK_FIELD_SUGGESTIONS[data.sectionType] };
    }

    const gateway = createLovableAiGatewayProvider(process.env.LOVABLE_API_KEY);

    const existingPlain = data.existingHtml ? htmlToPlainText(data.existingHtml) : "";
    const prompt = [
      `Campo a sugerir: ${FIELD_SUGGESTION_LABELS[data.sectionType]}.`,
      data.fieldContext.cargo ? `Cargo/título: ${data.fieldContext.cargo}` : "",
      data.fieldContext.organizacao
        ? `Organização/instituição: ${data.fieldContext.organizacao}`
        : "",
      data.fieldContext.local ? `Local: ${data.fieldContext.local}` : "",
      data.cvHeadline ? `Cargo/título geral do perfil no CV: ${data.cvHeadline}` : "",
      `Texto atual do campo: ${existingPlain || "(vazio)"}`,
      "",
      'Responde APENAS com um objecto JSON válido (sem markdown, sem comentários, sem texto antes ou depois) com esta forma exacta: { "suggestions": string[] } — entre 4 e 6 strings.',
    ]
      .filter(Boolean)
      .join("\n");

    const callOnce = async () => {
      const { text } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system: FIELD_SUGGESTIONS_SYSTEM,
        prompt,
      });
      const json = extractJson(text);
      const parsed = fieldSuggestionsOutputSchema.parse(normalizeSuggestionsJson(json));
      return parsed.suggestions.map(sanitizePlainSuggestion).filter(Boolean);
    };

    try {
      let suggestions: string[];
      try {
        suggestions = await callOnce();
      } catch (e) {
        console.warn("generateFieldSuggestions: 1ª tentativa falhou, a repetir.", e);
        suggestions = await callOnce();
      }
      return { suggestions };
    } catch (err) {
      throw new Error(`Falha a gerar sugestões: ${friendlyAiError(err).message}`);
    }
  });

// =================== Carta de motivação ===================

const coverLetterInputSchema = z
  .object({
    cvContent: z.any(),
    jobTdr: z.string().optional(),
    mode: z.enum(["targeted", "generic"]),
  })
  .refine((v) => v.mode !== "targeted" || (v.jobTdr?.trim().length ?? 0) >= 20, {
    message: "Cola um TdR mais detalhado para uma carta direcionada.",
    path: ["jobTdr"],
  });

const coverLetterOutputSchema = z.object({
  content: z.string(),
});

function normalizeCoverLetterJson(value: unknown): unknown {
  const root = asRecord(value);
  const nested = asRecord(root.carta ?? root.letter ?? root.coverLetter ?? root.resultado ?? root.result);
  const content =
    asString(root.content ?? root.conteudo ?? root.conteúdo ?? root.html ?? root.body) ||
    asString(nested.content ?? nested.conteudo ?? nested.conteúdo ?? nested.html ?? nested.body) ||
    asString(value);
  return { content };
}

const COVER_LETTER_SYSTEM = `És um redator de cartas de motivação especializado em ONGs, desenvolvimento, consultoria e administração pública em Moçambique e PALOP. Escreves o corpo de cartas de motivação profissionais ancoradas estritamente no CV do candidato.

Regra absoluta e não negociável — ZERO INVENÇÃO:
- A carta tem de se ancorar ESTRITAMENTE no conteúdo do CV fornecido.
- PROIBIDO inventar experiência profissional, cargos, organizações, formação académica, certificações, competências, resultados quantitativos ou qualquer outro facto que não conste do CV.
- Se o CV não tiver evidência suficiente para um parágrafo forte, escreve com o que existe — nunca preenchas a lacuna com invenção.

Regras por modo:
- Modo "targeted" (carta para uma vaga específica): espelha os requisitos-chave dos Termos de Referência (TdR) fornecidos, usando APENAS evidência que já existe no CV. Estrutura: (1) parágrafo de abertura que refere a vaga e a organização (usa o nome da organização/título da vaga tal como aparecem no TdR, se identificáveis); (2) dois parágrafos de evidência que ligam experiência/competências reais do CV aos requisitos do TdR; (3) parágrafo de fecho com disponibilidade para entrevista. Entre 250 e 400 palavras no total.
- Modo "generic" (carta genérica, adaptável a qualquer vaga): mesma disciplina de zero invenção e mesma estrutura geral (abertura, evidência, fecho), mas SEM referir uma vaga ou organização concreta — usa marcadores claros para o candidato personalizar antes de enviar, exactamente assim: [Nome da Organização] e [Título da Vaga]. Entre 250 e 400 palavras.

Tom e forma:
- Responde sempre em PORTUGUÊS EUROPEU (PT-PT), tom profissional e directo, primeira pessoa.
- O campo "content" da resposta é HTML restrito, usando APENAS estas tags: <p>, <strong>, <em>, <ul>, <li>. Nunca uses markdown, nunca outras tags (sem <br>, sem atributos, sem classes, sem cabeçalhos).
- Não incluas saudação nem despedida formais de carta (ex: "Exmo. Senhor", "Atenciosamente") — o utilizador compõe isso fora do corpo gerado; escreve apenas o corpo do texto.`;

function buildCoverLetterPrompt(cvText: string, mode: CoverLetterMode, jobTdr?: string): string {
  const parts = [`## CV do candidato\n${cvText}`];
  if (mode === "targeted" && jobTdr) {
    parts.push(`## Termos de Referência da vaga\n${jobTdr}`);
  }
  parts.push(
    `Escreve o corpo de uma carta de motivação em modo "${mode}". Responde APENAS com um objecto JSON válido (sem markdown, sem comentários, sem texto antes ou depois) com esta forma exacta:\n{ "content": string }\nO valor de "content" é HTML restrito (<p>, <strong>, <em>, <ul>, <li> apenas).`,
  );
  return parts.join("\n\n");
}

const MOCK_COVER_LETTER_TARGETED: GeneratedCoverLetter = {
  content:
    "<p>⚠️ MOCK (sem LOVABLE_API_KEY) — Escrevo para manifestar o meu interesse na vaga anunciada nos Termos de Referência partilhados, cuja missão e áreas de actuação se alinham directamente com o meu percurso profissional.</p>" +
    "<p>Ao longo da minha carreira, tal como reflectido no meu CV, desenvolvi experiência relevante para os requisitos desta posição, incluindo responsabilidades de coordenação, gestão e elaboração de relatórios que constam do meu percurso documentado.</p>" +
    "<p>Complementarmente, as competências e a formação registadas no meu CV reforçam a minha adequação a este papel, permitindo-me contribuir desde o primeiro momento para os objectivos da organização.</p>" +
    "<p>Fico disponível para uma entrevista a qualquer momento e agradeço desde já a atenção dispensada à minha candidatura.</p>",
};

const MOCK_COVER_LETTER_GENERIC: GeneratedCoverLetter = {
  content:
    "<p>⚠️ MOCK (sem LOVABLE_API_KEY) — Escrevo para manifestar o meu interesse na vaga de [Título da Vaga] na [Nome da Organização], cuja missão considero alinhada com o meu percurso profissional.</p>" +
    "<p>Tal como reflectido no meu CV, desenvolvi experiência relevante em funções anteriores, incluindo responsabilidades de coordenação, gestão e elaboração de relatórios.</p>" +
    "<p>As competências e a formação registadas no meu CV reforçam a minha adequação a este tipo de posição, permitindo-me contribuir desde o primeiro momento para os objectivos da organização.</p>" +
    "<p>Fico disponível para uma entrevista a qualquer momento e agradeço desde já a atenção dispensada à minha candidatura.</p>",
};

export const generateCoverLetter = createServerFn({ method: "POST" })
  .middleware([optionalIdentity])
  .inputValidator((input: unknown) => coverLetterInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<GeneratedCoverLetter> => {
    await requireUsageAllowed("cover_letter", context.userId, context.fingerprint);
    if (!process.env.LOVABLE_API_KEY) {
      console.warn("MOCK: LOVABLE_API_KEY ausente, a devolver carta de motivação simulada");
      return data.mode === "targeted" ? MOCK_COVER_LETTER_TARGETED : MOCK_COVER_LETTER_GENERIC;
    }

    const gateway = createLovableAiGatewayProvider(process.env.LOVABLE_API_KEY);
    const cvText = compactForAi(
      typeof data.cvContent === "string" ? data.cvContent : cvToText(data.cvContent as CvDraft),
    );
    const prompt = buildCoverLetterPrompt(
      cvText,
      data.mode,
      data.jobTdr ? compactForAi(data.jobTdr) : undefined,
    );

    const callOnce = async () => {
      const { text } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system: COVER_LETTER_SYSTEM,
        prompt,
      });
      const json = extractJsonOrText(text);
      const parsed = coverLetterOutputSchema.parse(normalizeCoverLetterJson(json));
      return { content: toSafeHtml(parsed.content) };
    };

    try {
      try {
        return await callOnce();
      } catch (e) {
        console.warn("generateCoverLetter: 1ª tentativa falhou, a repetir.", e);
        return await callOnce();
      }
    } catch (err) {
      throw new Error(`Falha a gerar carta de motivação: ${friendlyAiError(err).message}`);
    }
  });
