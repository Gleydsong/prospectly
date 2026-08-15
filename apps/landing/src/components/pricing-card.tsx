'use client';

import { Check, Coins, Crown } from '@phosphor-icons/react';
import { BentoSurface } from '@/components/ui/bento-card';
import { CtaButton } from '@/components/ui/cta-button';
import { appLoginUrl, type CreditOffer } from '@/lib/pricing';
import type { Locale } from '@/lib/i18n';

type Offer = {
  id: CreditOffer;
  title: string;
  description: string;
  price: string;
  suffix?: string;
  cta: string;
  featured?: boolean;
};

const offersByLocale: Record<Locale, Offer[]> = {
  pt: [
    { id: 'credits-2000', title: '2.000 créditos', description: 'Créditos acumulativos, sem mensalidade e sem expiração.', price: 'R$ 9,99', cta: 'Comprar créditos' },
    { id: 'credits-5000', title: '5.000 créditos', description: 'Créditos acumulativos, sem mensalidade e sem expiração.', price: 'R$ 19,99', cta: 'Comprar créditos' },
    { id: 'unlimited', title: 'Ilimitado', description: 'Buscas e Opportunity Finder sem débito de créditos.', price: 'R$ 49,99', suffix: '/ mês', cta: 'Assinar ilimitado', featured: true },
  ],
  en: [
    { id: 'credits-2000', title: '2,000 credits', description: 'Accumulated credits, with no monthly fee and no expiration.', price: 'R$ 9.99', cta: 'Buy credits' },
    { id: 'credits-5000', title: '5,000 credits', description: 'Accumulated credits, with no monthly fee and no expiration.', price: 'R$ 19.99', cta: 'Buy credits' },
    { id: 'unlimited', title: 'Unlimited', description: 'Searches and Opportunity Finder with no credit debit.', price: 'R$ 49.99', suffix: '/ month', cta: 'Subscribe unlimited', featured: true },
  ],
};

const featuresByOffer: Record<CreditOffer, Record<Locale, string[]>> = {
  'credits-2000': {
    pt: ['Maps 14 cr · Opportunity Finder 16 cr', 'Exportação CSV após a compra'],
    en: ['Maps 14 cr · Opportunity Finder 16 cr', 'CSV export after purchase'],
  },
  'credits-5000': {
    pt: ['Maps 14 cr · Opportunity Finder 16 cr', 'Exportação CSV após a compra'],
    en: ['Maps 14 cr · Opportunity Finder 16 cr', 'CSV export after purchase'],
  },
  unlimited: {
    pt: ['Maps e Opportunity Finder sem débito', 'Exportação CSV incluída', 'PIX = 30 dias; cartão renova'],
    en: ['Uncapped Maps and Opportunity Finder', 'CSV export included', 'PIX = 30 days; card auto-renews'],
  },
};

export function PricingCard({ locale }: { locale: Locale }) {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-4 lg:grid-cols-3">
        {offersByLocale[locale].map((offer) => (
          <BentoSurface
            key={offer.id}
            className={`flex min-h-[382px] flex-col p-6 sm:p-7 ${offer.featured ? 'border border-emerald-400/80 bg-emerald-50/80 shadow-[0_14px_35px_rgba(16,185,129,0.08)]' : 'border border-[color:var(--border)] bg-white'}`}
          >
            <div className="flex items-start justify-between">
              {offer.featured ? <Crown weight="duotone" className="h-7 w-7 text-emerald-600" aria-hidden /> : <Coins weight="duotone" className="h-7 w-7 text-amber-500" aria-hidden />}
              {offer.featured ? <span className="rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">{locale === 'pt' ? 'Melhor escolha' : 'Best choice'}</span> : null}
            </div>
            <h2 className="mt-8 text-xl font-semibold tracking-tight text-[color:var(--ink)]">{offer.title}</h2>
            <p className="mt-3 min-h-12 text-sm leading-6 text-[color:var(--ink-muted)]">{offer.description}</p>
            <p className="mt-7 text-3xl font-bold tracking-tight text-[color:var(--ink)]">
              {offer.price}
              {offer.suffix ? <span className="ml-1 text-sm font-medium text-[color:var(--ink-muted)]">{offer.suffix}</span> : null}
            </p>
            <ul className="mt-6 space-y-2 text-sm text-[color:var(--ink-muted)]">
              {featuresByOffer[offer.id][locale].map((feature) => <li key={feature} className="flex items-center gap-2"><Check weight="bold" className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />{feature}</li>)}
            </ul>
            <CtaButton href={appLoginUrl(offer.id)} className="mt-auto w-full bg-[#050817] text-white hover:bg-[#1a2033]">{offer.cta}</CtaButton>
          </BentoSurface>
        ))}
      </div>
      <p className="mt-5 text-center text-xs text-[color:var(--ink-muted)]">{locale === 'pt' ? 'Pagamento processado com segurança.' : 'Payments are securely processed.'}</p>
    </div>
  );
}
