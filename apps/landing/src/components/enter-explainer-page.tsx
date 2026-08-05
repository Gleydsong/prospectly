'use client';

import Link from 'next/link';
import { useReducedMotion, motion } from 'motion/react';
import { MagnifyingGlass, Funnel, Path, EnvelopeSimple } from '@phosphor-icons/react';
import { ProductDemoVideo } from '@/components/product-demo-video';
import { CtaButton } from '@/components/ui/cta-button';
import { WaitlistForm } from '@/components/waitlist-form';
import { prefix, t, type Locale } from '@/lib/i18n';

const ease = [0.16, 1, 0.3, 1] as const;

function StepIcon({
  icon: Icon,
  delay,
  animate,
}: {
  icon: typeof MagnifyingGlass;
  delay: number;
  animate: boolean;
}) {
  if (!animate) {
    return (
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-control bg-accent/10 text-accent">
        <Icon weight="bold" className="h-5 w-5" aria-hidden />
      </span>
    );
  }

  return (
    <motion.span
      className="inline-flex h-11 w-11 items-center justify-center rounded-control bg-accent/10 text-accent"
      initial={{ opacity: 0, scale: 0.7 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.45, delay, ease }}
    >
      <Icon weight="bold" className="h-5 w-5" aria-hidden />
    </motion.span>
  );
}

export function EnterExplainerPage({ locale }: { locale: Locale }) {
  const reduce = useReducedMotion();
  const animate = !reduce;
  const p = prefix(locale);

  const steps = [
    {
      icon: MagnifyingGlass,
      title: t(locale, 'enterStep1Title'),
      body: t(locale, 'enterStep1Body'),
    },
    {
      icon: Funnel,
      title: t(locale, 'enterStep2Title'),
      body: t(locale, 'enterStep2Body'),
    },
    {
      icon: Path,
      title: t(locale, 'enterStep3Title'),
      body: t(locale, 'enterStep3Body'),
    },
  ] as const;

  return (
    <div>
      <section className="hero-wash relative overflow-hidden border-b border-[color:var(--border)]">
        <div className="mx-auto grid max-w-shell items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8 lg:py-20">
          <div className="text-center lg:col-span-5 lg:text-left">
            {animate ? (
              <motion.p
                className="inline-flex items-center gap-2 rounded-control border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3 py-1.5 text-xs font-semibold tracking-wide text-accent"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease }}
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                {t(locale, 'enterBadge')}
              </motion.p>
            ) : (
              <p className="inline-flex items-center gap-2 rounded-control border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3 py-1.5 text-xs font-semibold tracking-wide text-accent">
                {t(locale, 'enterBadge')}
              </p>
            )}

            {animate ? (
              <motion.h1
                className="mt-5 max-w-[16ch] text-balance text-3xl font-semibold tracking-tight text-[color:var(--ink)] md:text-4xl lg:text-5xl lg:mx-0 mx-auto"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.08, ease }}
              >
                {t(locale, 'enterTitle')}
              </motion.h1>
            ) : (
              <h1 className="mx-auto mt-5 max-w-[16ch] text-balance text-3xl font-semibold tracking-tight text-[color:var(--ink)] md:text-4xl lg:mx-0 lg:text-5xl">
                {t(locale, 'enterTitle')}
              </h1>
            )}

            {animate ? (
              <motion.p
                className="mx-auto mt-5 max-w-[42ch] text-base leading-relaxed text-[color:var(--ink-muted)] md:text-lg lg:mx-0"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.16, ease }}
              >
                {t(locale, 'enterLead')}
              </motion.p>
            ) : (
              <p className="mx-auto mt-5 max-w-[42ch] text-base leading-relaxed text-[color:var(--ink-muted)] md:text-lg lg:mx-0">
                {t(locale, 'enterLead')}
              </p>
            )}

            {animate ? (
              <motion.div
                className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.24, ease }}
              >
                <CtaButton href="#lista-espera-entrar">
                  <EnvelopeSimple weight="bold" className="h-4 w-4" aria-hidden />
                  {t(locale, 'enterCtaWaitlist')}
                </CtaButton>
                <CtaButton href={p || '/'} variant="secondary">
                  {t(locale, 'enterCtaHome')}
                </CtaButton>
              </motion.div>
            ) : (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <CtaButton href="#lista-espera-entrar">
                  <EnvelopeSimple weight="bold" className="h-4 w-4" aria-hidden />
                  {t(locale, 'enterCtaWaitlist')}
                </CtaButton>
                <CtaButton href={p || '/'} variant="secondary">
                  {t(locale, 'enterCtaHome')}
                </CtaButton>
              </div>
            )}
          </div>

          {animate ? (
            <motion.div
              className="relative aspect-video overflow-hidden rounded-control border border-[color:var(--border)] bg-[color:var(--bg-sunken)] shadow-soft lg:col-span-7"
              initial={{ opacity: 0, scale: 0.96, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.12, ease }}
            >
              <ProductDemoVideo locale={locale} className="absolute inset-0" />
            </motion.div>
          ) : (
            <div className="relative aspect-video overflow-hidden rounded-control border border-[color:var(--border)] bg-[color:var(--bg-sunken)] shadow-soft lg:col-span-7">
              <ProductDemoVideo locale={locale} className="absolute inset-0" />
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-[color:var(--ink)] md:text-4xl">
            {t(locale, 'enterHowTitle')}
          </h2>
          <p className="mx-auto mt-4 max-w-[50ch] text-base leading-relaxed text-[color:var(--ink-muted)]">
            {t(locale, 'enterHowBody')}
          </p>
        </div>

        <ol className="mx-auto mt-12 grid max-w-4xl gap-10 sm:grid-cols-3 sm:gap-8">
          {steps.map((step, index) => (
            <li key={step.title} className="flex flex-col items-center text-center sm:items-start sm:text-left">
              <StepIcon icon={step.icon} delay={0.05 * index} animate={animate} />
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-accent">
                {locale === 'pt' ? `Passo ${index + 1}` : `Step ${index + 1}`}
              </p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-[color:var(--ink)]">
                {step.title}
              </h3>
              <p className="mt-2 max-w-[36ch] text-sm leading-relaxed text-[color:var(--ink-muted)]">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-[color:var(--border)] bg-[color:var(--bg-sunken)]/40">
        <div className="mx-auto grid max-w-shell items-center gap-8 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:px-8 lg:py-16">
          <div className="text-center lg:col-span-5 lg:text-left">
            <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--ink)] md:text-3xl">
              {t(locale, 'enterWhyTitle')}
            </h2>
            <p className="mx-auto mt-4 max-w-[44ch] text-base leading-relaxed text-[color:var(--ink-muted)] lg:mx-0">
              {t(locale, 'enterWhyBody')}
            </p>
          </div>
          <ul className="space-y-4 lg:col-span-7">
            {[t(locale, 'enterWhy1'), t(locale, 'enterWhy2'), t(locale, 'enterWhy3')].map(
              (item, i) => (
                <li
                  key={item}
                  className="flex gap-3 text-left text-sm leading-relaxed text-[color:var(--ink)] md:text-base"
                  style={animate ? { animationDelay: `${i * 60}ms` } : undefined}
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                  {item}
                </li>
              ),
            )}
          </ul>
        </div>
      </section>

      <section id="lista-espera-entrar" className="hero-wash">
        <div className="mx-auto flex max-w-shell flex-col items-center px-4 py-14 text-center sm:px-6 lg:px-8 lg:py-20">
          <h2 className="max-w-[18ch] text-3xl font-semibold tracking-tight text-[color:var(--ink)] md:text-4xl">
            {t(locale, 'enterWaitlistTitle')}
          </h2>
          <p className="mt-4 max-w-[46ch] text-base leading-relaxed text-[color:var(--ink-muted)] md:text-lg">
            {t(locale, 'enterWaitlistBody')}
          </p>
          <WaitlistForm locale={locale} />
        </div>
      </section>
    </div>
  );
}
