export type Locale = 'pt' | 'en';

type Dict = Record<string, string>;

const pt: Dict = {
  brand: 'Prospectly',
  navHome: 'Início',
  navPricing: 'Preços',
  navLogin: 'Entrar',
  navCta: 'Criar minha primeira lista',
  heroEyebrow: 'Prospecção B2B inteligente para o mercado brasileiro',
  heroTitle: 'Prospectly',
  heroLead: 'Encontre empresas ideais para prospectar no Brasil.',
  heroSubtitle:
    'Transforme seu perfil de cliente ideal em listas segmentadas de empresas, prontas para sua equipe comercial encontrar novas oportunidades.',
  heroPrimary: 'Criar minha primeira lista',
  heroSecondary: 'Ver como funciona',
  trustLabel: 'Transparência e cuidado com dados desde o primeiro contato',
  trustItem1Title: 'Fontes públicas de mapa',
  trustItem1Body: 'Buscas via OpenStreetMap e, quando disponível, Google Places.',
  trustItem2Title: '3 buscas no Free',
  trustItem2Body: 'Valide o fluxo no seu nicho antes de comprar créditos ou assinar o ilimitado.',
  trustItem3Title: 'Privacidade e termos',
  trustItem3Body: 'Política de privacidade, termos e cookies essenciais publicados.',
  trustItem4Title: 'Suporte por e-mail',
  trustItem4Body: 'Dúvidas de produto: hello@prospectly.dev · privacidade: privacy@prospectly.dev.',
  trustTodoNote:
    'TODO: incluir depoimentos ou cases reais assim que houver clientes autorizados — sem logos fictícios.',
  problemTitle: 'Prospecção manual custa tempo e lista ruim',
  problemBody:
    'Abrir o Maps, copiar telefone, colar na planilha e repetir. Planilhas desatualizadas e várias ferramentas soltas atrasam a equipe. O resultado é lista incompleta e follow-up perdido.',
  problemCard1Title: 'Maps e cópia manual',
  problemCard1Body: 'Horas em busca pontual, sem histórico nem filtro consistente.',
  problemCard2Title: 'Planilha desatualizada',
  problemCard2Body: 'Contatos espalhados, sem estágio claro nem dono do follow-up.',
  problemCard3Title: 'Ferramentas fragmentadas',
  problemCard3Body: 'Uma para achar, outra para anotar, outra para lembrar de ligar.',
  filterTitle: 'Do filtro à lista, com o que o mapa realmente reporta',
  filterBody:
    'Priorize negócios sem website reportado no mapa. Isso indica ausência de site na fonte — não é confirmação absoluta. Use para focar no ICP e validar no contato.',
  howTitle: 'Como funciona',
  howSubtitle: 'Três passos do perfil de cliente ideal até a lista organizada para prospecção.',
  captureTitle: 'Como funciona',
  captureSubtitle:
    'Defina o ICP, filtre empresas por critérios relevantes e organize a lista no pipeline interno.',
  captureActionLabel: 'No app:',
  audienceTitle: 'Feito para quem vive de prospecção B2B',
  audienceSubtitle: 'Casos de uso concretos por tipo de operação — sem promessas de resultado inventadas.',
  audienceAgencyTitle: 'Agências B2B e de performance',
  audienceAgencyBody:
    'Monte listas de empresas locais por categoria e cidade para ofertar site, SEO ou mídia. Filtre quem já tem presença digital reportada e foque no restante.',
  audienceConsultingTitle: 'Consultorias B2B',
  audienceConsultingBody:
    'Separe contas por região e nicho alinhados ao seu ICP. Importe o que importa para o pipeline e acompanhe o follow-up sem planilha paralela.',
  audienceSoftwareTitle: 'Software houses',
  audienceSoftwareBody:
    'Encontre empresas do setor-alvo na região em que você vende. Organize leads e tarefas no mesmo fluxo antes da primeira conversa comercial.',
  audienceSalesTitle: 'Equipes comerciais PME',
  audienceSalesBody:
    'Troque a manhã no Maps por buscas com filtro e lista no funil. Use as 3 buscas Free para validar o nicho da equipe.',
  diffsTitle: 'O que diferencia a Prospectly',
  diffsSubtitle: 'Posicionamento claro: empresas brasileiras, do ICP à lista, com menos trabalho manual.',
  diff1Title: 'Foco em empresas no Brasil',
  diff1Body: 'Busca local por categoria e cidade em todo o Brasil.',
  diff2Title: 'Do ICP à lista, sem rodeio',
  diff2Body: 'Categoria, local e filtros relevantes — inclusive sem website reportado — para montar a lista com intenção.',
  diff3Title: 'Prospecção organizada',
  diff3Body: 'Leads, estágios e tarefas no pipeline interno. Sem depender de planilha solta para o follow-up.',
  diff4Title: 'Menos trabalho manual',
  diff4Body: 'Menos copiar e colar do mapa. Mais tempo para contatar quem entrou na lista.',
  finalTitle: 'Encontre empresas ideais para prospectar no Brasil',
  finalBody:
    'Crie sua primeira lista a partir do perfil de cliente ideal — e organize a prospecção no mesmo lugar.',
  finalPrimary: 'Começar a criar minha lista',
  finalSecondary: 'Falar com a equipe',
  ctaBandPrimary: 'Criar minha primeira lista',
  ctaBandSecondary: 'Ver como funciona',
  ctaTalkTeam: 'Falar com a equipe',
  mockFiltersLabel: 'Filtros',
  mockCategoryLabel: 'Categoria',
  mockCategoryValue: 'Clínicas odontológicas',
  mockCityLabel: 'Cidade',
  mockCityValue: 'Curitiba, PR',
  mockFilterChip: 'Sem website reportado',
  mockResultsLabel: 'Empresas encontradas',
  mockListLabel: 'Lista qualificada',
  mockListHint: 'Selecionadas para o pipeline',
  mockCompany1: 'Clínica Centro Sul',
  mockCompany2: 'Odonto Bairro Alto',
  mockCompany3: 'Smile Estação',
  mockStatusReview: 'Para revisar',
  faqTitle: 'Perguntas frequentes',
  faqSubtitle: 'Respostas diretas sobre busca, planos, filtro sem site e privacidade.',
  faqPageTitle: 'Dúvidas sobre o Prospectly',
  faqPageSubtitle:
    'Produto, uso, preços, origem dos dados e privacidade. Se faltar algo, escreva para hello@prospectly.dev.',
  faqAllLink: 'Ver FAQ completo',
  faqStillTitle: 'Ainda com dúvida?',
  faqStillBody: 'Entre na lista ou veja os preços de créditos e do plano ilimitado. Quando o app abrir, você valida o fluxo no seu nicho.',
  faqStillCta: 'Criar minha primeira lista',
  faqStillSecondary: 'Ver preços',
  navFaq: 'FAQ',
  footerFaq: 'FAQ',
  pricingTitle: 'Créditos ou ilimitado.',
  pricingSubtitle: 'Pacotes de créditos ou assinatura ilimitada em BRL.',
  pricingCta: 'Ir para preços',
  monthly: 'Mensal',
  lifetime: 'Créditos',
  currency: 'Moeda',
  planName: 'Ilimitado',
  planFeatures:
    'Buscas OSM + Google Places|Filtro sem website|Importação CSV|Pipeline e tarefas|Suporte por e-mail',
  ctaMonthly: 'Assinar ilimitado',
  ctaLifetime: 'Comprar créditos',
  perMonth: '/mês',
  oneTime: 'pagamento único',
  footerPrivacy: 'Privacidade',
  footerTerms: 'Termos',
  footerCookies: 'Cookies',
  footerTagline: 'Encontre empresas ideais para prospectar no Brasil.',
  cookieTitle: 'Cookies',
  cookieBody:
    'Usamos apenas cookies essenciais para o site funcionar. Analytics fica desligado por padrão.',
  cookieAccept: 'Apenas essenciais',
  cookiePolicy: 'Política de cookies',
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
  enterBadge: 'App em preparação',
  enterTitle: 'O login ainda não está aberto',
  enterLead:
    'Estamos finalizando o Prospectly para equipes B2B. Enquanto isso, veja o fluxo e entre na lista — avisamos quando liberar o acesso para criar sua primeira lista.',
  enterCtaWaitlist: 'Entrar na lista de espera',
  enterCtaHome: 'Voltar ao início',
  enterHowTitle: 'Como o Prospectly funciona',
  enterHowBody:
    'Do perfil de cliente ideal à lista organizada. Três passos para encontrar empresas e prospectar com método.',
  enterStep1Title: 'Defina o cliente ideal',
  enterStep1Body: 'Escolha categoria e local. Buscamos no OpenStreetMap e no Google Places quando disponível.',
  enterStep2Title: 'Filtre com critérios relevantes',
  enterStep2Body:
    'Inclua o filtro sem website reportado para priorizar quem o mapa não associa a site. Valide no contato.',
  enterStep3Title: 'Organize a lista',
  enterStep3Body: 'Importe para leads e pipeline interno, com tarefas — sem copiar telefone do Maps.',
  enterWhyTitle: 'Por que entrar na lista',
  enterWhyBody:
    'Não é mais uma planilha. É um fluxo de prospecção B2B local para quem precisa de listas alinhadas ao ICP.',
  enterWhy1: 'Busca local com filtro “sem website” reportado',
  enterWhy2: 'Pipeline e tarefas no mesmo lugar',
  enterWhy3: 'Lista de espera — sem spam, só o aviso de acesso',
  enterWaitlistTitle: 'Garanta seu lugar na fila',
  enterWaitlistBody:
    'Deixe o e-mail. Quando o app abrir, você recebe o convite antes da abertura ampla.',
};

const en: Dict = {
  brand: 'Prospectly',
  navHome: 'Home',
  navPricing: 'Pricing',
  navLogin: 'Log in',
  navCta: 'Create my first list',
  heroEyebrow: 'B2B prospecting built for the Brazilian market',
  heroTitle: 'Prospectly',
  heroLead: 'Find companies worth prospecting in Brazil.',
  heroSubtitle:
    'Turn your ideal customer profile into segmented company lists, ready for your sales team to pursue new opportunities.',
  heroPrimary: 'Create my first list',
  heroSecondary: 'See how it works',
  trustLabel: 'Transparency and careful data handling from the first visit',
  trustItem1Title: 'Public map sources',
  trustItem1Body: 'Search via OpenStreetMap and, when available, Google Places.',
  trustItem2Title: '3 Free searches',
  trustItem2Body: 'Validate the flow in your niche before buying credits or subscribing to unlimited.',
  trustItem3Title: 'Privacy and terms',
  trustItem3Body: 'Published privacy policy, terms, and essential-only cookies.',
  trustItem4Title: 'Email support',
  trustItem4Body: 'Product: hello@prospectly.dev · privacy: privacy@prospectly.dev.',
  trustTodoNote:
    'TODO: add real testimonials or case studies once authorized customers exist — no fictional logos.',
  problemTitle: 'Manual prospecting costs time and weak lists',
  problemBody:
    'Open Maps, copy a phone number, paste into a sheet, repeat. Stale spreadsheets and scattered tools slow the team down. You get incomplete lists and lost follow-up.',
  problemCard1Title: 'Maps and copy-paste',
  problemCard1Body: 'Hours of one-off searching with no history or consistent filters.',
  problemCard2Title: 'Stale spreadsheet',
  problemCard2Body: 'Contacts everywhere, no clear stage or owner for follow-up.',
  problemCard3Title: 'Fragmented tools',
  problemCard3Body: 'One to find, one to note, another to remember to call.',
  filterTitle: 'From filter to list, based on what the map reports',
  filterBody:
    'Prioritize businesses with no website reported on the map. That signals missing site data in the source — not absolute proof. Use it to focus your ICP and validate in outreach.',
  howTitle: 'How it works',
  howSubtitle: 'Three steps from ideal customer profile to an organized prospecting list.',
  captureTitle: 'How it works',
  captureSubtitle:
    'Define the ICP, filter companies by relevant criteria, and organize the list in the built-in pipeline.',
  captureActionLabel: 'In the app:',
  audienceTitle: 'Built for teams that live on B2B prospecting',
  audienceSubtitle: 'Concrete use cases by operation type — no invented outcome claims.',
  audienceAgencyTitle: 'B2B and performance agencies',
  audienceAgencyBody:
    'Build local company lists by category and city to offer websites, SEO, or media. Filter those with reported digital presence and focus on the rest.',
  audienceConsultingTitle: 'B2B consultancies',
  audienceConsultingBody:
    'Segment accounts by region and niche aligned to your ICP. Import what matters into the pipeline and track follow-up without a side spreadsheet.',
  audienceSoftwareTitle: 'Software houses',
  audienceSoftwareBody:
    'Find target-sector companies in the regions you sell. Organize leads and tasks in one flow before the first sales conversation.',
  audienceSalesTitle: 'SME sales teams',
  audienceSalesBody:
    'Replace a morning on Maps with filtered searches and a funnel list. Use 3 Free searches to validate the team’s niche.',
  diffsTitle: 'What sets Prospectly apart',
  diffsSubtitle: 'Clear positioning: Brazilian companies, ICP to list, less manual work.',
  diff1Title: 'Focus on companies in Brazil',
  diff1Body: 'Local search by category and city across Brazil.',
  diff2Title: 'ICP to list, without detours',
  diff2Body: 'Category, location, and relevant filters — including no reported website — to build an intentional list.',
  diff3Title: 'Organized prospecting',
  diff3Body: 'Leads, stages, and tasks in the built-in pipeline. No loose spreadsheet for follow-up.',
  diff4Title: 'Less manual work',
  diff4Body: 'Less copy-paste from the map. More time contacting who made the list.',
  finalTitle: 'Find companies worth prospecting in Brazil',
  finalBody:
    'Build your first list from the ideal customer profile — and keep prospecting organized in one place.',
  finalPrimary: 'Start creating my list',
  finalSecondary: 'Talk to the team',
  ctaBandPrimary: 'Create my first list',
  ctaBandSecondary: 'See how it works',
  ctaTalkTeam: 'Talk to the team',
  mockFiltersLabel: 'Filters',
  mockCategoryLabel: 'Category',
  mockCategoryValue: 'Dental clinics',
  mockCityLabel: 'City',
  mockCityValue: 'Curitiba, PR',
  mockFilterChip: 'No website reported',
  mockResultsLabel: 'Companies found',
  mockListLabel: 'Qualified list',
  mockListHint: 'Selected for the pipeline',
  mockCompany1: 'Centro Sul Clinic',
  mockCompany2: 'Bairro Alto Dental',
  mockCompany3: 'Smile Station',
  mockStatusReview: 'To review',
  faqTitle: 'Frequently asked questions',
  faqSubtitle: 'Straight answers on search, plans, the no-website filter, and privacy.',
  faqPageTitle: 'Questions about Prospectly',
  faqPageSubtitle:
    'Product, usage, pricing, data sources, and privacy. If something is missing, email hello@prospectly.dev.',
  faqAllLink: 'See full FAQ',
  faqStillTitle: 'Still unsure?',
  faqStillBody: 'Join the waitlist or see credit and unlimited pricing. When the app opens, validate the flow in your niche.',
  faqStillCta: 'Create my first list',
  faqStillSecondary: 'See pricing',
  navFaq: 'FAQ',
  footerFaq: 'FAQ',
  pricingTitle: 'Credits or unlimited.',
  pricingSubtitle: 'Credit packs or unlimited subscription in BRL.',
  pricingCta: 'Go to pricing',
  monthly: 'Monthly',
  lifetime: 'Credits',
  currency: 'Currency',
  planName: 'Unlimited',
  planFeatures:
    'OSM + Google Places searches|No-website filter|CSV import|Pipeline and tasks|Email support',
  ctaMonthly: 'Subscribe unlimited',
  ctaLifetime: 'Buy credits',
  perMonth: '/mo',
  oneTime: 'one-time payment',
  footerPrivacy: 'Privacy',
  footerTerms: 'Terms',
  footerCookies: 'Cookies',
  footerTagline: 'Find companies worth prospecting in Brazil.',
  cookieTitle: 'Cookies',
  cookieBody:
    'We only use essential cookies to run the site. Analytics is off by default.',
  cookieAccept: 'Essential only',
  cookiePolicy: 'Cookie policy',
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
  enterBadge: 'App in preparation',
  enterTitle: 'Login is not open yet',
  enterLead:
    'We’re finishing Prospectly for B2B teams. Meanwhile, see the flow and join the waitlist — we’ll email you when you can create your first list.',
  enterCtaWaitlist: 'Join the waitlist',
  enterCtaHome: 'Back to home',
  enterHowTitle: 'How Prospectly works',
  enterHowBody:
    'From ideal customer profile to an organized list. Three steps to find companies and prospect with a method.',
  enterStep1Title: 'Define the ideal customer',
  enterStep1Body: 'Pick a category and place. We search OpenStreetMap and Google Places when available.',
  enterStep2Title: 'Filter with relevant criteria',
  enterStep2Body:
    'Include the no-website-reported filter to prioritize listings the map does not associate with a site. Validate in outreach.',
  enterStep3Title: 'Organize the list',
  enterStep3Body: 'Import into leads and the built-in pipeline, with tasks — no copying phones from Maps.',
  enterWhyTitle: 'Why join the waitlist',
  enterWhyBody:
    'Not another spreadsheet. A local B2B prospecting flow for teams that need ICP-aligned lists.',
  enterWhy1: 'Local search with a “no website reported” filter',
  enterWhy2: 'Pipeline and tasks in one place',
  enterWhy3: 'Waitlist first — no spam, just the access notice',
  enterWaitlistTitle: 'Save your spot',
  enterWaitlistBody:
    'Leave your email. When the app opens, you get the invite before the wider launch.',
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
    id: 'icp',
    title: 'Defina seu cliente ideal',
    body: 'Escolha categoria e local (país, região, cidade). A busca roda no OpenStreetMap e, quando a chave estiver configurada, no Google Places.',
    action: 'Buscas → Nova busca → categorias e localização.',
  },
  {
    id: 'filter',
    title: 'Filtre empresas por critérios relevantes',
    body: 'Use filtros como “somente sem website” para priorizar negócios sem site reportado no mapa. Revise telefone, endereço e sinais de website antes de importar.',
    action: 'Na busca, ligue “somente sem website” e revise os resultados.',
  },
  {
    id: 'list',
    title: 'Crie e organize sua lista para a prospecção',
    body: 'Importe os selecionados como leads, mova pelos estágios do pipeline interno e registre tarefas. Sem planilha paralela para o follow-up.',
    action: 'Importar selecionados → Pipeline / Tarefas.',
  },
];

const captureEn: CaptureStep[] = [
  {
    id: 'icp',
    title: 'Define your ideal customer',
    body: 'Pick category and location (country, region, city). Search runs on OpenStreetMap and, when configured, Google Places.',
    action: 'Searches → New search → categories and location.',
  },
  {
    id: 'filter',
    title: 'Filter companies by relevant criteria',
    body: 'Use filters such as “only without website” to prioritize businesses with no site reported on the map. Review phone, address, and website signals before importing.',
    action: 'In the search form, enable “only without website” and review results.',
  },
  {
    id: 'list',
    title: 'Create and organize your prospecting list',
    body: 'Import selected results as leads, move stages in the built-in pipeline, and track tasks. No side spreadsheet for follow-up.',
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

export const TEAM_EMAIL = 'hello@prospectly.dev';
