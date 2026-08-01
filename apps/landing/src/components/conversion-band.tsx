'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ListPlus, PlayCircle } from '@phosphor-icons/react';
import { HeroMotion } from '@/components/motion';
import { ProductFlowMock } from '@/components/product-flow-mock';
import { t, type Locale } from '@/lib/i18n';
import { enterExplainerUrl } from '@/lib/pricing';

export function ConversionBand({ locale }: { locale: Locale }) {
  return (
    <section className="conversion-brand relative isolate overflow-hidden" aria-labelledby="hero-heading">
      <Image
        src="/images/prospecting-network-hero.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="pointer-events-none object-cover"
        aria-hidden
      />
      <div className="conversion-brand-overlay pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative mx-auto grid max-w-shell items-center gap-8 px-4 py-10 sm:px-6 sm:py-12 lg:grid-cols-12 lg:gap-10 lg:px-8 lg:py-16">
        <HeroMotion className="text-center lg:col-span-6 lg:text-left">
          <p className="text-sm font-semibold tracking-tight text-blue-200">{t(locale, 'heroEyebrow')}</p>
          <h1
            id="hero-heading"
            className="mx-auto mt-4 max-w-[22ch] text-balance text-3xl font-semibold tracking-tight text-white md:text-4xl lg:mx-0 lg:text-5xl"
          >
            {t(locale, 'heroLead')}
          </h1>
          <p className="mx-auto mt-5 max-w-[48ch] text-base leading-relaxed text-blue-100/80 md:text-lg lg:mx-0">
            {t(locale, 'heroSubtitle')}
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link
              href={enterExplainerUrl(locale)}
              className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-control bg-blue-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-blue-600 active:scale-[0.98]"
            >
              <ListPlus weight="bold" className="h-4 w-4" aria-hidden />
              {t(locale, 'ctaBandPrimary')}
            </Link>
            <Link
              href="#como-funciona"
              className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-control border border-white/20 bg-white/10 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/15 active:scale-[0.98]"
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
