import {
  ANGLE_LABELS,
  WHATSAPP_VARIANT_ANGLES,
  normalizeSeed,
  type LeadContextForWhatsappAi,
  type WhatsappVariant,
  type WhatsappVariantAngle,
} from './whatsapp-ai.types';

/**
 * Fallback packs inspired by B2B WhatsApp prospecting practice:
 * short (3 lines), personalize with real lead data, one soft question,
 * no links/attachments, no fake urgency — goal is a reply, not a pitch dump.
 * @see https://eesier.com.br/prospeccao-b2b-pelo-whatsapp
 * @see https://www.agendor.com.br/blog/prospecao-ativa-whatsapp/
 */

function companyLabel(lead: LeadContextForWhatsappAi): string {
  return (lead.tradeName?.trim() || lead.companyName).trim() || 'aí';
}

function cityBit(lead: LeadContextForWhatsappAi): string {
  const city = lead.city?.trim();
  return city ? ` em ${city}` : '';
}

function nicheBit(lead: LeadContextForWhatsappAi): string {
  const segment = lead.segment?.trim();
  return segment ? segment.toLowerCase() : 'negócio local';
}

function senderBit(lead: LeadContextForWhatsappAi): string {
  const sender = lead.senderName?.trim();
  return sender ? ` Sou ${sender}.` : '';
}

function hasWebsite(lead: LeadContextForWhatsappAi): boolean {
  return Boolean(lead.website?.trim());
}

type Pack = Record<WhatsappVariantAngle, (lead: LeadContextForWhatsappAi) => string>;

const PACKS: Pack[] = [
  {
    direto: (lead) =>
      `Olá! Vi o ${companyLabel(lead)}${cityBit(lead)} e achei relevante pelo perfil de ${nicheBit(lead)}.${senderBit(lead)}\n` +
      `Ajudo negócios locais a receber mais pedidos pelo WhatsApp sem depender só de indicação.\n` +
      `Faz sentido trocar 2 minutos sobre isso?`,
    curiosidade: (lead) =>
      `Oi! Pergunta rápida sobre o ${companyLabel(lead)}${cityBit(lead)}: a maior parte dos novos clientes chega por indicação, Google ou Instagram?${senderBit(lead)}\n` +
      `Tenho visto um padrão diferente em negócios de ${nicheBit(lead)} na região.\n` +
      `Posso te contar em uma mensagem curta?`,
    prova_social: (lead) =>
      `Olá! Negócios de ${nicheBit(lead)}${cityBit(lead) || ' locais'} têm respondido bem a um primeiro contacto simples no WhatsApp — sem disparo em massa.${senderBit(lead)}\n` +
      `O foco é abrir conversa com quem já está perto de comprar.\n` +
      `Quer que eu te mostre um exemplo parecido com o ${companyLabel(lead)}?`,
    dor_site: (lead) =>
      hasWebsite(lead)
        ? `Oi! Dei uma olhada rápida no site do ${companyLabel(lead)}.${senderBit(lead)}\n` +
          `Dá pra deixar o caminho até o WhatsApp mais claro e aumentar respostas sem mudar o visual inteiro.\n` +
          `Quer que eu te aponte o ponto principal?`
        : `Oi! Notei que o ${companyLabel(lead)}${cityBit(lead)} ainda não aparece com presença digital fácil de achar.${senderBit(lead)}\n` +
          `Muita gente da região busca no celular e desiste se não achar um WhatsApp claro.\n` +
          `Posso te mostrar um caminho simples pra isso?`,
    oferta_leve: (lead) =>
      `Olá, ${companyLabel(lead)}!${senderBit(lead)}\n` +
      `Sem compromisso: posso montar uma 1ª mensagem pronta pra você usar com clientes${cityBit(lead) || ' da região'}.\n` +
      `Se não fizer sentido, é só dizer e eu não insistirei. Quer ver um rascunho?`,
  },
  {
    direto: (lead) =>
      `Oi! Falo com o time do ${companyLabel(lead)}${cityBit(lead)}.${senderBit(lead)}\n` +
      `Trabalho com ${nicheBit(lead)} locais que querem mais conversas no WhatsApp sem parecer spam.\n` +
      `Topa eu te mostrar em 2 min o que tem funcionado?`,
    curiosidade: (lead) =>
      `Olá! Curiosidade sobre o ${companyLabel(lead)}: vocês acompanham quantos clientes pedem orçamento e não respondem?${senderBit(lead)}\n` +
      `Em ${nicheBit(lead)}, esse “sumiço” costuma ser o maior vazamento.\n` +
      `Quer uma ideia prática pra testar esta semana?`,
    prova_social: (lead) =>
      `Oi! Tenho visto donos de ${nicheBit(lead)}${cityBit(lead) || ''} ganharem resposta rápido com uma abordagem humana no WhatsApp (1 a 1).${senderBit(lead)}\n` +
      `Nada de lista automática — só mensagem curta e relevante.\n` +
      `Posso te enviar um modelo adaptado ao ${companyLabel(lead)}?`,
    dor_site: (lead) =>
      hasWebsite(lead)
        ? `Olá! No site do ${companyLabel(lead)} o próximo passo (WhatsApp) ainda pode ficar mais óbvio no celular.${senderBit(lead)}\n` +
          `Isso costuma travar pedidos mesmo quando a pessoa já tem interesse.\n` +
          `Quer que eu te diga o ajuste mais simples?`
        : `Olá! Busquei o ${companyLabel(lead)}${cityBit(lead)} e não achei um canal digital claro pra pedir pelo celular.${senderBit(lead)}\n` +
          `Hoje muita gente decide em minutos — se não achar WhatsApp, vai pro concorrente.\n` +
          `Faz sentido eu te mostrar um jeito leve de resolver?`,
    oferta_leve: (lead) =>
      `Oi, ${companyLabel(lead)}!${senderBit(lead)}\n` +
      `Posso te mandar 1 texto curto de abertura (pronto pra colar no WhatsApp) pensado pra ${nicheBit(lead)}${cityBit(lead)}.\n` +
      `Sem reunião longa. Quer que eu te envie aqui?`,
  },
  {
    direto: (lead) =>
      `Olá! Vi o ${companyLabel(lead)} e montei um ângulo específico pra ${nicheBit(lead)}${cityBit(lead)}.${senderBit(lead)}\n` +
      `A ideia é gerar conversa com cliente local — não pitch genérico.\n` +
      `Posso te mostrar o rascunho agora?`,
    curiosidade: (lead) =>
      `Oi! No ${companyLabel(lead)}, o que mais trava hoje: aparecer no Google, responder leads ou fechar pelo WhatsApp?${senderBit(lead)}\n` +
      `Pergunto porque cada um pede um primeiro contacto diferente.\n` +
      `Se me disser qual, te mando uma sugestão objetiva.`,
    prova_social: (lead) =>
      `Olá! Em ${nicheBit(lead)}, a 1ª mensagem que mais responde é curta, com contexto local e uma pergunta só.${senderBit(lead)}\n` +
      `Tenho um exemplo alinhado ao perfil do ${companyLabel(lead)}${cityBit(lead)}.\n` +
      `Quer ver?`,
    dor_site: (lead) =>
      hasWebsite(lead)
        ? `Oi! Analisei o fluxo do site do ${companyLabel(lead)} até o contacto.${senderBit(lead)}\n` +
          `Há um ponto onde o visitante pode se perder antes de abrir o WhatsApp.\n` +
          `Posso te explicar em 3 linhas?`
        : `Oi! O ${companyLabel(lead)}${cityBit(lead)} parece forte no atendimento, mas ainda frágil na descoberta online.${senderBit(lead)}\n` +
          `Um WhatsApp bem posicionado costuma recuperar pedidos que hoje se perdem.\n` +
          `Quer que eu te mostre como?`,
    oferta_leve: (lead) =>
      `Olá! Sem pitch longo: posso te entregar uma mensagem de 1ª abordagem pronta pro ${companyLabel(lead)}.${senderBit(lead)}\n` +
      `Você edita, copia e envia — a Prospectly não dispara nada sozinha.\n` +
      `Faz sentido?`,
  },
];

export function buildDeterministicWhatsappVariants(
  lead: LeadContextForWhatsappAi,
  count: number,
  seed = 0,
): WhatsappVariant[] {
  const packIndex = normalizeSeed(seed) % PACKS.length;
  const pack = PACKS[packIndex] ?? PACKS[0]!;
  const angles = WHATSAPP_VARIANT_ANGLES.slice(0, count);
  return angles.map((angle, index) => ({
    id: `fallback-${packIndex}-${angle}-${index + 1}`,
    angle,
    label: ANGLE_LABELS[angle],
    body: pack[angle](lead),
  }));
}

export function deterministicPackCount(): number {
  return PACKS.length;
}
