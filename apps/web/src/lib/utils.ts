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

export function formatRelativeTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const absSec = Math.round(Math.abs(diffMs) / 1000);
  const rtf = new Intl.RelativeTimeFormat(toIntlLocale(currentAppLocale()), { numeric: 'auto' });

  if (absSec < 60) return rtf.format(Math.round(diffMs / 1000), 'second');
  const absMin = Math.round(absSec / 60);
  if (absMin < 60) return rtf.format(Math.round(diffMs / 60000), 'minute');
  const absHour = Math.round(absMin / 60);
  if (absHour < 24) return rtf.format(Math.round(diffMs / 3600000), 'hour');
  const absDay = Math.round(absHour / 24);
  if (absDay < 30) return rtf.format(Math.round(diffMs / 86400000), 'day');
  return formatDate(value);
}
