'use client';

import { EnvelopeSimple, LockKey, MagnifyingGlass, ShieldCheck } from '@phosphor-icons/react';
import { Reveal } from '@/components/motion';
import { BentoCard, BentoIconDisk } from '@/components/ui/bento-card';
import { CtaButton } from '@/components/ui/cta-button';
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
    <section className="bg-[color:var(--bg)]" aria-labelledby="trust-heading">
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
              <li className="h-full list-none">
                <BentoCard
                  visualSize="icon"
                  visual={
                    <BentoIconDisk>
                      <Icon weight="duotone" className="h-6 w-6" aria-hidden />
                    </BentoIconDisk>
                  }
                  title={t(locale, title)}
                  description={t(locale, body)}
                />
              </li>
            </Reveal>
          ))}
        </ul>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <CtaButton href={`${p}/privacy`} variant="ghost" size="sm" className="font-medium">
            {t(locale, 'footerPrivacy')}
          </CtaButton>
          <CtaButton href={`${p}/terms`} variant="ghost" size="sm" className="font-medium">
            {t(locale, 'footerTerms')}
          </CtaButton>
          <CtaButton href={`${p}/cookies`} variant="ghost" size="sm" className="font-medium">
            {t(locale, 'footerCookies')}
          </CtaButton>
        </div>
        <p className="mx-auto mt-3 max-w-2xl text-center text-xs text-[color:var(--ink-muted)]">
          {t(locale, 'trustTodoNote')}
        </p>
      </div>
    </section>
  );
}
