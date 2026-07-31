import type { Metadata } from 'next';
import { PricingCard } from '@/components/pricing-card';
import { Reveal } from '@/components/motion';
import { t } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Preços - Starter mensal e vitalício',
  description:
    'Plano Starter Prospectly: R$ 49/mês ou R$ 399 vitalício. Também em EUR e USD. Prospecção local para agências.',
};

export default function PricingPage() {
  const locale = 'pt' as const;
  return (
    <section className="hero-wash mx-auto max-w-shell px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <Reveal>
        <h1 className="text-center text-3xl font-semibold tracking-tight text-[color:var(--ink)] md:text-4xl">
          {t(locale, 'pricingTitle')}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-center text-base text-[color:var(--ink-muted)]">
          {t(locale, 'pricingSubtitle')}
        </p>
      </Reveal>
      <div className="mt-12">
        <PricingCard locale={locale} />
      </div>
    </section>
  );
}
