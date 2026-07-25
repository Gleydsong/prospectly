export type Locale = 'pt' | 'en';
export type Currency = 'BRL' | 'EUR' | 'USD';
export type BillingInterval = 'monthly' | 'lifetime';

export const DISPLAY_PRICES: Record<
  BillingInterval,
  Record<Currency, { amount: number; formatted: string }>
> = {
  monthly: {
    BRL: { amount: 97, formatted: 'R$ 97' },
    EUR: { amount: 19, formatted: '€ 19' },
    USD: { amount: 29, formatted: '$ 29' },
  },
  lifetime: {
    BRL: { amount: 997, formatted: 'R$ 997' },
    EUR: { amount: 197, formatted: '€ 197' },
    USD: { amount: 297, formatted: '$ 297' },
  },
};

export const CURRENCY_LABELS: Record<Currency, string> = {
  BRL: 'BRL (Brasil)',
  EUR: 'EUR (Europa)',
  USD: 'USD',
};

export function appRegisterUrl(plan: BillingInterval, currency: Currency): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5173';
  const params = new URLSearchParams({ plan, currency, acceptTerms: '1' });
  return `${base}/register?${params.toString()}`;
}

export function appLoginUrl(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5173'}/login`;
}
