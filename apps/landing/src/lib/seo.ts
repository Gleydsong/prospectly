export type LandingRobotsRule = {
  userAgent: string;
  allow: string;
  disallow?: string;
};

export type LandingLanguages = {
  'pt-BR': string;
  en?: string;
  'x-default': string;
};

export type LandingSitemapEntry = {
  url: string;
  lastModified: Date;
  changeFrequency: 'weekly' | 'monthly';
  priority: number;
  alternates?: { languages: Record<string, string> };
};

export const BILINGUAL_PAGES = [
  { pt: '/pricing', en: '/en/pricing' },
  { pt: '/faq', en: '/en/faq' },
  { pt: '/privacy', en: '/en/privacy' },
  { pt: '/terms', en: '/en/terms' },
  { pt: '/cookies', en: '/en/cookies' },
  { pt: '/entrar', en: '/en/enter' },
] as const;

const PT_SITEMAP_PAGES: Array<{
  path: string;
  changeFrequency: 'weekly' | 'monthly';
  priority: number;
}> = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/como-funciona', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/beneficios', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/para-quem-e', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/duvidas', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/prospeccao-b2b', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/lista-de-empresas', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/prospeccao-para-agencias', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/prospeccao-para-consultorias', changeFrequency: 'monthly', priority: 0.8 },
];

export function landingRobotsRules(): LandingRobotsRule[] {
  return [
    { userAgent: '*', allow: '/' },
    { userAgent: 'Googlebot', allow: '/' },
    { userAgent: 'Google-InspectionTool', allow: '/' },
  ];
}

export function landingAlternates(canonicalPath: string): {
  canonical: string;
  languages: LandingLanguages;
} {
  const pair = BILINGUAL_PAGES.find(
    (page) => page.pt === canonicalPath || page.en === canonicalPath,
  );
  const languages: LandingLanguages = {
    'pt-BR': pair?.pt ?? canonicalPath,
    'x-default': pair?.pt ?? canonicalPath,
  };
  if (pair) {
    languages.en = pair.en;
  }
  return { canonical: canonicalPath, languages };
}

function absoluteUrl(base: string, path: string): string {
  const origin = base.replace(/\/$/, '');
  if (path === '/') {
    return `${origin}/`;
  }
  return `${origin}${path}`;
}

function bilingualLanguages(base: string, ptPath: string, enPath: string): Record<string, string> {
  return {
    'pt-BR': absoluteUrl(base, ptPath),
    en: absoluteUrl(base, enPath),
    'x-default': absoluteUrl(base, ptPath),
  };
}

export function buildLandingSitemap(
  base: string,
  lastModified: Date = new Date(),
): LandingSitemapEntry[] {
  const entries: LandingSitemapEntry[] = [];

  for (const page of BILINGUAL_PAGES) {
    const languages = bilingualLanguages(base, page.pt, page.en);
    entries.push({
      url: absoluteUrl(base, page.pt),
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
      alternates: { languages },
    });
    entries.push({
      url: absoluteUrl(base, page.en),
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
      alternates: { languages },
    });
  }

  for (const page of PT_SITEMAP_PAGES) {
    entries.push({
      url: absoluteUrl(base, page.path),
      lastModified,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    });
  }

  return entries;
}
