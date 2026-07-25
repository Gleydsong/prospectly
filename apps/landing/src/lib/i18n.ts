export type Locale = 'pt' | 'en';

type Dict = Record<string, string>;

const pt: Dict = {
  brand: 'Prospectly',
  navPricing: 'Preços',
  navLogin: 'Entrar',
  navCta: 'Começar grátis',
  heroEyebrow: 'Prospecção local para agências digitais',
  heroTitle: 'Encontre empresas sem site e transforme em clientes',
  heroSubtitle:
    'Prospectly usa OpenStreetMap e Google Places para achar negócios locais, filtrar quem ainda não tem presença digital e organizar o pipeline da sua agência ou freelance.',
  heroPrimary: 'Começar a prospectar',
  heroSecondary: 'Ver planos',
  problemTitle: 'Parar de caçar lead no Maps na mão',
  problemBody:
    'Agências e freelancers perdem horas copiando telefones do Google Maps. O Prospectly automatiza a busca por categoria e cidade, destaca quem não tem website e joga no funil.',
  howTitle: 'Como funciona',
  how1Title: 'Escolha nicho e cidade',
  how1Body: 'Restaurantes em Lisboa, clínicas em São Paulo, hotéis no Porto — multi-país.',
  how2Title: 'Filtre quem precisa de site',
  how2Body: 'Priorize negócios sem website reportado e foque no ICP da sua oferta.',
  how3Title: 'Organize e contate',
  how3Body: 'Importe CSV, mova no pipeline e acompanhe tarefas sem planilha paralela.',
  seoTitle: 'Ferramenta de prospecção de leads para agência digital',
  seoBody:
    'Ideal para quem busca prospecção de leads Google Maps / OpenStreetMap, quer encontrar empresas sem site e precisa de um SaaS de prospecção B2B local alinhado a LGPD.',
  pricingTitle: 'Preço simples para Brasil e Europa',
  pricingSubtitle: 'Assinatura mensal ou acesso vitalício. Troque a moeda antes de pagar.',
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
  heroEyebrow: 'Local prospecting for digital agencies',
  heroTitle: 'Find businesses without a website and turn them into clients',
  heroSubtitle:
    'Prospectly uses OpenStreetMap and Google Places to discover local businesses, filter those without a digital presence, and organize your agency or freelance pipeline.',
  heroPrimary: 'Start prospecting',
  heroSecondary: 'See pricing',
  problemTitle: 'Stop hunting leads manually on Maps',
  problemBody:
    'Agencies and freelancers waste hours copying phone numbers from Google Maps. Prospectly searches by category and city, highlights businesses without a website, and feeds your funnel.',
  howTitle: 'How it works',
  how1Title: 'Pick niche and city',
  how1Body: 'Restaurants in Lisbon, clinics in São Paulo, hotels in Porto — multi-country.',
  how2Title: 'Filter who needs a website',
  how2Body: 'Prioritize businesses with no reported website and focus your offer.',
  how3Title: 'Organize and outreach',
  how3Body: 'Import CSV, move deals in the pipeline, and track tasks without parallel spreadsheets.',
  seoTitle: 'Lead prospecting tool for digital agencies',
  seoBody:
    'Built for Google Maps / OpenStreetMap lead prospecting, finding businesses without a website, and local B2B SaaS workflows with privacy-first defaults.',
  pricingTitle: 'Simple pricing for Brazil and Europe',
  pricingSubtitle: 'Monthly subscription or lifetime access. Switch currency before checkout.',
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
  cookieTitle: 'Cookies',
  cookieBody:
    'We only use essential cookies to run the site. Analytics is off by default.',
  cookieAccept: 'Got it',
};

const dictionaries: Record<Locale, Dict> = { pt, en };

export function t(locale: Locale, key: string): string {
  return dictionaries[locale][key] ?? dictionaries.pt[key] ?? key;
}

export function prefix(locale: Locale): string {
  return locale === 'en' ? '/en' : '';
}
