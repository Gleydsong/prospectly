'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  LockKey,
  MagnifyingGlass,
  MapTrifold,
  RocketLaunch,
  PlayCircle,
  ShieldCheck,
} from '@phosphor-icons/react';
import { HeroMotion } from '@/components/motion';
import { t, type Locale } from '@/lib/i18n';
import { appRegisterUrl } from '@/lib/pricing';

export function ConversionBand({ locale }: { locale: Locale }) {
  const currency = locale === 'pt' ? 'BRL' : 'EUR';
  const signals = [
    { Icon: MapTrifold, label: t(locale, 'ctaSignal1') },
    { Icon: MagnifyingGlass, label: t(locale, 'ctaSignal2') },
    { Icon: ShieldCheck, label: t(locale, 'ctaSignal3') },
    { Icon: LockKey, label: t(locale, 'ctaSignal4') },
  ] as const;

  return (
    <section className="relative isolate min-h-[calc(100dvh-4rem)] overflow-hidden">
      <Image
        src="/images/hero-street.jpg"
        alt={
          locale === 'pt'
            ? 'Rua com negócios locais ao entardecer'
            : 'Neighborhood street with local storefronts at dusk'
        }
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div
        className="absolute inset-0 bg-gradient-to-b from-zinc-950/88 via-zinc-950/80 to-zinc-950/92"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgb(5_150_105_/_0.22),transparent_60%)]"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-[calc(100dvh-4rem)] max-w-3xl flex-col justify-center px-4 py-16 text-center sm:px-6 lg:py-20">
        <HeroMotion>
          <p className="text-sm font-semibold tracking-tight text-emerald-400">
            {t(locale, 'brand')}
          </p>
          <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-zinc-50 md:text-4xl lg:text-5xl">
            {t(locale, 'ctaBandBefore')}{' '}
            <span className="text-emerald-400">{t(locale, 'ctaBandHighlight')}</span>{' '}
            {t(locale, 'ctaBandAfter')}
          </h1>
          <p className="mx-auto mt-5 max-w-[52ch] text-base leading-relaxed text-zinc-300 md:text-lg">
            {t(locale, 'ctaBandBody')}
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a
              href={appRegisterUrl('monthly', currency)}
              className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-control bg-accent px-6 text-sm font-semibold text-white transition-transform hover:bg-accent-hover active:scale-[0.98]"
            >
              <RocketLaunch weight="bold" className="h-4 w-4" aria-hidden />
              {t(locale, 'ctaBandPrimary')}
            </a>
            <Link
              href="#como-funciona"
              className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-control border border-white/35 bg-transparent px-6 text-sm font-semibold text-zinc-50 transition-colors hover:bg-white/10 active:scale-[0.98]"
            >
              <PlayCircle weight="bold" className="h-4 w-4" aria-hidden />
              {t(locale, 'ctaBandSecondary')}
            </Link>
          </div>

          <ul className="mx-auto mt-12 grid max-w-2xl gap-4 text-left sm:grid-cols-2">
            {signals.map(({ Icon, label }) => (
              <li key={label} className="flex items-start gap-3 text-sm text-zinc-200">
                <Icon
                  weight="fill"
                  className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400"
                  aria-hidden
                />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </HeroMotion>
      </div>
    </section>
  );
}
