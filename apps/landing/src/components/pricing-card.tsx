'use client';

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

function detectCurrency(): Currency {
  if (typeof navigator === 'undefined') return 'BRL';
  const lang = navigator.language?.toLowerCase() ?? '';
  if (lang.includes('pt-br') || lang.includes('pt_br')) return 'BRL';
  if (lang.startsWith('pt') || lang.startsWith('es') || lang.startsWith('de') || lang.startsWith('fr') || lang.startsWith('it') || lang.startsWith('nl')) {
    return 'EUR';
  }
  if (lang.startsWith('en-us')) return 'USD';
  return 'EUR';
}

export function PricingCard({ locale }: { locale: Locale }) {
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [currency, setCurrency] = useState<Currency>('BRL');

  useEffect(() => {
    const saved = localStorage.getItem(CURRENCY_KEY) as Currency | null;
    if (saved && (saved === 'BRL' || saved === 'EUR' || saved === 'USD')) {
      setCurrency(saved);
      return;
    }
    setCurrency(detectCurrency());
  }, []);

  const price = DISPLAY_PRICES[interval][currency];
  const features = t(locale, 'planFeatures').split('|');

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-6 flex gap-2 rounded-lg bg-slate-100 p-1">
        {(['monthly', 'lifetime'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setInterval(value)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
              interval === value ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600'
            }`}
          >
            {t(locale, value)}
          </button>
        ))}
      </div>

      <label className="mb-4 block text-sm text-slate-600">
        {t(locale, 'currency')}
        <select
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
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

      <p className="text-sm font-medium uppercase tracking-wide text-brand-600">
        {t(locale, 'planName')}
      </p>
      <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">
        {price.formatted}
        <span className="ml-2 text-base font-normal text-slate-500">
          {interval === 'monthly' ? t(locale, 'perMonth') : t(locale, 'oneTime')}
        </span>
      </p>

      <ul className="mt-6 space-y-2 text-sm text-slate-700">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <span className="text-teal-600">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <a
        href={appRegisterUrl(interval, currency)}
        className="mt-8 block rounded-md bg-brand-600 px-4 py-3 text-center font-medium text-white hover:bg-brand-700"
      >
        {interval === 'monthly' ? t(locale, 'ctaMonthly') : t(locale, 'ctaLifetime')}
      </a>
    </div>
  );
}
