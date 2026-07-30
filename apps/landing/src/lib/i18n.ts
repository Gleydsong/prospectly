export type Locale = 'pt' | 'en';

type Dict = Record<string, string>;

const pt: Dict = {
  brand: 'Prospectly',
  navHome: 'Início',
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
  problemTitle: 'Manhã no Maps, tarde sem pipeline',
  problemBody:
    'Abrir o Maps, copiar telefone, colar na planilha, repetir. Esse loop não escala. Prospectly faz a busca, corta quem já tem site e deixa a lista pronta no funil.',
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
  ctaBandBefore: 'Copiar lead do Maps',
  ctaBandHighlight: 'não é prospecção.',
  ctaBandAfter: '',
  ctaBandBody:
    'Prospectly busca o nicho, corta quem já tem site e joga no pipeline. Sem manhã perdida no Maps.',
  ctaBandPrimary: 'Começar grátis',
  ctaBandSecondary: 'Ver como funciona',
  ctaSignal1: 'OpenStreetMap e Google Places',
  ctaSignal2: 'Filtro de negócios sem website',
  ctaSignal3: 'Fluxo alinhado à LGPD',
  ctaSignal4: '3 buscas grátis para validar',
  faqTitle: 'Perguntas frequentes',
  faqSubtitle: 'Respostas diretas sobre busca, planos, filtro sem site e privacidade.',
  faqPageTitle: 'Dúvidas sobre o Prospectly',
  faqPageSubtitle:
    'Produto, uso, preços, origem dos dados e privacidade. Se faltar algo, escreva para hello@prospectly.dev.',
  faqAllLink: 'Ver FAQ completo',
  faqStillTitle: 'Ainda com dúvida?',
  faqStillBody: 'Abra a conta Free, rode as 3 buscas no seu nicho e veja se a lista faz sentido.',
  faqStillCta: 'Começar grátis',
  faqStillSecondary: 'Ver preços',
  navFaq: 'FAQ',
  footerFaq: 'FAQ',
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
  waitlistTitle: 'Entre na lista de espera',
  waitlistBody:
    'Deixe seu e-mail e avisamos quando liberar acesso. Sem spam — só o essencial para começar a prospectar.',
  waitlistEmailLabel: 'E-mail',
  waitlistEmailPlaceholder: 'seu@email.com',
  waitlistSubmit: 'Entrar na lista',
  waitlistSubmitting: 'Enviando…',
  waitlistSuccess: 'Você entrou na lista de espera. Confira seu e-mail.',
  waitlistError: 'Não foi possível cadastrar agora. Tente de novo em instantes.',
  waitlistHint: 'Usamos o e-mail só para avisar sobre o acesso.',
};

const en: Dict = {
  brand: 'Prospectly',
  navHome: 'Home',
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
  problemTitle: 'Morning on Maps, afternoon with no pipeline',
  problemBody:
    'Open Maps, copy a phone number, paste into a sheet, repeat. That loop does not scale. Prospectly runs the search, drops businesses that already have a site, and leaves the list ready in your funnel.',
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
  ctaBandBefore: 'Copying leads from Maps',
  ctaBandHighlight: 'is not prospecting.',
  ctaBandAfter: '',
  ctaBandBody:
    'Prospectly finds the niche, drops businesses with a site, and fills your pipeline. No morning lost on Maps.',
  ctaBandPrimary: 'Start free',
  ctaBandSecondary: 'See how it works',
  ctaSignal1: 'OpenStreetMap and Google Places',
  ctaSignal2: 'No-website business filter',
  ctaSignal3: 'Privacy-aware LGPD defaults',
  ctaSignal4: '3 free searches to validate',
  faqTitle: 'Frequently asked questions',
  faqSubtitle: 'Straight answers on search, plans, the no-website filter, and privacy.',
  faqPageTitle: 'Questions about Prospectly',
  faqPageSubtitle:
    'Product, usage, pricing, data sources, and privacy. If something is missing, email hello@prospectly.dev.',
  faqAllLink: 'See full FAQ',
  faqStillTitle: 'Still unsure?',
  faqStillBody: 'Open a Free account, run the 3 searches in your niche, and see if the list fits.',
  faqStillCta: 'Start free',
  faqStillSecondary: 'See pricing',
  navFaq: 'FAQ',
  footerFaq: 'FAQ',
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
  waitlistTitle: 'Join the waitlist',
  waitlistBody:
    'Leave your email and we’ll tell you when access opens. No spam — just what you need to start prospecting.',
  waitlistEmailLabel: 'Email',
  waitlistEmailPlaceholder: 'you@email.com',
  waitlistSubmit: 'Join waitlist',
  waitlistSubmitting: 'Sending…',
  waitlistSuccess: 'You’re on the waitlist. Check your email.',
  waitlistError: 'Could not join right now. Please try again in a moment.',
  waitlistHint: 'We only use your email to notify you about access.',
};

const dictionaries: Record<Locale, Dict> = { pt, en };

export { getFaqItems, getHomeFaqItems, type FaqItem } from '@/lib/faq-content';

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
