'use client';

import Link from 'next/link';
import { EnvelopeSimple, ListPlus } from '@phosphor-icons/react';
import { Reveal } from '@/components/motion';
import { TEAM_EMAIL, t, type Locale } from '@/lib/i18n';
import { enterExplainerUrl } from '@/lib/pricing';

export function FinalCtaSection({ locale }: { locale: Locale }) {
  return (
    <section className="hero-wash border-t border-[color:var(--border)]" aria-labelledby="final-cta-heading">
      <div className="mx-auto max-w-shell px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-24">
        <Reveal className="mx-auto max-w-2xl">
          <h2
            id="final-cta-heading"
            className="text-balance text-3xl font-semibold tracking-tight text-[color:var(--ink)] md:text-4xl"
          >
            {t(locale, 'finalTitle')}
          </h2>
          <p className="mx-auto mt-4 max-w-[50ch] text-base leading-relaxed text-[color:var(--ink-muted)] md:text-lg">
            {t(locale, 'finalBody')}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={enterExplainerUrl(locale)}
              className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-control bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-hover active:scale-[0.98] dark:text-accent-ink"
            >
              <ListPlus weight="bold" className="h-4 w-4" aria-hidden />
              {t(locale, 'finalPrimary')}
            </Link>
            <a
              href={`mailto:${TEAM_EMAIL}`}
              className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-control border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-6 text-sm font-semibold text-[color:var(--ink)] transition-colors hover:bg-[color:var(--bg-sunken)] active:scale-[0.98]"
            >
              <EnvelopeSimple weight="bold" className="h-4 w-4" aria-hidden />
              {t(locale, 'finalSecondary')}
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
