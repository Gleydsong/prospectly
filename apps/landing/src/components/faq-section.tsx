'use client';

import { CaretDown } from '@phosphor-icons/react';
import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import { Reveal } from '@/components/motion';
import {
  FAQ_CATEGORY_ORDER,
  getFaqCategoryLabel,
  getFaqItemsByCategory,
  getHomeFaqItems,
  type FaqCategory,
  type FaqItem,
} from '@/lib/faq-content';
import { prefix, t, type Locale } from '@/lib/i18n';
import { appRegisterUrl } from '@/lib/pricing';

function FaqAccordion({
  items,
  baseId,
}: {
  items: FaqItem[];
  baseId: string;
}) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  return (
    <div className="border-y border-[color:var(--border)]">
      {items.map((item, index) => {
        const isOpen = openId === item.id;
        const panelId = `${baseId}-panel-${item.id}`;
        const buttonId = `${baseId}-button-${item.id}`;

        return (
          <Reveal key={item.id} delay={Math.min(index, 8) * 0.03}>
            <div className="border-b border-[color:var(--border)] last:border-b-0">
              <h3>
                <button
                  id={buttonId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className="focus-ring flex w-full items-start justify-between gap-4 py-5 text-left transition-colors hover:text-accent"
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                >
                  <span className="break-words text-balance text-lg font-semibold tracking-tight text-[color:var(--ink)]">
                    {item.question}
                  </span>
                  <CaretDown
                    weight="bold"
                    className={`mt-1 h-5 w-5 shrink-0 text-accent transition-transform duration-300 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden
                  />
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                hidden={!isOpen}
                className="pb-5"
              >
                <p className="max-w-[65ch] text-base leading-relaxed text-[color:var(--ink-muted)]">
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
    <section className="bg-[color:var(--bg-sunken)]" aria-labelledby={`${baseId}-title`}>
      <div className="mx-auto max-w-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <Reveal>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
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
            <Link
              href={`${p}/faq`}
              className="focus-ring shrink-0 text-sm font-medium text-accent hover:text-accent-hover"
            >
              {t(locale, 'faqAllLink')}
            </Link>
          </div>
        </Reveal>

        <div className="mt-10">
          <FaqAccordion items={items} baseId={baseId} />
        </div>
      </div>
    </section>
  );
}

/** Full FAQ page with category filters. */
export function FaqPageView({ locale }: { locale: Locale }) {
  const baseId = useId();
  const p = prefix(locale);
  const currency = locale === 'pt' ? 'BRL' : 'EUR';
  const [category, setCategory] = useState<FaqCategory | 'all'>('all');

  const items = useMemo(() => getFaqItemsByCategory(locale, category), [locale, category]);
  const filters: Array<FaqCategory | 'all'> = ['all', ...FAQ_CATEGORY_ORDER];

  return (
    <div>
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

      <section className="mx-auto max-w-shell px-4 py-12 sm:px-6 lg:px-8 lg:py-16" aria-labelledby={`${baseId}-list`}>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="FAQ categories">
          {filters.map((key) => {
            const active = category === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                className={`focus-ring rounded-control px-3.5 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-accent text-white dark:text-accent-ink'
                    : 'border border-[color:var(--border)] bg-[color:var(--bg-raised)] text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]'
                }`}
                onClick={() => setCategory(key)}
              >
                {getFaqCategoryLabel(locale, key)}
              </button>
            );
          })}
        </div>

        <h2 id={`${baseId}-list`} className="sr-only">
          {getFaqCategoryLabel(locale, category)}
        </h2>

        <div className="mt-10">
          <FaqAccordion key={category} items={items} baseId={`${baseId}-${category}`} />
        </div>
      </section>

      <section className="border-t border-[color:var(--border)] bg-[color:var(--bg-sunken)]">
        <div className="mx-auto flex max-w-shell flex-col gap-6 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-20">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--ink)] md:text-3xl">
              {t(locale, 'faqStillTitle')}
            </h2>
            <p className="mt-3 max-w-[50ch] text-base text-[color:var(--ink-muted)]">
              {t(locale, 'faqStillBody')}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={appRegisterUrl('monthly', currency)}
              className="focus-ring inline-flex items-center justify-center rounded-control bg-accent px-5 py-3 text-sm font-medium text-white transition-transform hover:bg-accent-hover active:scale-[0.98] dark:text-accent-ink"
            >
              {t(locale, 'faqStillCta')}
            </a>
            <Link
              href={`${p}/pricing`}
              className="focus-ring inline-flex items-center justify-center rounded-control border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-5 py-3 text-sm font-medium text-[color:var(--ink)]"
            >
              {t(locale, 'faqStillSecondary')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
