// CV de amostra usado só na home, para mostrar previews reais dos templates
// (renderizados pelo mesmo motor do editor, não são imagens estáticas).

import type { CvDraft, CvSections } from "./cv-types";
import { EMPTY_CV, type CvDesign } from "./cv-types";
import type { TemplateId } from "./cv-design-presets";

const SAMPLE_SECTIONS: CvSections = {
  perfil: {
    nome: "João Mutola",
    headline: "Gestor de Projectos de Desenvolvimento",
    email: "j.mutola@email.co.mz",
    telefone: "+258 84 123 4567",
    cidade: "Maputo",
    pais: "Moçambique",
    linkedin: "linkedin.com/in/joaomutola",
    resumo:
      "<p>Gestor de projectos com 9 anos de experiência em programas de desenvolvimento financiados por agências internacionais. Forte em planeamento, monitoria &amp; avaliação e gestão de equipas multidisciplinares.</p>",
  },
  experiencia: [
    {
      id: "exp-1",
      cargo: "Gestor Sénior de Projecto",
      organizacao: "UNICEF Moçambique",
      local: "Maputo",
      inicio: "2021-03",
      fim: "atual",
      descricao:
        "<ul><li>Liderança de equipa de 12 pessoas em programa de educação em 4 províncias.</li><li>Gestão de orçamento anual de 2.4M USD com execução acima de 95%.</li></ul>",
    },
    {
      id: "exp-2",
      cargo: "Coordenador de Programa",
      organizacao: "World Vision",
      local: "Nampula",
      inicio: "2018-01",
      fim: "2021-02",
      descricao:
        "<ul><li>Coordenação de parcerias com governo distrital e comunidades locais.</li><li>Elaboração de relatórios para doadores com taxa de aprovação de 100%.</li></ul>",
    },
    {
      id: "exp-3",
      cargo: "Oficial de Projecto",
      organizacao: "Save the Children",
      local: "Beira",
      inicio: "2015-06",
      fim: "2017-12",
      descricao:
        "<ul><li>Implementação de actividades de campo e monitoria de indicadores.</li></ul>",
    },
  ],
  formacao: [
    {
      id: "form-1",
      curso: "Mestrado em Gestão de Projectos",
      instituicao: "Universidade Eduardo Mondlane",
      local: "Maputo",
      inicio: "2013",
      fim: "2015",
    },
    {
      id: "form-2",
      curso: "Licenciatura em Economia",
      instituicao: "UEM — Faculdade de Economia",
      local: "Maputo",
      inicio: "2009",
      fim: "2013",
    },
  ],
  competencias: [
    { id: "c-1", nome: "Gestão de Projectos", nivel: "especialista" },
    { id: "c-2", nome: "Monitoria & Avaliação", nivel: "avancado" },
    { id: "c-3", nome: "Gestão Orçamental", nivel: "avancado" },
    { id: "c-4", nome: "Liderança de Equipas", nivel: "avancado" },
    { id: "c-5", nome: "MS Excel", nivel: "avancado" },
  ],
  idiomas: [
    { id: "i-1", idioma: "Português", nivel: "nativo" },
    { id: "i-2", idioma: "Inglês", nivel: "fluente" },
    { id: "i-3", idioma: "Francês", nivel: "intermedio" },
  ],
  extras: [],
};

const TEMPLATE_ACCENT: Record<TemplateId, string> = {
  classico: "#1e3a5f",
  moderno: "#1a5454",
  compacto: "#6b2142",
  "visual-sidebar": "#3d4f1e",
  executivo: "#1f2937",
  editorial: "#475569",
  contraste: "#1D9E75",
  retrato: "#7f1d1d",
  destaque: "#6b21a8",
  direto: "#b45309",
  detalhado: "#1e3a5f",
  institucional: "#24425f",
  arco: "#24425f",
};

export function buildLandingSampleCv(templateId: TemplateId): CvDraft {
  const design: CvDesign = {
    ...EMPTY_CV.design,
    accentColor: TEMPLATE_ACCENT[templateId] ?? EMPTY_CV.design.accentColor,
  };

  return {
    title: "CV de exemplo",
    template: templateId,
    sections: SAMPLE_SECTIONS,
    design,
    updatedAt: new Date().toISOString(),
  };
}
