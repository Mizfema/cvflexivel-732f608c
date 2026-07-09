import {
  User,
  Briefcase,
  GraduationCap,
  Wrench,
  Languages,
  BookOpen,
  Building2,
  Award,
  Trophy,
  Users,
  Star,
  type LucideIcon,
} from "lucide-react";
import type { CvSecaoExtra } from "@/lib/cv-types";

/** Ícone por secção fixa do CV (Perfil, Experiência, Formação, Competências, Idiomas). */
export const SECTION_ICONS = {
  perfil: User,
  experiencia: Briefcase,
  formacao: GraduationCap,
  competencias: Wrench,
  idiomas: Languages,
} satisfies Record<string, LucideIcon>;

/** Ícone por tipo de secção extra dinâmica. */
export const EXTRA_TYPE_ICONS: Record<CvSecaoExtra["tipo"], LucideIcon> = {
  cursos: BookOpen,
  estagios: Building2,
  certificados: Award,
  realizacoes: Trophy,
  atividades: Users,
  qualidades: Star,
};
