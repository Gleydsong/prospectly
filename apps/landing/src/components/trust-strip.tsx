'use client';

import Link from 'next/link';
import { EnvelopeSimple, LockKey, MagnifyingGlass, ShieldCheck } from '@phosphor-icons/react';
import { Reveal } from '@/components/motion';
import { prefix, t, type Locale } from '@/lib/i18n';

const ITEMS = [
  { title: 'trustItem1Title', body: 'trustItem1Body', Icon: MagnifyingGlass },
  { title: 'trustItem2Title', body: 'trustItem2Body', Icon: ShieldCheck },
  { title: 'trustItem3Title', body: 'trustItem3Body', Icon: LockKey },
  { title: 'trustItem4Title', body: 'trustItem4Body', Icon: EnvelopeSimple },
] as const;

export function TrustStrip({ locale }: { locale: Locale }) {
  const p = prefix(locale);

  return (
    <section
      className="border-y border-[color:var(--border)] bg-[color:var(--bg-sunken)]"
      aria-labelledby="trust-heading"
    >
      <div className="mx-auto max-w-shell px-4 py-12 sm:px-6 lg:px-8 lg:py-14">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2
            id="trust-heading"
            className="text-2xl font-semibold tracking-tight text-[color:var(--ink)] md:text-3xl"
          >
            {t(locale, 'trustLabel')}
          </h2>
        </Reveal>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map(({ title, body, Icon }, index) => (
            <Reveal key={title} delay={index * 0.04}>
              <li className="surface-raised h-full rounded-control p-5 text-left">
                <Icon weight="duotone" className="h-6 w-6 text-accent" aria-hidden />
                <h3 className="mt-3 text-base font-semibold text-[color:var(--ink)]">{t(locale, title)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-muted)]">{t(locale, body)}</p>
              </li>
            </Reveal>
          ))}
        </ul>

        <p className="mt-8 text-center text-sm text-[color:var(--ink-muted)]">
          <Link className="focus-ring underline-offset-2 hover:underline" href={`${p}/privacy`}>
            {t(locale, 'footerPrivacy')}
          </Link>
          {' · '}
          <Link className="focus-ring underline-offset-2 hover:underline" href={`${p}/terms`}>
            {t(locale, 'footerTerms')}
          </Link>
          {' · '}
          <Link className="focus-ring underline-offset-2 hover:underline" href={`${p}/cookies`}>
            {t(locale, 'footerCookies')}
          </Link>
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-center text-xs text-[color:var(--ink-muted)]">
          {t(locale, 'trustTodoNote')}
        </p>
      </div>
    </section>
  );
}
