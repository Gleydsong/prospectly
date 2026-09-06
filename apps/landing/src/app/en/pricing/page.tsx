import type { Metadata } from 'next';
import { PricingCard } from '@/components/pricing-card';
import { Reveal } from '@/components/motion';
import { landingAlternates } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Pricing - credits and unlimited plan',
  description: 'Buy credits with no expiration or subscribe to unlimited prospecting.',
  alternates: landingAlternates('/en/pricing'),
};

export default function EnPricingPage() {
  const locale = 'en' as const;
  return (
    <section className="landing-v2 landing-light-page landing-pricing-v2 hero-wash mx-auto max-w-shell px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <Reveal>
        <h1 className="text-center text-3xl font-semibold tracking-tight text-[color:var(--ink)] md:text-4xl">
          Choose your pace
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-center text-base text-[color:var(--ink-muted)]">
          No surprises, no renewal of one-off credits.
        </p>
      </Reveal>
      <div className="mt-12">
        <PricingCard locale={locale} />
      </div>
    </section>
  );
}
