export type AppLocale = 'pt' | 'en';

export function detectBrowserLocale(
  lang = typeof navigator !== 'undefined' ? navigator.language : 'en',
): AppLocale {
  return lang.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

export function toIntlLocale(locale: AppLocale): string {
  return locale === 'pt' ? 'pt-PT' : 'en-GB';
}

export function isAppLocale(value: string): value is AppLocale {
  return value === 'pt' || value === 'en';
}
