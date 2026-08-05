'use client';

import { Check } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { BentoSurface } from '@/components/ui/bento-card';
import { CtaButton } from '@/components/ui/cta-button';
import { t, type Locale } from '@/lib/i18n';
import {
  appRegisterUrl,
  CURRENCY_LABELS,
  DISPLAY_PRICES,
  type BillingInterval,
  type Currency,
} from '@/lib/pricing';

const CURRENCY_KEY = 'prospectly_currency';

function detectCurrency(locale: Locale): Currency {
  if (typeof navigator === 'undefined') return locale === 'pt' ? 'BRL' : 'EUR';
  const lang = navigator.language?.toLowerCase() ?? '';
  if (lang.includes('pt-br') || lang.includes('pt_br')) return 'BRL';
  if (
    lang.startsWith('pt') ||
    lang.startsWith('es') ||
    lang.startsWith('de') ||
    lang.startsWith('fr') ||
    lang.startsWith('it') ||
    lang.startsWith('nl')
  ) {
    return 'EUR';
  }
  if (lang.startsWith('en-us')) return 'USD';
  return locale === 'pt' ? 'BRL' : 'EUR';
}

export function PricingCard({ locale }: { locale: Locale }) {
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [currency, setCurrency] = useState<Currency>(locale === 'pt' ? 'BRL' : 'EUR');

  useEffect(() => {
    const saved = localStorage.getItem(CURRENCY_KEY) as Currency | null;
    if (saved && (saved === 'BRL' || saved === 'EUR' || saved === 'USD')) {
      setCurrency(saved);
      return;
    }
    setCurrency(detectCurrency(locale));
  }, [locale]);

  const price = DISPLAY_PRICES[interval][currency];
  const features = t(locale, 'planFeatures').split('|');

  return (
    <BentoSurface className="mx-auto max-w-xl p-8 sm:p-10">
      <div className="relative flex gap-1 rounded-control border border-white/10 bg-white/[0.04] p-1">
        {(['monthly', 'lifetime'] as const).map((value) => (
          <CtaButton
            key={value}
            type="button"
            size="md"
            variant={interval === value ? 'primary' : 'ghost'}
            onClick={() => setInterval(value)}
            className="min-h-11 flex-1 font-medium !shadow-none"
          >
            {t(locale, value)}
          </CtaButton>
        ))}
      </div>

      <label className="relative mt-6 block text-sm text-[color:var(--bento-ink-muted)]">
        {t(locale, 'currency')}
        <select
          className="focus-ring bento-field mt-2 w-full rounded-control px-3 py-2.5"
          value={currency}
          onChange={(e) => {
            const next = e.target.value as Currency;
            setCurrency(next);
            localStorage.setItem(CURRENCY_KEY, next);
          }}
        >
          {(Object.keys(CURRENCY_LABELS) as Currency[]).map((code) => (
            <option key={code} value={code}>
              {CURRENCY_LABELS[code]}
            </option>
          ))}
        </select>
      </label>

      <p className="relative mt-8 font-mono text-xs uppercase tracking-[0.16em] text-brand-400">
        {t(locale, 'planName')}
      </p>
      <p className="relative mt-3 text-5xl font-semibold tracking-tighter text-[color:var(--bento-ink)]">
        {price.formatted}
        <span className="ml-2 text-base font-normal tracking-normal text-[color:var(--bento-ink-muted)]">
          {interval === 'monthly' ? t(locale, 'perMonth') : t(locale, 'oneTime')}
        </span>
      </p>

      <ul className="relative mt-8 space-y-3 text-sm text-[color:var(--bento-ink)]">
        {features.map((feature) => (
          <li key={feature} className="flex gap-3">
            <Check weight="bold" className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" aria-hidden />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <CtaButton href={appRegisterUrl(interval, currency)} className="relative mt-10 w-full">
        {interval === 'monthly' ? t(locale, 'ctaMonthly') : t(locale, 'ctaLifetime')}
      </CtaButton>
    </BentoSurface>
  );
}
