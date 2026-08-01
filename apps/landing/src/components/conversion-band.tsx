'use client';

import Link from 'next/link';
import { ListPlus, PlayCircle } from '@phosphor-icons/react';
import { HeroMotion } from '@/components/motion';
import { ProductFlowMock } from '@/components/product-flow-mock';
import { ProspectlyGlobeLazy } from '@/components/prospectly-globe-lazy';
import { t, type Locale } from '@/lib/i18n';
import { enterExplainerUrl } from '@/lib/pricing';

export function ConversionBand({ locale }: { locale: Locale }) {
  return (
    <section className="relative isolate overflow-hidden hero-wash" aria-labelledby="hero-heading">
      <div
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 opacity-[0.18] lg:block"
        aria-hidden
      >
        <ProspectlyGlobeLazy className="h-full w-full max-w-none translate-x-1/4" />
      </div>

      <div className="relative mx-auto grid max-w-shell items-center gap-8 px-4 py-10 sm:px-6 sm:py-12 lg:grid-cols-12 lg:gap-10 lg:px-8 lg:py-16">
        <HeroMotion className="text-center lg:col-span-6 lg:text-left">
          <p className="text-sm font-semibold tracking-tight text-accent">{t(locale, 'heroEyebrow')}</p>
          <h1
            id="hero-heading"
            className="mx-auto mt-4 max-w-[22ch] text-balance text-3xl font-semibold tracking-tight text-[color:var(--ink)] md:text-4xl lg:mx-0 lg:text-5xl"
          >
            {t(locale, 'heroLead')}
          </h1>
          <p className="mx-auto mt-5 max-w-[48ch] text-base leading-relaxed text-[color:var(--ink-muted)] md:text-lg lg:mx-0">
            {t(locale, 'heroSubtitle')}
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link
              href={enterExplainerUrl(locale)}
              className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-control bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-hover active:scale-[0.98] dark:text-accent-ink"
            >
              <ListPlus weight="bold" className="h-4 w-4" aria-hidden />
              {t(locale, 'ctaBandPrimary')}
            </Link>
            <Link
              href="#como-funciona"
              className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-control border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-6 text-sm font-semibold text-[color:var(--ink)] transition-colors hover:bg-[color:var(--bg-sunken)] active:scale-[0.98]"
            >
              <PlayCircle weight="bold" className="h-4 w-4" aria-hidden />
              {t(locale, 'ctaBandSecondary')}
            </Link>
          </div>
        </HeroMotion>

        <HeroMotion className="flex justify-center lg:col-span-6 lg:justify-end">
          <ProductFlowMock locale={locale} />
        </HeroMotion>
      </div>
    </section>
  );
}
