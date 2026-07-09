import {
  Mail,
  Phone,
  MapPin,
  MapPinHouse,
  Link2,
  Globe,
  IdCard,
  type LucideIcon,
} from "lucide-react";

export type ContactField =
  | "localizacao"
  | "email"
  | "telefone"
  | "linkedin"
  | "website"
  | "morada"
  | "cartaConducao";

export const CONTACT_ICONS: Record<ContactField, LucideIcon> = {
  localizacao: MapPin,
  email: Mail,
  telefone: Phone,
  linkedin: Link2,
  website: Globe,
  morada: MapPinHouse,
  cartaConducao: IdCard,
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

  return items;
}
