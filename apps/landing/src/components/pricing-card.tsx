'use client';

import { Check } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
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
    <div className="surface-raised mx-auto max-w-xl rounded-control p-8 shadow-soft sm:p-10">
      <div className="flex gap-1 rounded-control bg-[color:var(--bg-sunken)] p-1">
        {(['monthly', 'lifetime'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setInterval(value)}
            className={`focus-ring flex-1 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors active:scale-[0.99] ${
              interval === value
                ? 'bg-[color:var(--bg-raised)] text-[color:var(--ink)] shadow-sm'
                : 'text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]'
            }`}
          >
            {t(locale, value)}
          </button>
        ))}
      </div>

      <label className="mt-6 block text-sm text-[color:var(--ink-muted)]">
        {t(locale, 'currency')}
        <select
          className="focus-ring mt-2 w-full rounded-control border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3 py-2.5 text-[color:var(--ink)]"
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

      <p className="mt-8 font-mono text-xs uppercase tracking-[0.16em] text-accent">
        {t(locale, 'planName')}
      </p>
      <p className="mt-3 text-5xl font-semibold tracking-tighter text-[color:var(--ink)]">
        {price.formatted}
        <span className="ml-2 text-base font-normal tracking-normal text-[color:var(--ink-muted)]">
          {interval === 'monthly' ? t(locale, 'perMonth') : t(locale, 'oneTime')}
        </span>
      </p>

      <ul className="mt-8 space-y-3 text-sm text-[color:var(--ink)]">
        {features.map((feature) => (
          <li key={feature} className="flex gap-3">
            <Check weight="bold" className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <a
        href={appRegisterUrl(interval, currency)}
        className="focus-ring mt-10 flex h-12 items-center justify-center rounded-control bg-accent text-sm font-semibold text-white transition-transform hover:bg-accent-hover active:scale-[0.98] dark:text-accent-ink"
      >
        {interval === 'monthly' ? t(locale, 'ctaMonthly') : t(locale, 'ctaLifetime')}
      </a>
    </div>
  );
}
