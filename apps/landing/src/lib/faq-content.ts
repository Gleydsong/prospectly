import type { Locale } from '@/lib/pricing';

export type FaqCategory = 'product' | 'usage' | 'pricing' | 'data' | 'privacy';

export type FaqItem = {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
};

export const FAQ_CATEGORY_ORDER: FaqCategory[] = [
  'product',
  'usage',
  'pricing',
  'data',
  'privacy',
];

const categoryLabels: Record<Locale, Record<FaqCategory | 'all', string>> = {
  pt: {
    all: 'Todas',
    product: 'Produto',
    usage: 'Uso',
    pricing: 'Preços',
    data: 'Dados',
    privacy: 'Privacidade',
  },
  en: {
    all: 'All',
    product: 'Product',
    usage: 'How to use',
    pricing: 'Pricing',
    data: 'Data',
    privacy: 'Privacy',
  },
};

export function getFaqCategoryLabel(locale: Locale, category: FaqCategory | 'all'): string {
  return categoryLabels[locale][category];
}

const faqPt: FaqItem[] = [
  {
    id: 'what',
    category: 'product',
    question: 'O que o Prospectly faz?',
    answer:
      'Você escolhe categoria e cidade. O Prospectly busca negócios no OpenStreetMap e no Google Places, marca quem aparece sem website e joga a lista no pipeline. CSV entra no mesmo fluxo.',
  },
  {
    id: 'who',
    category: 'product',
    question: 'Para quem o Prospectly serve?',
    answer:
      'Para agências e freelancers que vendem site, SEO, Google Business ou presença digital a negócios locais. Se a sua prospecção começa no mapa, o fluxo encaixa.',
  },
  {
    id: 'not-sdr',
    category: 'product',
    question: 'O Prospectly liga e fecha a venda por mim?',
    answer:
      'Não. Você monta a lista e decide o contato. O app corta o tempo de achar quem ainda precisa do que você vende. A conversa continua com a sua equipa.',
  },
  {
    id: 'countries',
    category: 'product',
    question: 'Funciona fora do Brasil?',
    answer:
      'A busca cobre cidades no Brasil, conforme a cobertura do provedor de mapas. A interface aceita português e inglês.',
  },
  {
    id: 'first-search',
    category: 'usage',
    question: 'Como faço a primeira busca?',
    answer:
      'Crie a conta, abra Pesquisa, escolha o provedor, a categoria e a cidade. Em poucos minutos você vê resultados para rever e importar para o pipeline.',
  },
  {
    id: 'filter',
    category: 'usage',
    question: 'O que faz o filtro sem website?',
    answer:
      'Prioriza negócios em que o provedor de mapas não reporta website. A lista fica mais alinhada a quem precisa de site ou presença digital. Vale confirmar no outreach: o mapa pode estar desatualizado.',
  },
  {
    id: 'csv',
    category: 'usage',
    question: 'Posso trazer leads de um CSV?',
    answer:
      'Sim. Faça upload, mapeie as colunas e acompanhe o processamento. Os leads entram na mesma organização e no mesmo pipeline das buscas.',
  },
  {
    id: 'skills',
    category: 'usage',
    question: 'Preciso de conhecimento técnico?',
    answer:
      'Não. Se você já usa Maps para achar cliente, o fluxo do app é o próximo passo: busca, filtro, revisão e pipeline.',
  },
  {
    id: 'pipeline',
    category: 'usage',
    question: 'O pipeline substitui o meu CRM?',
    answer:
      'No MVP o pipeline organiza estágios e tarefas dentro do Prospectly. Exportação CSV libera depois da compra de créditos ou no plano ilimitado. Integrações nativas com HubSpot ou Pipedrive ficam para depois.',
  },
  {
    id: 'free',
    category: 'pricing',
    question: 'Posso testar sem pagar?',
    answer:
      'Sim. O Free inclui 3 execuções grátis (Pesquisa Maps e Opportunity Finder somadas) e 400 créditos de bónus. Depois compra pacotes (R$ 9,99 / R$ 19,99) ou assina o ilimitado (R$ 49,99/mês).',
  },
  {
    id: 'plans',
    category: 'pricing',
    question: 'Qual a diferença entre créditos e ilimitado?',
    answer:
      'Créditos avulsos (2.000 ou 5.000) acumulam, não expiram e não têm mensalidade. Cada busca Maps custa 14 créditos; Opportunity Finder custa 16. O ilimitado não debita créditos. CSV libera após a primeira compra de créditos ou no ilimitado.',
  },
  {
    id: 'currency',
    category: 'pricing',
    question: 'Quais moedas posso pagar?',
    answer:
      'Checkout apenas em BRL (Brasil). PIX e cartão via AbacatePay. Exemplos: 2.000 créditos por R$ 9,99; 5.000 por R$ 19,99; ilimitado por R$ 49,99/mês.',
  },
  {
    id: 'cancel',
    category: 'pricing',
    question: 'Como cancelo a assinatura mensal?',
    answer:
      'Cartão AbacatePay: cancele no app em Créditos (imediato). PIX mensal: também em Créditos. Assinaturas Stripe antigas: portal legado. Pacotes de créditos não têm renovação.',
  },
  {
    id: 'sources',
    category: 'data',
    question: 'De onde vêm os dados?',
    answer:
      'De fontes de mapas: OpenStreetMap (Nominatim/Overpass) e Google Places quando a chave estiver configurada. Nome, telefone, endereço e website vêm do que o provedor publica.',
  },
  {
    id: 'coverage',
    category: 'data',
    question: 'A cobertura é igual em toda cidade?',
    answer:
      'Não. Bairros densos e categorias populares costumam render mais. Cidades menores ou nichos estreitos podem devolver menos resultados. Vale testar as 3 buscas grátis no seu mercado.',
  },
  {
    id: 'osm-vs-google',
    category: 'data',
    question: 'OpenStreetMap ou Google Places?',
    answer:
      'Você não escolhe mais. Cada busca consulta as duas fontes quando disponíveis e une os resultados numa lista mais completa.',
  },
  {
    id: 'accuracy',
    category: 'data',
    question: 'Os telefones e sites estão sempre certos?',
    answer:
      'Os campos refletem o que o mapa reporta naquele momento. Negócios mudam de número e de site. Use a lista como ponto de partida e confirme no primeiro contacto.',
  },
  {
    id: 'lgpd',
    category: 'privacy',
    question: 'Como o Prospectly lida com LGPD?',
    answer:
      'Cadastro com aceite de termos, páginas legais e cookies essenciais por defeito. Dados públicos de mapas ainda pedem outreach responsável. Pedidos de exclusão: pelo app ou privacy@prospectly.dev.',
  },
  {
    id: 'cookies',
    category: 'privacy',
    question: 'Que cookies usam no site?',
    answer:
      'Só o necessário para o site funcionar. Analytics fica desligado por defeito. Detalhes na página de cookies.',
  },
  {
    id: 'delete',
    category: 'privacy',
    question: 'Como peço apagar a minha conta?',
    answer:
      'Peça no app ou escreva para privacy@prospectly.dev. Tratamos pedidos de titular no fluxo previsto nas páginas legais.',
  },
];

const faqEn: FaqItem[] = [
  {
    id: 'what',
    category: 'product',
    question: 'What does Prospectly do?',
    answer:
      'You pick a category and city. Prospectly searches OpenStreetMap and Google Places, flags businesses with no reported website, and moves the list into your pipeline. CSV imports use the same flow.',
  },
  {
    id: 'who',
    category: 'product',
    question: 'Who is Prospectly for?',
    answer:
      'Agencies and freelancers who sell websites, SEO, Google Business, or digital presence to local businesses. If your prospecting starts on a map, the workflow fits.',
  },
  {
    id: 'not-sdr',
    category: 'product',
    question: 'Does Prospectly call and close deals for me?',
    answer:
      'No. You build the list and own the outreach. The app cuts the time spent finding who still needs what you sell. Your team handles the conversation.',
  },
  {
    id: 'countries',
    category: 'product',
    question: 'Does it work outside Brazil?',
    answer:
      'Search covers cities in Brazil based on map provider coverage. The UI supports Portuguese and English.',
  },
  {
    id: 'first-search',
    category: 'usage',
    question: 'How do I run my first search?',
    answer:
      'Create an account, open Search, pick the provider, category, and city. In a few minutes you can review results and import them into the pipeline.',
  },
  {
    id: 'filter',
    category: 'usage',
    question: 'What does the no-website filter do?',
    answer:
      'It prioritizes businesses where the map provider reports no website. The list skews toward people who need a site or digital presence. Confirm during outreach: map data can lag.',
  },
  {
    id: 'csv',
    category: 'usage',
    question: 'Can I import leads from a CSV?',
    answer:
      'Yes. Upload the file, map the columns, and track processing. Leads land in the same organization and pipeline as map searches.',
  },
  {
    id: 'skills',
    category: 'usage',
    question: 'Do I need technical skills?',
    answer:
      'No. If you already find clients on Maps, the app is the next step: search, filter, review, pipeline.',
  },
  {
    id: 'pipeline',
    category: 'usage',
    question: 'Does the pipeline replace my CRM?',
    answer:
      'In the MVP, the pipeline handles stages and tasks inside Prospectly. CSV export unlocks after a credit purchase or on the unlimited plan. Native HubSpot or Pipedrive integrations come later.',
  },
  {
    id: 'free',
    category: 'pricing',
    question: 'Can I try it without paying?',
    answer:
      'Yes. Free includes 3 complimentary runs (Maps search and Opportunity Finder combined) plus 400 bonus credits. Then buy packs (R$ 9.99 / R$ 19.99) or subscribe to unlimited (R$ 49.99/month).',
  },
  {
    id: 'plans',
    category: 'pricing',
    question: 'Credits vs unlimited?',
    answer:
      'One-off credit packs (2,000 or 5,000) accumulate, never expire, and have no monthly fee. Each Maps search costs 14 credits; Opportunity Finder costs 16. Unlimited does not debit credits. CSV unlocks after the first credit purchase or on unlimited.',
  },
  {
    id: 'currency',
    category: 'pricing',
    question: 'Which currencies can I pay in?',
    answer:
      'Checkout is BRL only (Brazil). PIX and card via AbacatePay. Examples: 2,000 credits for R$ 9.99; 5,000 for R$ 19.99; unlimited for R$ 49.99/month.',
  },
  {
    id: 'cancel',
    category: 'pricing',
    question: 'How do I cancel a monthly plan?',
    answer:
      'AbacatePay card: cancel in-app under Credits (immediate). Monthly PIX: also under Credits. Legacy Stripe subscriptions: billing portal. Credit packs have no renewal.',
  },
  {
    id: 'sources',
    category: 'data',
    question: 'Where does the data come from?',
    answer:
      'Map sources: OpenStreetMap (Nominatim/Overpass) and Google Places when an API key is configured. Name, phone, address, and website come from what the provider publishes.',
  },
  {
    id: 'coverage',
    category: 'data',
    question: 'Is coverage the same in every city?',
    answer:
      'No. Dense neighborhoods and popular categories usually return more. Smaller cities or narrow niches can return less. Use the 3 free searches in your market.',
  },
  {
    id: 'osm-vs-google',
    category: 'data',
    question: 'OpenStreetMap or Google Places?',
    answer:
      'You no longer pick one. Each search queries both sources when available and merges the results for a denser list.',
  },
  {
    id: 'accuracy',
    category: 'data',
    question: 'Are phones and websites always accurate?',
    answer:
      'Fields mirror what the map reports at that moment. Businesses change numbers and sites. Treat the list as a starting point and confirm on first contact.',
  },
  {
    id: 'lgpd',
    category: 'privacy',
    question: 'How does Prospectly handle privacy / LGPD?',
    answer:
      'Signup with terms acceptance, legal pages, and essential cookies by default. Public map data still needs responsible outreach. Deletion requests: in-app or privacy@prospectly.dev.',
  },
  {
    id: 'cookies',
    category: 'privacy',
    question: 'What cookies does the site use?',
    answer:
      'Only what the site needs to run. Analytics stays off by default. Details live on the cookies page.',
  },
  {
    id: 'delete',
    category: 'privacy',
    question: 'How do I request account deletion?',
    answer:
      'Ask in the app or email privacy@prospectly.dev. We handle data-subject requests as described in the legal pages.',
  },
];

export function getFaqItems(locale: Locale): FaqItem[] {
  return locale === 'en' ? faqEn : faqPt;
}

export function getFaqItemsByCategory(locale: Locale, category: FaqCategory | 'all'): FaqItem[] {
  const items = getFaqItems(locale);
  if (category === 'all') return items;
  return items.filter((item) => item.category === category);
}

export function getHomeFaqItems(locale: Locale): FaqItem[] {
  const preferred = ['what', 'filter', 'free', 'plans', 'sources', 'lgpd'];
  const map = new Map(getFaqItems(locale).map((item) => [item.id, item]));
  return preferred.map((id) => map.get(id)).filter(Boolean) as FaqItem[];
}
