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
      'Sim. A busca cobre cidades no Brasil e na Europa, conforme a cobertura do provedor. A interface aceita português e inglês.',
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
      'No MVP o pipeline organiza estágios e tarefas dentro do Prospectly. Integrações nativas com HubSpot ou Pipedrive e exportação CSV ficam para depois — por agora o fluxo fica no app.',
  },
  {
    id: 'free',
    category: 'pricing',
    question: 'Posso testar sem pagar?',
    answer:
      'Sim. O Free libera até 3 buscas para validar o fluxo. Depois você assina o Starter mensal ou compra o acesso vitalício.',
  },
  {
    id: 'plans',
    category: 'pricing',
    question: 'Qual a diferença entre mensal e vitalício?',
    answer:
      'Mensal: assinatura Stripe que você cancela no portal do cliente. Vitalício: pagamento único, sem renovação automática. Os dois abrem o Starter com as mesmas funções principais.',
  },
  {
    id: 'currency',
    category: 'pricing',
    question: 'Quais moedas posso pagar?',
    answer:
      'BRL, EUR e USD. Na página de preços você escolhe a moeda antes do checkout. Exemplos: R$ 49/mês ou R$ 399 vitalício; € 10/mês ou € 99 vitalício; $ 10/mês ou $ 99 vitalício.',
  },
  {
    id: 'cancel',
    category: 'pricing',
    question: 'Como cancelo a assinatura mensal?',
    answer:
      'Pelo Customer Portal da Stripe, ligado à sua conta. Sem multa de fidelidade no modelo atual. O vitalício não tem cobrança recorrente para cancelar.',
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
      'OSM costuma bastar para começar sem custo de API. Google Places entra quando você quer outra cobertura na mesma cidade. Você escolhe o provedor em cada busca.',
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
      'Yes. Search covers cities in Brazil and Europe based on provider coverage. The UI supports Portuguese and English.',
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
      'In the MVP, the pipeline handles stages and tasks inside Prospectly. Native HubSpot or Pipedrive integrations and CSV export come later — for now the flow stays in the app.',
  },
  {
    id: 'free',
    category: 'pricing',
    question: 'Can I try it without paying?',
    answer:
      'Yes. Free includes up to 3 searches so you can validate the flow. Then subscribe to Starter monthly or buy lifetime access.',
  },
  {
    id: 'plans',
    category: 'pricing',
    question: 'Monthly vs lifetime?',
    answer:
      'Monthly is a Stripe subscription you cancel in the customer portal. Lifetime is a one-time payment with no auto-renewal. Both unlock the same core Starter features.',
  },
  {
    id: 'currency',
    category: 'pricing',
    question: 'Which currencies can I pay in?',
    answer:
      'BRL, EUR, and USD. Pick the currency on the pricing page before checkout. Examples: R$49/mo or R$399 lifetime; €10/mo or €99 lifetime; $10/mo or $99 lifetime.',
  },
  {
    id: 'cancel',
    category: 'pricing',
    question: 'How do I cancel a monthly plan?',
    answer:
      'Through Stripe’s Customer Portal linked to your account. No loyalty penalty in the current model. Lifetime has no recurring charge to cancel.',
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
      'OSM is a solid start without API cost. Google Places helps when you want another pass on the same city. You pick the provider per search.',
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
