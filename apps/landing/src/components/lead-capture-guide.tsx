'use client';

import { Funnel, ListChecks, Target } from '@phosphor-icons/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { BentoSurface } from '@/components/ui/bento-card';
import { getCaptureSteps, t, type Locale } from '@/lib/i18n';

gsap.registerPlugin(ScrollTrigger);

const ICONS = [Target, Funnel, ListChecks] as const;

export function LeadCaptureGuide({ locale }: { locale: Locale }) {
  const steps = getCaptureSteps(locale);
  const rootRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduce) return;

    const ctx = gsap.context(() => {
      const heading = root.querySelector<HTMLElement>('[data-gsap="heading"]');
      const line = root.querySelector<HTMLElement>('[data-gsap="line"]');
      const badges = gsap.utils.toArray<HTMLElement>('[data-gsap="badge"]', root);
      const cards = gsap.utils.toArray<HTMLElement>('[data-gsap="card"]', root);

      // Estado "antes": scrub controla o progresso nos dois sentidos.
      if (heading) gsap.set(heading, { opacity: 0, y: 48 });
      if (line) gsap.set(line, { scaleY: 0, transformOrigin: 'top center' });
      gsap.set(badges, { scale: 0.4, opacity: 0 });
      gsap.set(cards, { opacity: 0, x: 64, y: 20 });

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root,
          // Enquanto a seção atravessa o viewport, a timeline acompanha o scroll.
          start: 'top 85%',
          end: 'bottom 25%',
          scrub: 0.85,
          invalidateOnRefresh: true,
        },
      });

      if (heading) {
        tl.to(heading, { opacity: 1, y: 0, duration: 0.35 }, 0);
      }

      if (line) {
        tl.to(line, { scaleY: 1, duration: 0.55 }, 0.12);
      }

      tl.to(
        badges,
        {
          scale: 1,
          opacity: 1,
          duration: 0.45,
          stagger: 0.12,
        },
        0.18,
      ).to(
        cards,
        {
          opacity: 1,
          x: 0,
          y: 0,
          duration: 0.55,
          stagger: 0.14,
        },
        0.22,
      );
    }, root);

    return () => ctx.revert();
  }, [reduce, locale]);

  return (
    <section
      id="como-funciona"
      className="scroll-mt-20 bg-[color:var(--bg)]"
      aria-labelledby="capture-guide-title"
    >
      <div ref={rootRef} className="mx-auto max-w-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div data-gsap="heading" className="mx-auto max-w-3xl text-center">
          <h2
            id="capture-guide-title"
            className="mx-auto max-w-[20ch] text-3xl font-semibold tracking-tight text-[color:var(--ink)] md:text-4xl"
          >
            {t(locale, 'captureTitle')}
          </h2>
          <p className="mx-auto mt-4 max-w-[55ch] text-base leading-relaxed text-[color:var(--ink-muted)]">
            {t(locale, 'captureSubtitle')}
          </p>
        </div>

        <ol data-gsap="list" className="relative mx-auto mt-10 max-w-3xl">
          <div
            data-gsap="line"
            className="absolute bottom-6 left-[1.15rem] top-6 w-px bg-[color:var(--border)] md:left-[1.4rem]"
            aria-hidden
          />
          {steps.map((step, index) => {
            const Icon = ICONS[index] ?? ListChecks;
            return (
              <li key={step.id} className="relative flex gap-5 pb-6 last:pb-0 md:gap-6">
                <div
                  data-gsap="badge"
                  className="relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--bento-border)] bg-[#15181d] font-mono text-xs font-semibold text-brand-400 md:h-11 md:w-11 md:text-sm"
                >
                  {String(index + 1).padStart(2, '0')}
                </div>
                <BentoSurface data-gsap="card" className="min-w-0 flex-1 p-5 md:p-6">
                  <div className="relative flex items-start gap-3">
                    <Icon
                      weight="duotone"
                      className="mt-0.5 h-5 w-5 shrink-0 text-brand-400"
                      aria-hidden
                    />
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight text-[color:var(--bento-ink)] md:text-xl">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-[color:var(--bento-ink-muted)] md:text-base">
                        {step.body}
                      </p>
                      <p className="mt-3 border-l-2 border-brand-500/50 pl-3 text-sm text-[color:var(--bento-ink)]">
                        <span className="font-medium text-brand-400">
                          {t(locale, 'captureActionLabel')}
                        </span>{' '}
                        {step.action}
                      </p>
                    </div>
                  </div>
                </BentoSurface>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
