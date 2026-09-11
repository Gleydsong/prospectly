export const HOME_LANGUAGE_ALTERNATES = {
  'pt-BR': '/',
  en: '/en',
} as const;

export type HtmlLang = 'pt-BR' | 'en';

export type SitemapHomeEntry = {
  url: string;
  alternates: {
    languages: Record<string, string>;
  };
};

export function absoluteHomeLanguageAlternates(origin: string): Record<string, string> {
  const base = origin.replace(/\/$/, '');
  return {
    'pt-BR': `${base}/`,
    en: `${base}/en`,
  };
}

export function sitemapHomeEntries(origin: string): SitemapHomeEntry[] {
  const languages = absoluteHomeLanguageAlternates(origin);
  return [
    { url: languages['pt-BR'], alternates: { languages } },
    { url: languages.en, alternates: { languages } },
  ];
}
