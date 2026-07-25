'use client';

import Link from 'next/link';
import { PlayCircle, RocketLaunch } from '@phosphor-icons/react';
import { HeroMotion } from '@/components/motion';
import { ProspectlyGlobe } from '@/components/prospectly-globe';
import { t, type Locale } from '@/lib/i18n';
import { appRegisterUrl } from '@/lib/pricing';

export function ConversionBand({ locale }: { locale: Locale }) {
  const currency = locale === 'pt' ? 'BRL' : 'EUR';

  return (
    <section className="relative isolate overflow-hidden hero-wash">
      <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-shell items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:gap-8 lg:px-8 lg:py-16">
        <HeroMotion className="text-center lg:col-span-6">
          <p className="text-sm font-semibold tracking-tight text-accent">{t(locale, 'brand')}</p>
          <h1 className="mx-auto mt-4 max-w-[18ch] text-balance text-3xl font-semibold tracking-tight text-[color:var(--ink)] md:text-4xl lg:text-5xl">
            {t(locale, 'ctaBandBefore')}{' '}
            <span className="text-accent">{t(locale, 'ctaBandHighlight')}</span>
            {t(locale, 'ctaBandAfter') ? ` ${t(locale, 'ctaBandAfter')}` : null}
          </h1>
          <p className="mx-auto mt-5 max-w-[42ch] text-base leading-relaxed text-[color:var(--ink-muted)] md:text-lg">
            {t(locale, 'ctaBandBody')}
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a
              href={appRegisterUrl('monthly', currency)}
              className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-control bg-accent px-6 text-sm font-semibold text-white transition-transform hover:bg-accent-hover active:scale-[0.98] dark:text-accent-ink"
            >
              <RocketLaunch weight="bold" className="h-4 w-4" aria-hidden />
              {t(locale, 'ctaBandPrimary')}
            </a>
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
          <ProspectlyGlobe className="w-full max-w-[520px]" />
        </HeroMotion>
      </div>
    </section>
  );
}
