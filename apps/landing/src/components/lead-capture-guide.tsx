'use client';

import { Funnel, ListChecks, Target } from '@phosphor-icons/react';
import { Reveal } from '@/components/motion';
import { getCaptureSteps, t, type Locale } from '@/lib/i18n';

const ICONS = [Target, Funnel, ListChecks] as const;

export function LeadCaptureGuide({ locale }: { locale: Locale }) {
  const steps = getCaptureSteps(locale);

  return (
    <section
      id="como-funciona"
      className="scroll-mt-20 bg-[color:var(--bg-sunken)]"
      aria-labelledby="capture-guide-title"
    >
      <div className="mx-auto max-w-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2
            id="capture-guide-title"
            className="mx-auto max-w-[20ch] text-3xl font-semibold tracking-tight text-[color:var(--ink)] md:text-4xl"
          >
            {t(locale, 'captureTitle')}
          </h2>
          <p className="mx-auto mt-4 max-w-[55ch] text-base leading-relaxed text-[color:var(--ink-muted)]">
            {t(locale, 'captureSubtitle')}
          </p>
        </Reveal>

        <ol className="relative mx-auto mt-10 max-w-3xl">
          <div
            className="absolute bottom-6 left-[1.15rem] top-6 w-px bg-[color:var(--border)] md:left-[1.4rem]"
            aria-hidden
          />
          {steps.map((step, index) => {
            const Icon = ICONS[index] ?? ListChecks;
            return (
              <Reveal key={step.id} delay={index * 0.05}>
                <li className="relative flex gap-5 pb-6 last:pb-0 md:gap-6">
                  <div className="relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--bg-raised)] font-mono text-xs font-semibold text-accent md:h-11 md:w-11 md:text-sm">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className="surface-raised min-w-0 flex-1 rounded-control p-5 md:p-6">
                    <div className="flex items-start gap-3">
                      <Icon
                        weight="duotone"
                        className="mt-0.5 h-5 w-5 shrink-0 text-accent"
                        aria-hidden
                      />
                      <div>
                        <h3 className="text-lg font-semibold tracking-tight text-[color:var(--ink)] md:text-xl">
                          {step.title}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-muted)] md:text-base">
                          {step.body}
                        </p>
                        <p className="mt-3 border-l-2 border-accent/40 pl-3 text-sm text-[color:var(--ink)]">
                          <span className="font-medium text-accent">
                            {t(locale, 'captureActionLabel')}
                          </span>{' '}
                          {step.action}
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              </Reveal>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
