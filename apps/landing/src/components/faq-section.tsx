'use client';

import { CaretDown } from '@phosphor-icons/react';
import { useId, useState } from 'react';
import { Reveal } from '@/components/motion';
import { getFaqItems, t, type Locale } from '@/lib/i18n';

export function FaqSection({ locale }: { locale: Locale }) {
  const items = getFaqItems(locale);
  const baseId = useId();
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  return (
    <section className="bg-[color:var(--bg-sunken)]" aria-labelledby={`${baseId}-title`}>
      <div className="mx-auto max-w-shell px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <Reveal>
          <h2
            id={`${baseId}-title`}
            className="max-w-[18ch] text-3xl font-semibold tracking-tight text-[color:var(--ink)] md:text-4xl"
          >
            {t(locale, 'faqTitle')}
          </h2>
          <p className="mt-4 max-w-[55ch] text-base leading-relaxed text-[color:var(--ink-muted)]">
            {t(locale, 'faqSubtitle')}
          </p>
        </Reveal>

        <div className="mt-12 border-y border-[color:var(--border)]">
          {items.map((item, index) => {
            const isOpen = openId === item.id;
            const panelId = `${baseId}-panel-${item.id}`;
            const buttonId = `${baseId}-button-${item.id}`;

            return (
              <Reveal key={item.id} delay={index * 0.04}>
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
                      <span className="text-lg font-semibold tracking-tight text-[color:var(--ink)]">
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
      </div>
    </section>
  );
}
