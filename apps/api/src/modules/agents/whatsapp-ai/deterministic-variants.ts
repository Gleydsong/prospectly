import {
  ANGLE_LABELS,
  WHATSAPP_VARIANT_ANGLES,
  type LeadContextForWhatsappAi,
  type WhatsappVariant,
  type WhatsappVariantAngle,
} from './whatsapp-ai.types';

function companyLabel(lead: LeadContextForWhatsappAi): string {
  return (lead.tradeName?.trim() || lead.companyName).trim() || 'aí';
}

function cityBit(lead: LeadContextForWhatsappAi): string {
  const city = lead.city?.trim();
  return city ? ` em ${city}` : '';
}

function segmentBit(lead: LeadContextForWhatsappAi): string {
  const segment = lead.segment?.trim();
  return segment ? ` (${segment})` : '';
}

function ownerBit(lead: LeadContextForWhatsappAi): string {
  const owner = lead.ownerName?.trim();
  return owner ? ` Sou ${owner}.` : '';
}

function hasWebsite(lead: LeadContextForWhatsappAi): boolean {
  return Boolean(lead.website?.trim());
}

const TEMPLATES: Record<
  WhatsappVariantAngle,
  (lead: LeadContextForWhatsappAi) => string
> = {
  direto: (lead) =>
    `Olá! Vi o ${companyLabel(lead)}${cityBit(lead)}${segmentBit(lead)}.${ownerBit(lead)} Posso te mostrar em 2 min como atrair mais clientes locais pelo WhatsApp?`,
  curiosidade: (lead) =>
    `Oi! Curiosidade rápida sobre o ${companyLabel(lead)}${cityBit(lead)}: vocês já medem de onde vêm os novos clientes?${ownerBit(lead)} Tenho uma ideia simples pra testar esta semana.`,
  prova_social: (lead) =>
    `Olá! Negócios${cityBit(lead) || ' locais'} parecidos com o ${companyLabel(lead)} têm respondido bem a um primeiro contacto assistido no WhatsApp.${ownerBit(lead)} Quer que eu te envie um exemplo curto?`,
  dor_site: (lead) =>
    hasWebsite(lead)
      ? `Oi! Dei uma olhada no site do ${companyLabel(lead)}.${ownerBit(lead)} Dá pra melhorar a conversão pro WhatsApp com um ajuste leve — quer que eu te mostre o ponto principal?`
      : `Oi! Notei que o ${companyLabel(lead)}${cityBit(lead)} ainda não aparece com presença digital clara.${ownerBit(lead)} Posso te mostrar um caminho simples pra receber pedidos pelo WhatsApp?`,
  oferta_leve: (lead) =>
    `Olá, ${companyLabel(lead)}!${ownerBit(lead)} Sem compromisso: posso montar uma mensagem de 1ª abordagem pronta pra você usar com clientes${cityBit(lead) || ' da região'}. Faz sentido?`,
};

export function buildDeterministicWhatsappVariants(
  lead: LeadContextForWhatsappAi,
  count: number,
): WhatsappVariant[] {
  const angles = WHATSAPP_VARIANT_ANGLES.slice(0, count);
  return angles.map((angle, index) => ({
    id: `fallback-${angle}-${index + 1}`,
    angle,
    label: ANGLE_LABELS[angle],
    body: TEMPLATES[angle](lead),
  }));
}
