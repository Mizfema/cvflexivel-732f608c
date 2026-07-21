import {
  Mail,
  Phone,
  MapPin,
  MapPinHouse,
  Link2,
  Globe,
  IdCard,
  Calendar,
  VenusAndMars,
  Heart,
  type LucideIcon,
} from "lucide-react";

export type ContactField =
  | "localizacao"
  | "email"
  | "telefone"
  | "linkedin"
  | "website"
  | "morada"
  | "cartaConducao"
  | "dataNascimento"
  | "genero"
  | "estadoCivil";

export const CONTACT_ICONS: Record<ContactField, LucideIcon> = {
  localizacao: MapPin,
  email: Mail,
  telefone: Phone,
  linkedin: Link2,
  website: Globe,
  morada: MapPinHouse,
  cartaConducao: IdCard,
  dataNascimento: Calendar,
  genero: VenusAndMars,
  estadoCivil: Heart,
};

export type ContactInput = {
  email?: string | null;
  telefone?: string | null;
  cidade?: string | null;
  pais?: string | null;
  morada?: string | null;
  linkedin?: string | null;
  website?: string | null;
  cartaConducao?: string | null;
  dataNascimento?: string | null;
  genero?: string | null;
  estadoCivil?: string | null;
};

export type ContactItem = { field: ContactField; icon: LucideIcon; text: string };

/**
 * Converte os campos de contacto do perfil (CV ou carta) numa lista
 * itemizada com ícone — reutilizada pelo CV (useCvBlocks) e pela carta
 * (use-cover-letter-header), para não duplicar o mapeamento campo→ícone.
 */
export function buildContactItems(input: ContactInput): ContactItem[] {
  const items: ContactItem[] = [];

  const localizacao =
    input.cidade && input.pais ? `${input.cidade}, ${input.pais}` : input.cidade || input.pais;
  if (localizacao)
    items.push({ field: "localizacao", icon: CONTACT_ICONS.localizacao, text: localizacao });

  if (input.email) items.push({ field: "email", icon: CONTACT_ICONS.email, text: input.email });
  if (input.telefone)
    items.push({ field: "telefone", icon: CONTACT_ICONS.telefone, text: input.telefone });
  if (input.morada) items.push({ field: "morada", icon: CONTACT_ICONS.morada, text: input.morada });
  if (input.linkedin)
    items.push({ field: "linkedin", icon: CONTACT_ICONS.linkedin, text: input.linkedin });
  if (input.website)
    items.push({ field: "website", icon: CONTACT_ICONS.website, text: input.website });
  if (input.cartaConducao)
    items.push({
      field: "cartaConducao",
      icon: CONTACT_ICONS.cartaConducao,
      text: input.cartaConducao,
    });
  if (input.dataNascimento)
    items.push({
      field: "dataNascimento",
      icon: CONTACT_ICONS.dataNascimento,
      text: input.dataNascimento,
    });
  if (input.genero) items.push({ field: "genero", icon: CONTACT_ICONS.genero, text: input.genero });
  if (input.estadoCivil)
    items.push({ field: "estadoCivil", icon: CONTACT_ICONS.estadoCivil, text: input.estadoCivil });

  return items;
}
