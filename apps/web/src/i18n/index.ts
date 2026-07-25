import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { detectBrowserLocale, isAppLocale, type AppLocale } from '@/lib/locale';

import en from './locales/en.json';
import pt from './locales/pt.json';

void i18n.use(initReactI18next).init({
  resources: {
    pt: { translation: pt },
    en: { translation: en },
  },
  lng: detectBrowserLocale(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export async function setAppLocale(locale: AppLocale): Promise<void> {
  await i18n.changeLanguage(locale);
  document.documentElement.lang = locale === 'pt' ? 'pt' : 'en';
}

export function getAppLocale(): AppLocale {
  const lang = i18n.resolvedLanguage ?? i18n.language;
  return isAppLocale(lang) ? lang : detectBrowserLocale(lang);
}

export default i18n;
