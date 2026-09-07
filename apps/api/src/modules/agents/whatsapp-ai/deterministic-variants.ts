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

function dorSiteCopy(lead: LeadContextForWhatsappAi, fallbackText: string): string {
  const audit = lead.auditSignals;
  if (audit?.hasWhatsappOnSite === false && hasWebsite(lead)) {
    return (
      `Oi! Dei uma olhada rápida no site do ${companyLabel(lead)}.${senderBit(lead)}\n` +
      `Notei que ainda não há um botão de WhatsApp direto no site para quem entra pelo celular.\n` +
      `Quer que eu te mostre como colocar isso em 5 minutos para não perder clientes?`
    );
  }
  if (audit?.isMobileFriendly === false && hasWebsite(lead)) {
    return (
      `Olá! Acessei o site do ${companyLabel(lead)} pelo celular.${senderBit(lead)}\n` +
      `Ele ainda não está adaptado para telas menores, o que costuma afastar quem busca na região.\n` +
      `Posso te mostrar o ponto exato que trava no mobile?`
    );
  }
  if (audit?.isSlow && hasWebsite(lead)) {
    return (
      `Oi! Fiz um teste rápido no site do ${companyLabel(lead)}.${senderBit(lead)}\n` +
      `O carregamento no celular demorou um pouco, e muitos clientes desistem antes de ver o contato.\n` +
      `Quer uma dica rápida para acelerar sem refazer o site?`
    );
  }
  return fallbackText;
}

type Pack = Record<WhatsappVariantAngle, (lead: LeadContextForWhatsappAi) => string>;

const FIRST_MESSAGE_PACKS: Pack[] = [
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
      dorSiteCopy(
        lead,
        hasWebsite(lead)
          ? `Oi! Dei uma olhada rápida no site do ${companyLabel(lead)}.${senderBit(lead)}\n` +
            `Dá pra deixar o caminho até o WhatsApp mais claro e aumentar respostas sem mudar o visual inteiro.\n` +
            `Quer que eu te aponte o ponto principal?`
          : `Oi! Notei que o ${companyLabel(lead)}${cityBit(lead)} ainda não aparece com presença digital fácil de achar.${senderBit(lead)}\n` +
            `Muita gente da região busca no celular e desiste se não achar um WhatsApp claro.\n` +
            `Posso te mostrar um caminho simples pra isso?`,
      ),
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
      dorSiteCopy(
        lead,
        hasWebsite(lead)
          ? `Olá! No site do ${companyLabel(lead)} o próximo passo (WhatsApp) ainda pode ficar mais óbvio no celular.${senderBit(lead)}\n` +
            `Isso costuma travar pedidos mesmo quando a pessoa já tem interesse.\n` +
            `Quer que eu te diga o ajuste mais simples?`
          : `Olá! Busquei o ${companyLabel(lead)}${cityBit(lead)} e não achei um canal digital claro pra pedir pelo celular.${senderBit(lead)}\n` +
            `Hoje muita gente decide em minutos — se não achar WhatsApp, vai pro concorrente.\n` +
            `Faz sentido eu te mostrar um jeito leve de resolver?`,
      ),
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
      dorSiteCopy(
        lead,
        hasWebsite(lead)
          ? `Oi! Analisei o fluxo do site do ${companyLabel(lead)} até o contacto.${senderBit(lead)}\n` +
            `Há um ponto onde o visitante pode se perder antes de abrir o WhatsApp.\n` +
            `Posso te explicar em 3 linhas?`
          : `Oi! O ${companyLabel(lead)}${cityBit(lead)} parece forte no atendimento, mas ainda frágil na descoberta online.${senderBit(lead)}\n` +
            `Um WhatsApp bem posicionado costuma recuperar pedidos que hoje se perdem.\n` +
            `Quer que eu te mostre como?`,
      ),
    oferta_leve: (lead) =>
      `Olá! Sem pitch longo: posso te entregar uma mensagem de 1ª abordagem pronta pro ${companyLabel(lead)}.${senderBit(lead)}\n` +
      `Você edita, copia e envia — a Prospectly não dispara nada sozinha.\n` +
      `Faz sentido?`,
  },
];

const FOLLOW_UP_1_PACKS: Pack[] = [
  {
    direto: (lead) =>
      `Olá, ${companyLabel(lead)}! Passando só pra saber se conseguiu ver a mensagem anterior que te enviei.${senderBit(lead)}\n` +
      `Sei que a rotina é corrida por aí. Faz sentido trocarmos 2 minutos sobre novos clientes esta semana?`,
    curiosidade: (lead) =>
      `Oi! Só um lembrete rápido sobre a pergunta que fiz do ${companyLabel(lead)}.${senderBit(lead)}\n` +
      `Se preferir, posso te resumir em uma linha o que outros ${nicheBit(lead)} locais têm feito. Conseguiu ver?`,
    prova_social: (lead) =>
      `Olá! Conseguiu ver a mensagem anterior?${senderBit(lead)}\n` +
      `Um negócio parecido com o ${companyLabel(lead)} na região começou a receber mais contatos com um ajuste leve no WhatsApp. Posso te mandar o exemplo?`,
    dor_site: (lead) =>
      `Oi! Só checando se você chegou a ver o apontamento sobre a presença digital do ${companyLabel(lead)}.${senderBit(lead)}\n` +
      `Se fizer sentido, te mando o ponto principal sem compromisso. Conseguiu dar uma olhada?`,
    oferta_leve: (lead) =>
      `Olá, ${companyLabel(lead)}!${senderBit(lead)}\n` +
      `Passando só para não deixar a conversa morrer. Conseguiu ver meu contato anterior ou a prioridade agora é outra?`,
  },
];

const FOLLOW_UP_2_PACKS: Pack[] = [
  {
    direto: (lead) =>
      `Oi, ${companyLabel(lead)}! Prometo ser breve.${senderBit(lead)}\n` +
      `Queria só compartilhar um dado rápido sobre captação de clientes para ${nicheBit(lead)}${cityBit(lead)} antes de arquivar aqui.\n` +
      `Faz sentido eu te mandar?`,
    curiosidade: (lead) =>
      `Olá! Uma curiosidade rápida: vocês já resolveram a captação de novos clientes no ${companyLabel(lead)} ou ainda é algo no radar?${senderBit(lead)}\n` +
      `Se estiver resolvido, ótimo! Se não, posso te ajudar em 2 minutos.`,
    prova_social: (lead) =>
      `Oi! Tenho visto donos de ${nicheBit(lead)} priorizarem o WhatsApp neste mês.${senderBit(lead)}\n` +
      `Se o ${companyLabel(lead)} ainda tiver interesse em acelerar conversas locais, me avisa por aqui!`,
    dor_site: (lead) =>
      `Olá! Última checagem sobre o canal digital do ${companyLabel(lead)}.${senderBit(lead)}\n` +
      `Ainda dá tempo de corrigir o contato digital antes do próximo mês. Vale uma conversa rápida?`,
    oferta_leve: (lead) =>
      `Oi! Sei como é o dia a dia corrido.${senderBit(lead)}\n` +
      `Se quiser, monto o rascunho sem custo e você só me diz se vale a pena testar no ${companyLabel(lead)}. O que acha?`,
  },
];

const BREAKUP_PACKS: Pack[] = [
  {
    direto: (lead) =>
      `Olá, ${companyLabel(lead)}! Como não tive retorno, imagino que o momento não seja ideal.${senderBit(lead)}\n` +
      `Não vou insistir para não incomodar. Se a prioridade mudar no futuro, fico à disposição!`,
    curiosidade: (lead) =>
      `Oi! Tudo bem? Estou encerrando as tentativas de contato por aqui para não ser chato.${senderBit(lead)}\n` +
      `Se a prioridade do ${companyLabel(lead)} mudar no futuro, é só me chamar. Um abraço!`,
    prova_social: (lead) =>
      `Olá! Entendo que a rotina está puxada e este não seja o foco agora.${senderBit(lead)}\n` +
      `Este é meu último contato para não lotar seu WhatsApp. Sucesso com o ${companyLabel(lead)}!`,
    dor_site: (lead) =>
      `Oi! Não vou insistir mais. Caso queiram rever o canal digital do ${companyLabel(lead)} mais adiante, meu contato fica por aqui.${senderBit(lead)}\n` +
      `Um ótimo trabalho para vocês!`,
    oferta_leve: (lead) =>
      `Olá, ${companyLabel(lead)}! Passando só para me despedir e deixar as portas abertas.${senderBit(lead)}\n` +
      `Não vou insistir mais. Se em algum momento fizer sentido, fico à disposição!`,
  },
];

function resolvePackList(stage?: string | null): Pack[] {
  switch (stage) {
    case 'FOLLOW_UP_1':
      return FOLLOW_UP_1_PACKS;
    case 'FOLLOW_UP_2':
      return FOLLOW_UP_2_PACKS;
    case 'BREAKUP':
      return BREAKUP_PACKS;
    default:
      return FIRST_MESSAGE_PACKS;
  }
}

export function buildDeterministicWhatsappVariants(
  lead: LeadContextForWhatsappAi,
  count: number,
  seed = 0,
): WhatsappVariant[] {
  const packs = resolvePackList(lead.sequenceStage);
  const packIndex = normalizeSeed(seed) % packs.length;
  const pack = packs[packIndex] ?? packs[0]!;
  const angles = WHATSAPP_VARIANT_ANGLES.slice(0, count);
  const stagePrefix = lead.sequenceStage ? `${lead.sequenceStage.toLowerCase()}-` : '';
  return angles.map((angle, index) => ({
    id: `fallback-${stagePrefix}${packIndex}-${angle}-${index + 1}`,
    angle,
    label: ANGLE_LABELS[angle],
    body: pack[angle](lead),
  }));
}

export function deterministicPackCount(stage?: string | null): number {
  return resolvePackList(stage).length;
}
