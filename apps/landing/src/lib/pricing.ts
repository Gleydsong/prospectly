export type Locale = 'pt' | 'en';
export type Currency = 'BRL';
export type BillingInterval = 'monthly' | 'lifetime';

export const DISPLAY_PRICES: Record<
  BillingInterval,
  Record<Currency, { amount: number; formatted: string }>
> = {
  monthly: {
    BRL: { amount: 49.99, formatted: 'R$ 49,99' },
  },
  // Legacy key kept for register?plan=lifetime deep-links; maps to credit packs UX.
  lifetime: {
    BRL: { amount: 23.99, formatted: 'R$ 23,99' },
  },
};

export const CURRENCY_LABELS: Record<Currency, string> = {
  BRL: 'BRL (Brasil)',
};

export function appRegisterUrl(plan: BillingInterval, method: 'pix' | 'card' = 'pix'): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5173';
  const params = new URLSearchParams({ plan, method, acceptTerms: '1' });
  return `${base}/register?${params.toString()}`;
}

export type CreditOffer = 'credits-2000' | 'credits-5000' | 'unlimited';

export function appLoginUrl(offer?: CreditOffer): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5173';
  const params = offer ? `?offer=${encodeURIComponent(offer)}` : '';
  return `${base}/login${params}`;
}

/** Waitlist explainer. Login uses `appLoginUrl`. */
export function enterExplainerUrl(locale: Locale): string {
  return locale === 'en' ? '/en/enter' : '/entrar';
}
