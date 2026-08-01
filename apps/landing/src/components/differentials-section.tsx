'use client';

import { ListChecks, MapTrifold, Path, Timer } from '@phosphor-icons/react';
import { Reveal } from '@/components/motion';
import { t, type Locale } from '@/lib/i18n';

const DIFFS = [
  { title: 'diff1Title', body: 'diff1Body', Icon: MapTrifold },
  { title: 'diff2Title', body: 'diff2Body', Icon: Path },
  { title: 'diff3Title', body: 'diff3Body', Icon: ListChecks },
  { title: 'diff4Title', body: 'diff4Body', Icon: Timer },
] as const;

export function DifferentialsSection({ locale }: { locale: Locale }) {
  return (
    <section
      className="bg-[color:var(--bg-sunken)]"
      aria-labelledby="diffs-heading"
    >
      <div className="mx-auto max-w-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2
            id="diffs-heading"
            className="text-3xl font-semibold tracking-tight text-[color:var(--ink)] md:text-4xl"
          >
            {t(locale, 'diffsTitle')}
          </h2>
          <p className="mx-auto mt-4 max-w-[55ch] text-base leading-relaxed text-[color:var(--ink-muted)]">
            {t(locale, 'diffsSubtitle')}
          </p>
        </Reveal>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DIFFS.map(({ title, body, Icon }, index) => (
            <Reveal key={title} delay={index * 0.04}>
              <li className="surface-raised h-full rounded-control p-5">
                <Icon weight="duotone" className="h-6 w-6 text-accent" aria-hidden />
                <h3 className="mt-3 text-base font-semibold text-[color:var(--ink)]">{t(locale, title)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-muted)]">{t(locale, body)}</p>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
