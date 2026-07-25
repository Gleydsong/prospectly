import type { Metadata } from 'next';
import { PricingCard } from '@/components/pricing-card';
import { t } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Pricing — monthly and lifetime Starter',
  description: 'Prospectly Starter: monthly or lifetime. BRL, EUR, and USD.',
};

export default function EnPricingPage() {
  const locale = 'en' as const;
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-center text-3xl font-semibold text-slate-900">
        {t(locale, 'pricingTitle')}
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">
        {t(locale, 'pricingSubtitle')}
      </p>
      <div className="mt-12">
        <PricingCard locale={locale} />
      </div>
    </section>
  );
}
