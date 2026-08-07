import type { Metadata } from 'next';
import { PricingCard } from '@/components/pricing-card';
import { Reveal } from '@/components/motion';

export const metadata: Metadata = {
  title: 'Preços - créditos e plano ilimitado',
  description:
    'Compre créditos sem expiração ou assine buscas ilimitadas para sua prospecção local.',
};

export default function PricingPage() {
  const locale = 'pt' as const;
  return (
    <section className="landing-v2 landing-light-page landing-pricing-v2 hero-wash mx-auto max-w-shell px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <Reveal>
        <h1 className="text-center text-3xl font-semibold tracking-tight text-[color:var(--ink)] md:text-4xl">
          Escolha o seu ritmo
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-center text-base text-[color:var(--ink-muted)]">
          Sem surpresa, sem renovação de créditos avulsos.
        </p>
      </Reveal>
      <div className="mt-12">
        <PricingCard locale={locale} />
      </div>
    </section>
  );
}
