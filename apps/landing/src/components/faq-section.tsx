'use client';

import { CaretDown } from '@phosphor-icons/react';
import { useId, useMemo, useState } from 'react';
import { Reveal } from '@/components/motion';
import { BentoSurface } from '@/components/ui/bento-card';
import { CtaButton } from '@/components/ui/cta-button';
import {
  FAQ_CATEGORY_ORDER,
  getFaqCategoryLabel,
  getFaqItemsByCategory,
  getHomeFaqItems,
  type FaqCategory,
  type FaqItem,
} from '@/lib/faq-content';
import { prefix, t, type Locale } from '@/lib/i18n';
import { enterExplainerUrl } from '@/lib/pricing';

function FaqAccordion({
  items,
  baseId,
  tone = 'default',
}: {
  items: FaqItem[];
  baseId: string;
  tone?: 'default' | 'bento';
}) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);
  const isBento = tone === 'bento';

  return (
    <div
      className={
        isBento
          ? 'border-y border-white/10'
          : 'border-y border-[color:var(--border)]'
      }
    >
      {items.map((item, index) => {
        const isOpen = openId === item.id;
        const panelId = `${baseId}-panel-${item.id}`;
        const buttonId = `${baseId}-button-${item.id}`;

        return (
          <Reveal key={item.id} delay={Math.min(index, 8) * 0.03}>
            <div
              className={
                isBento
                  ? 'border-b border-white/10 last:border-b-0'
                  : 'border-b border-[color:var(--border)] last:border-b-0'
              }
            >
              <h3>
                <CtaButton
                  id={buttonId}
                  type="button"
                  variant="ghost"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className="h-auto w-full items-start justify-between gap-4 rounded-none px-0 py-5 text-left shadow-none active:scale-100"
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                >
                  <span
                    className={[
                      'break-words text-balance text-lg font-semibold tracking-tight',
                      isBento
                        ? 'text-[color:var(--bento-ink)]'
                        : 'text-[color:var(--ink)]',
                    ].join(' ')}
                  >
                    {item.question}
                  </span>
                  <CaretDown
                    weight="bold"
                    className={[
                      'mt-1 h-5 w-5 shrink-0 transition-transform duration-300',
                      isBento ? 'text-brand-400' : 'text-accent',
                      isOpen ? 'rotate-180' : '',
                    ].join(' ')}
                    aria-hidden
                  />
                </CtaButton>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                hidden={!isOpen}
                className="pb-5"
              >
                <p
                  className={[
                    'max-w-[65ch] text-base leading-relaxed',
                    isBento
                      ? 'text-[color:var(--bento-ink-muted)]'
                      : 'text-[color:var(--ink-muted)]',
                  ].join(' ')}
                >
                  {item.answer}
                </p>
              </div>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}

/** Compact FAQ block for the home page. */
export function FaqSection({ locale }: { locale: Locale }) {
  const items = getHomeFaqItems(locale);
  const baseId = useId();
  const p = prefix(locale);

  return (
    <section className="bg-[color:var(--bg)]" aria-labelledby={`${baseId}-title`}>
      <div className="mx-auto max-w-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <Reveal>
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
            <div className="flex flex-col items-center">
              <h2
                id={`${baseId}-title`}
                className="max-w-[18ch] text-3xl font-semibold tracking-tight text-[color:var(--ink)] md:text-4xl"
              >
                {t(locale, 'faqTitle')}
              </h2>
              <p className="mt-4 max-w-[55ch] text-base leading-relaxed text-[color:var(--ink-muted)]">
                {t(locale, 'faqSubtitle')}
              </p>
            </div>
            <CtaButton href={`${p}/faq`} variant="ghost" size="sm" className="font-medium">
              {t(locale, 'faqAllLink')}
            </CtaButton>
          </div>
        </Reveal>

        <div className="mx-auto mt-10 max-w-3xl">
          <BentoSurface className="px-5 sm:px-8">
            <div className="relative">
              <FaqAccordion items={items} baseId={baseId} tone="bento" />
            </div>
          </BentoSurface>
        </div>
      </div>
    </section>
  );
}

/** Full FAQ page with category filters. */
export function FaqPageView({ locale }: { locale: Locale }) {
  const baseId = useId();
  const p = prefix(locale);
  const [category, setCategory] = useState<FaqCategory | 'all'>('all');

  const items = useMemo(() => getFaqItemsByCategory(locale, category), [locale, category]);
  const filters: Array<FaqCategory | 'all'> = ['all', ...FAQ_CATEGORY_ORDER];

  return (
    <div className="landing-v2 landing-light-page landing-faq-v2">
      <section className="hero-wash border-b border-[color:var(--border)]">
        <div className="mx-auto max-w-shell px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <Reveal>
            <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-accent">
              FAQ
            </p>
            <h1 className="mt-4 max-w-[16ch] text-4xl font-semibold tracking-tight text-[color:var(--ink)] md:text-5xl">
              {t(locale, 'faqPageTitle')}
            </h1>
            <p className="mt-5 max-w-[58ch] text-base leading-relaxed text-[color:var(--ink-muted)] md:text-lg">
              {t(locale, 'faqPageSubtitle')}
            </p>
          </Reveal>
        </div>
      </section>

      <section
        className="mx-auto max-w-shell px-4 py-12 sm:px-6 lg:px-8 lg:py-16"
        aria-labelledby={`${baseId}-list`}
      >
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="FAQ categories">
          {filters.map((key) => {
            const active = category === key;
            return (
              <CtaButton
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                size="sm"
                variant={active ? 'primary' : 'secondary'}
                className="font-medium !shadow-none"
                onClick={() => setCategory(key)}
              >
                {getFaqCategoryLabel(locale, key)}
              </CtaButton>
            );
          })}
        </div>

        <h2 id={`${baseId}-list`} className="sr-only">
          {getFaqCategoryLabel(locale, category)}
        </h2>

        <div className="mt-10">
          <BentoSurface className="px-5 sm:px-8">
            <div className="relative">
              <FaqAccordion
                key={category}
                items={items}
                baseId={`${baseId}-${category}`}
                tone="bento"
              />
            </div>
          </BentoSurface>
        </div>
      </section>

      <section className="bg-[color:var(--bg-sunken)]">
        <div className="mx-auto max-w-shell px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <BentoSurface className="flex flex-col gap-6 px-6 py-10 sm:px-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative">
              <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--bento-ink)] md:text-3xl">
                {t(locale, 'faqStillTitle')}
              </h2>
              <p className="mt-3 max-w-[50ch] text-base text-[color:var(--bento-ink-muted)]">
                {t(locale, 'faqStillBody')}
              </p>
            </div>
            <div className="relative flex flex-wrap gap-3">
              <CtaButton href={enterExplainerUrl(locale)} size="md" className="font-medium">
                {t(locale, 'faqStillCta')}
              </CtaButton>
              <CtaButton href={`${p}/pricing`} variant="secondary" size="md" className="font-medium">
                {t(locale, 'faqStillSecondary')}
              </CtaButton>
            </div>
          </BentoSurface>
        </div>
      </section>
    </div>
  );
}
