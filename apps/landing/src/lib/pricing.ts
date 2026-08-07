export type Locale = 'pt' | 'en';
export type Currency = 'BRL' | 'EUR' | 'USD';
export type BillingInterval = 'monthly' | 'lifetime';

export const DISPLAY_PRICES: Record<
  BillingInterval,
  Record<Currency, { amount: number; formatted: string }>
> = {
  monthly: {
    BRL: { amount: 49, formatted: 'R$ 49' },
    EUR: { amount: 10, formatted: '€ 10' },
    USD: { amount: 10, formatted: '$ 10' },
  },
  lifetime: {
    BRL: { amount: 399, formatted: 'R$ 399' },
    EUR: { amount: 99, formatted: '€ 99' },
    USD: { amount: 99, formatted: '$ 99' },
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

export type CreditOffer = 'credits-2000' | 'credits-5000' | 'unlimited';

export function appLoginUrl(offer?: CreditOffer): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5173';
  const params = offer ? `?offer=${encodeURIComponent(offer)}` : '';
  return `${base}/login${params}`;
}

/** Temporary “Entrar” destination while the app is not live. */
export function enterExplainerUrl(locale: Locale): string {
  return locale === 'en' ? '/en/enter' : '/entrar';
}
