import type { Locale } from './pricing';

export const FAQ_PERMANENT_REDIRECTS = [
  { source: '/faq', destination: '/duvidas', statusCode: 301 as const },
] as const;

export function canonicalFaqPath(locale: Locale): '/duvidas' | '/en/faq' {
  return locale === 'en' ? '/en/faq' : '/duvidas';
}

export function sitemapFaqUrls(origin: string): string[] {
  const base = origin.replace(/\/$/, '');
  return [`${base}${canonicalFaqPath('pt')}`, `${base}${canonicalFaqPath('en')}`];
}
