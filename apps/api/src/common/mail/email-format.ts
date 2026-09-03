import type { EmailLocale } from './email-theme';

export function firstNameFrom(fullName: string | undefined | null): string {
  if (!fullName) return '';
  const first = fullName.trim().split(/\s+/)[0] ?? '';
  return first.slice(0, 80);
}

export function greeting(locale: EmailLocale, fullName?: string | null): string {
  const first = firstNameFrom(fullName);
  if (locale === 'en') {
    return first ? `Hi, ${first}.` : 'Hi.';
  }
  return first ? `Olá, ${first}.` : 'Olá.';
}

export function formatCredits(value: number, locale: EmailLocale): string {
  const amount = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'pt-BR').format(amount);
}

export function formatCurrencyFromCentavos(
  amountCentavos: number,
  currency: string,
  locale: EmailLocale,
): string {
  const code = currency.trim().toUpperCase() || 'BRL';
  const amount = (Number.isFinite(amountCentavos) ? amountCentavos : 0) / 100;
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'pt-BR', {
    style: 'currency',
    currency: code,
  }).format(amount);
}

export function formatEmailDate(value: Date, locale: EmailLocale): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(value);
}
