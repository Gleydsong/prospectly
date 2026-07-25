export type Locale = 'pt' | 'en';

type Dict = Record<string, string>;

const pt: Dict = {
  brand: 'Prospectly',
  navPricing: 'Preços',
  navLogin: 'Entrar',
  navCta: 'Começar grátis',
  heroTitle: 'Prospectly',
  heroLead: 'Ache empresas locais sem site e leve para o funil.',
  heroSubtitle:
    'Busca por cidade e categoria no OpenStreetMap e Google Places. Filtro sem website, pipeline e CSV no mesmo lugar.',
  heroPrimary: 'Começar grátis',
  heroSecondary: 'Ver preços',
  trustLabel: 'Feito para quem vende site, SEO e presença digital',
  problemTitle: 'Chega de copiar telefone do Maps',
  problemBody:
    'Agências e freelancers perdem manhãs inteiras listando negócios à mão. Prospectly busca o nicho, marca quem ainda não tem site e joga no pipeline.',
  filterTitle: 'O filtro que importa: sem website',
  filterBody:
    'Priorize negócios locais sem presença digital reportada. Menos volume inútil, mais conversa com quem precisa do que você vende.',
  howTitle: 'Do mapa ao contato em três passos',
  how1Title: 'Nicho e cidade',
  how1Body: 'Restaurantes em Lisboa, clínicas em São Paulo, hotéis no Porto.',
  how2Title: 'Quem precisa de site',
  how2Body: 'Filtre sem website e foque no ICP da sua oferta.',
  how3Title: 'Pipeline pronto',
  how3Body: 'Importe CSV, mova estágios e acompanhe tarefas sem planilha.',
  captureTitle: 'Passo a passo: captação de leads',
  captureSubtitle:
    'Do cadastro ao contato, o fluxo completo para achar negócios locais e organizar no pipeline.',
  captureActionLabel: 'No app:',
  proofTitle: 'Prospecção B2B local, com LGPD em mente',
  proofBody:
    'Para agências digitais e freelancers que usam Google Maps ou OpenStreetMap para achar clientes locais e querem um fluxo sério, não mais uma planilha solta.',
  ctaBandBefore: 'Pare de perder',
  ctaBandHighlight: 'horas no Maps',
  ctaBandAfter: 'e foque em fechar clientes.',
  ctaBandBody:
    'Extraia leads locais automaticamente. Enquanto a concorrência ainda copia telefone à mão, você já está no pipeline.',
  ctaBandPrimary: 'Começar grátis',
  ctaBandSecondary: 'Ver como funciona',
  ctaSignal1: 'OpenStreetMap e Google Places',
  ctaSignal2: 'Filtro de negócios sem website',
  ctaSignal3: 'Fluxo alinhado à LGPD',
  ctaSignal4: '3 buscas grátis para validar',
  faqTitle: 'Perguntas frequentes',
  faqSubtitle: 'Respostas diretas sobre busca, planos, filtro sem site e privacidade.',
  pricingTitle: 'Um plano. Mensal ou vitalício.',
  pricingSubtitle: 'Starter com BRL, EUR ou USD. Troque a moeda antes do checkout.',
  pricingCta: 'Ir para preços',
  monthly: 'Mensal',
  lifetime: 'Vitalício',
  currency: 'Moeda',
  planName: 'Starter',
  planFeatures:
    'Buscas OSM + Google Places|Filtro sem website|Importação CSV|Pipeline e tarefas|Suporte por e-mail',
  ctaMonthly: 'Assinar mensal',
  ctaLifetime: 'Comprar vitalício',
  perMonth: '/mês',
  oneTime: 'pagamento único',
  footerPrivacy: 'Privacidade',
  footerTerms: 'Termos',
  footerCookies: 'Cookies',
  footerTagline: 'Prospecção local para agências e freelancers.',
  cookieTitle: 'Cookies',
  cookieBody:
    'Usamos apenas cookies essenciais para o site funcionar. Analytics fica desligado por padrão.',
  cookieAccept: 'Entendi',
};

const en: Dict = {
  brand: 'Prospectly',
  navPricing: 'Pricing',
  navLogin: 'Log in',
  navCta: 'Start free',
  heroTitle: 'Prospectly',
  heroLead: 'Find local businesses without a website and move them into your funnel.',
  heroSubtitle:
    'Search by city and category on OpenStreetMap and Google Places. No-website filter, pipeline, and CSV in one place.',
  heroPrimary: 'Start free',
  heroSecondary: 'See pricing',
  trustLabel: 'Built for agencies selling websites, SEO, and digital presence',
  problemTitle: 'Stop copying phone numbers from Maps',
  problemBody:
    'Agencies and freelancers burn mornings listing businesses by hand. Prospectly searches the niche, flags who still has no website, and drops them into your pipeline.',
  filterTitle: 'The filter that matters: no website',
  filterBody:
    'Prioritize local businesses with no reported digital presence. Less useless volume, more outreach to people who need what you sell.',
  howTitle: 'From map to outreach in three steps',
  how1Title: 'Niche and city',
  how1Body: 'Restaurants in Lisbon, clinics in São Paulo, hotels in Porto.',
  how2Title: 'Who needs a site',
  how2Body: 'Filter no-website leads and focus on your ICP.',
  how3Title: 'Pipeline ready',
  how3Body: 'Import CSV, move stages, and track tasks without a side spreadsheet.',
  captureTitle: 'Step by step: lead capture',
  captureSubtitle:
    'From signup to outreach, the full flow to find local businesses and organize them in your pipeline.',
  captureActionLabel: 'In the app:',
  proofTitle: 'Local B2B prospecting, privacy-aware',
  proofBody:
    'For digital agencies and freelancers who use Google Maps or OpenStreetMap to find local clients and want a serious workflow, not another loose spreadsheet.',
  ctaBandBefore: 'Stop wasting',
  ctaBandHighlight: 'hours on Maps',
  ctaBandAfter: 'and focus on closing clients.',
  ctaBandBody:
    'Pull local leads automatically. While competitors still copy phone numbers by hand, you are already in the pipeline.',
  ctaBandPrimary: 'Start free',
  ctaBandSecondary: 'See how it works',
  ctaSignal1: 'OpenStreetMap and Google Places',
  ctaSignal2: 'No-website business filter',
  ctaSignal3: 'Privacy-aware LGPD defaults',
  ctaSignal4: '3 free searches to validate',
  faqTitle: 'Frequently asked questions',
  faqSubtitle: 'Straight answers on search, plans, the no-website filter, and privacy.',
  pricingTitle: 'One plan. Monthly or lifetime.',
  pricingSubtitle: 'Starter in BRL, EUR, or USD. Switch currency before checkout.',
  pricingCta: 'Go to pricing',
  monthly: 'Monthly',
  lifetime: 'Lifetime',
  currency: 'Currency',
  planName: 'Starter',
  planFeatures:
    'OSM + Google Places searches|No-website filter|CSV import|Pipeline and tasks|Email support',
  ctaMonthly: 'Subscribe monthly',
  ctaLifetime: 'Buy lifetime',
  perMonth: '/mo',
  oneTime: 'one-time payment',
  footerPrivacy: 'Privacy',
  footerTerms: 'Terms',
  footerCookies: 'Cookies',
  footerTagline: 'Local prospecting for agencies and freelancers.',
  cookieTitle: 'Cookies',
  cookieBody:
    'We only use essential cookies to run the site. Analytics is off by default.',
  cookieAccept: 'Got it',
};

const dictionaries: Record<Locale, Dict> = { pt, en };

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

const faqPt: FaqItem[] = [
  {
    id: 'what',
    question: 'O que o Prospectly faz?',
    answer:
      'Busca negócios locais por categoria e cidade (OpenStreetMap e Google Places), destaca quem não tem website reportado e organiza leads no pipeline com importação CSV.',
  },
  {
    id: 'free',
    question: 'Posso testar sem pagar?',
    answer:
      'Sim. O plano Free permite até 3 buscas para validar o fluxo. Depois, assine o Starter mensal ou compre o acesso vitalício.',
  },
  {
    id: 'filter',
    question: 'Como funciona o filtro sem website?',
    answer:
      'Nas buscas você pode priorizar negócios sem website reportado pelos provedores de mapas. Isso ajuda a focar em quem mais precisa de site, SEO ou presença digital.',
  },
  {
    id: 'sources',
    question: 'De onde vêm os dados?',
    answer:
      'De fontes de mapas: OpenStreetMap (via Nominatim/Overpass) e Google Places, quando a chave estiver configurada. A cobertura varia por cidade e categoria.',
  },
  {
    id: 'plans',
    question: 'Qual a diferença entre mensal e vitalício?',
    answer:
      'Mensal é assinatura recorrente via Stripe, cancelável no Customer Portal. Vitalício é pagamento único, sem renovação automática.',
  },
  {
    id: 'lgpd',
    question: 'E a LGPD?',
    answer:
      'Conta, consentimento de termos e páginas legais fazem parte do MVP. Dados públicos de mapas ainda exigem uso responsável no seu outreach. Solicitações de exclusão podem ser feitas pelo app ou por privacy@prospectly.dev.',
  },
];

const faqEn: FaqItem[] = [
  {
    id: 'what',
    question: 'What does Prospectly do?',
    answer:
      'It searches local businesses by category and city (OpenStreetMap and Google Places), highlights those with no reported website, and organizes leads in a pipeline with CSV import.',
  },
  {
    id: 'free',
    question: 'Can I try it without paying?',
    answer:
      'Yes. The Free plan allows up to 3 searches so you can validate the flow. Then subscribe to Starter monthly or buy lifetime access.',
  },
  {
    id: 'filter',
    question: 'How does the no-website filter work?',
    answer:
      'In searches you can prioritize businesses with no website reported by map providers. That helps you focus on leads who need a site, SEO, or digital presence.',
  },
  {
    id: 'sources',
    question: 'Where does the data come from?',
    answer:
      'From map sources: OpenStreetMap (Nominatim/Overpass) and Google Places when an API key is configured. Coverage varies by city and category.',
  },
  {
    id: 'plans',
    question: 'Monthly vs lifetime?',
    answer:
      'Monthly is a recurring Stripe subscription you can cancel in the Customer Portal. Lifetime is a one-time payment with no automatic renewal.',
  },
  {
    id: 'lgpd',
    question: 'What about privacy / LGPD?',
    answer:
      'Account consent, legal pages, and a data-request stub ship in the MVP. Public map data still requires responsible outreach. Deletion requests can go through the app or privacy@prospectly.dev.',
  },
];

export function getFaqItems(locale: Locale): FaqItem[] {
  return locale === 'en' ? faqEn : faqPt;
}

export type CaptureStep = {
  id: string;
  title: string;
  body: string;
  action: string;
};

const capturePt: CaptureStep[] = [
  {
    id: 'account',
    title: 'Crie sua conta e organização',
    body: 'Cadastre-se com e-mail, aceite os termos e abra a organização da sua agência ou freelance. O plano Free já libera 3 buscas para testar.',
    action: 'Register → confirme os termos → entre no app.',
  },
  {
    id: 'search',
    title: 'Monte a busca por nicho e cidade',
    body: 'Escolha o provedor (OpenStreetMap ou Google Places), uma ou mais categorias e a cidade. Dá para mirar restaurantes em Lisboa ou clínicas em São Paulo na mesma lógica.',
    action: 'Buscas → Nova busca → provedor, categorias e cidade.',
  },
  {
    id: 'filter',
    title: 'Ative o filtro sem website',
    body: 'Marque a opção para priorizar negócios sem website reportado. Assim a lista fica mais alinhada a quem precisa de site, SEO ou presença digital.',
    action: 'Na busca, ligue “somente sem website”.',
  },
  {
    id: 'review',
    title: 'Revise os resultados da busca',
    body: 'Acompanhe o status da busca, abra os resultados e confira telefone, endereço e sinais de website. Descarte o que não encaixa no seu ICP.',
    action: 'Abra a busca concluída → revise a lista de resultados.',
  },
  {
    id: 'pipeline',
    title: 'Importe para o pipeline e contate',
    body: 'Importe os leads escolhidos para o CRM interno, mova pelos estágios e registre tarefas. Sem planilha paralela para acompanhar o follow-up.',
    action: 'Importar selecionados → Pipeline / Tarefas.',
  },
];

const captureEn: CaptureStep[] = [
  {
    id: 'account',
    title: 'Create your account and organization',
    body: 'Sign up with email, accept the terms, and open your agency or freelance org. Free already includes 3 searches to try the flow.',
    action: 'Register → accept terms → open the app.',
  },
  {
    id: 'search',
    title: 'Set niche and city for the search',
    body: 'Pick the provider (OpenStreetMap or Google Places), one or more categories, and the city. Same flow for restaurants in Lisbon or clinics in São Paulo.',
    action: 'Searches → New search → provider, categories, city.',
  },
  {
    id: 'filter',
    title: 'Turn on the no-website filter',
    body: 'Enable the option to prioritize businesses with no reported website. The list stays closer to people who need a site, SEO, or digital presence.',
    action: 'In the search form, enable “only without website”.',
  },
  {
    id: 'review',
    title: 'Review the search results',
    body: 'Watch the search status, open results, and check phone, address, and website signals. Drop anything outside your ICP.',
    action: 'Open the completed search → review the result list.',
  },
  {
    id: 'pipeline',
    title: 'Import to the pipeline and outreach',
    body: 'Import selected leads into the built-in CRM, move stages, and track tasks. No side spreadsheet for follow-up.',
    action: 'Import selected → Pipeline / Tasks.',
  },
];

export function getCaptureSteps(locale: Locale): CaptureStep[] {
  return locale === 'en' ? captureEn : capturePt;
}

export function t(locale: Locale, key: string): string {
  return dictionaries[locale][key] ?? dictionaries.pt[key] ?? key;
}

export function prefix(locale: Locale): string {
  return locale === 'en' ? '/en' : '';
}
