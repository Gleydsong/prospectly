/**
 * Referências de design injetadas no prompt (Ollama não navega a web).
 * Espelham padrões de landings locais de alta conversão por vertical.
 */
export function buildDesignReferenceBrief(input: {
  category?: string | null;
  segment?: string | null;
  companyName?: string | null;
}): string {
  const haystack = [input.category, input.segment, input.companyName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const vertical = matchVertical(haystack);
  const shared = [
    'Referências de design premium (aplicar na estrutura e no tom, sem copiar marca alheia):',
    '- Estética editorial/contemporânea: fotos reais definem clima e sofisticação',
    '- Hero full-bleed com foto real do estabelecimento + headline curta + CTA único dominante',
    '- Tipografia hierárquica (1 headline, 1 subtítulo, corpo legível); muito respiro; sem poluição de badges',
    '- Prova social cedo (nota Google / depoimentos reais quando existirem)',
    '- Galeria premium com fotos reais do local (ambiente, fachada, equipe, resultado)',
    '- Seções com um único propósito; mobile-first; contraste alto em CTAs',
    '- Evitar visual de template/dashboard, cards excessivos e filler genérico',
    '- Paleta: variant brand no hero/CTA principal; zinc em seções secundárias',
    '- Arco narrativo: hero → apresentação → gallery → serviços → prova → contacto/CTA final',
  ];

  const byVertical: Record<string, string[]> = {
    beauty: [
      'Vertical: beleza / barbearia / salão',
      'Inspirar-se em: landings premium de barbearias (foto close do corte, ambiente escuro/quente, CTA “Agendar”)',
      'Tom: confiança, estilo, cuidado; serviços em cards curtos (corte, barba, combo)',
    ],
    food: [
      'Vertical: restaurante / café / food',
      'Inspirar-se em: sites de restaurantes com hero gastronômico, cardápio em destaque, reserva/WhatsApp',
      'Tom: apetite, localidade, horário implícito; galeria de pratos e salão',
    ],
    health: [
      'Vertical: saúde / clínica / odontologia',
      'Inspirar-se em: clínicas modernas (hero limpo, confiança, benefícios, FAQ de primeira visita)',
      'Tom: acolhedor, profissional, sem alarmismo; CTA “Agendar avaliação”',
    ],
    fitness: [
      'Vertical: academia / pilates / esportes',
      'Inspirar-se em: gyms com energia visual, planos/serviços claros, prova social de transformação',
      'Tom: motivação + clareza de oferta; CTA “Começar agora”',
    ],
    auto: [
      'Vertical: auto / oficina / estética automotiva',
      'Inspirar-se em: oficinas com before/after implícito, serviços técnicos claros, confiança local',
      'Tom: expertise + transparência; fotos da oficina e frota/trabalhos',
    ],
    professional: [
      'Vertical: serviços profissionais / B2B local',
      'Inspirar-se em: consultorias enxutas (hero com proposta de valor, benefícios, cases curtos, CTA contato)',
      'Tom: autoridade sem jargão; foco em resultado e próximo passo',
    ],
    retail: [
      'Vertical: varejo / loja local',
      'Inspirar-se em: lojas com vitrine digital, destaques de produto/serviço, mapa e horário',
      'Tom: convite à visita; fotos da loja e produtos',
    ],
    default: [
      'Vertical: negócio local genérico',
      'Inspirar-se em: landings locais de alta conversão (hero foto + oferta + prova + formulário/WhatsApp)',
      'Tom: claro, local, acionável; zero filler genérico de “soluções inovadoras”',
    ],
  };

  const verticalLines = byVertical[vertical] ?? byVertical.default ?? [];
  return [...shared, ...verticalLines].join('\n');
}

function matchVertical(haystack: string): string {
  if (
    /(barbear|salão|salao|beleza|beauty|cabelo|unha|estética|estetica|spa|manicure)/.test(
      haystack,
    )
  ) {
    return 'beauty';
  }
  if (
    /(restaur|café|cafe|padaria|pizz|hambur|food|lanch|bar |pub|churrasc|sorvete)/.test(
      haystack,
    )
  ) {
    return 'food';
  }
  if (
    /(clínic|clinic|odont|dent|médic|medic|fisio|psico|saúde|saude|hospital|veterin)/.test(
      haystack,
    )
  ) {
    return 'health';
  }
  if (/(academia|gym|pilates|crossfit|yoga|treino|fitness)/.test(haystack)) {
    return 'fitness';
  }
  if (/(oficina|auto|mecân|mecan|funilar|estética autom|lavagem|detail)/.test(haystack)) {
    return 'auto';
  }
  if (/(advoc|contab|consult|imóbil|imobil|seguro|arquitet|engenh)/.test(haystack)) {
    return 'professional';
  }
  if (/(loja|varejo|mercado|pet shop|farmácia|farmacia|ótic|otic)/.test(haystack)) {
    return 'retail';
  }
  return 'default';
}
