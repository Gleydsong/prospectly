import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { isAppLocale, toIntlLocale, type AppLocale } from '@/lib/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function currentAppLocale(): AppLocale {
  if (typeof document !== 'undefined') {
    const lang = document.documentElement.lang;
    if (isAppLocale(lang)) return lang;
  }
  return 'pt';
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(toIntlLocale(currentAppLocale()), { dateStyle: 'medium' }).format(
    new Date(value),
  );
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(toIntlLocale(currentAppLocale()), {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}
