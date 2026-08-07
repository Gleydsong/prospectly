export const WHATSAPP_VARIANT_ANGLES = [
  'direto',
  'curiosidade',
  'prova_social',
  'dor_site',
  'oferta_leve',
] as const;

export type WhatsappVariantAngle = (typeof WHATSAPP_VARIANT_ANGLES)[number];

export type WhatsappVariantSource = 'ollama' | 'fallback';

export type WhatsappVariant = {
  id: string;
  angle: WhatsappVariantAngle;
  label: string;
  body: string;
};

export type LeadContextForWhatsappAi = {
  companyName: string;
  tradeName?: string | null;
  city?: string | null;
  segment?: string | null;
  website?: string | null;
  ownerName?: string | null;
};

export const ANGLE_LABELS: Record<WhatsappVariantAngle, string> = {
  direto: 'Direto',
  curiosidade: 'Curiosidade',
  prova_social: 'Prova social',
  dor_site: 'Dor do site',
  oferta_leve: 'Oferta leve',
};

export function clampVariantCount(count?: number): number {
  if (count == null || Number.isNaN(count)) return 4;
  return Math.min(5, Math.max(3, Math.floor(count)));
}
