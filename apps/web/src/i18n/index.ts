import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { detectBrowserLocale, isAppLocale, type AppLocale } from '@/lib/locale';

const loaded = new Set<AppLocale>();

void i18n.use(initReactI18next).init({
  resources: {},
  lng: detectBrowserLocale(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

async function loadCatalog(locale: AppLocale): Promise<void> {
  if (loaded.has(locale)) return;
  const catalog =
    locale === 'pt'
      ? (await import('./locales/pt.json')).default
      : (await import('./locales/en.json')).default;
  i18n.addResourceBundle(locale, 'translation', catalog, true, true);
  loaded.add(locale);
}

export async function ensureI18n(locale: AppLocale = detectBrowserLocale()): Promise<typeof i18n> {
  await loadCatalog(locale);
  await i18n.changeLanguage(locale);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale === 'pt' ? 'pt' : 'en';
  }
  return i18n;
}

export async function setAppLocale(locale: AppLocale): Promise<void> {
  await ensureI18n(locale);
}

export function getAppLocale(): AppLocale {
  const lang = i18n.resolvedLanguage ?? i18n.language;
  return isAppLocale(lang) ? lang : detectBrowserLocale(lang);
}

export default i18n;
