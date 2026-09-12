import { EnvelopeSimple, Funnel, MagnifyingGlass, Path } from '@phosphor-icons/react/ssr';
import { ProductDemoVideo } from '@/components/product-demo-video';
import { HeroMotion } from '@/components/motion';
import { BentoCard, BentoIconDisk, BentoSurface } from '@/components/ui/bento-card';
import { CtaButton } from '@/components/ui/cta-button';
import { WaitlistForm } from '@/components/waitlist-form';
import { prefix, t, type Locale } from '@/lib/i18n';

export function EnterExplainerPage({ locale }: { locale: Locale }) {
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
    <div className="landing-v2 landing-light-page landing-enter-v2">
      <section className="hero-wash relative overflow-hidden border-b border-[color:var(--border)]">
        <div className="mx-auto grid max-w-shell items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8 lg:py-20">
          <HeroMotion className="text-center lg:col-span-5 lg:text-left">
            <p className="inline-flex items-center gap-2 rounded-control border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3 py-1.5 text-xs font-semibold tracking-wide text-accent">
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              {t(locale, 'enterBadge')}
            </p>

            <h1 className="mx-auto mt-5 max-w-[16ch] text-balance text-3xl font-semibold tracking-tight text-[color:var(--ink)] md:text-4xl lg:mx-0 lg:text-5xl">
              {t(locale, 'enterTitle')}
            </h1>

            <p className="mx-auto mt-5 max-w-[42ch] text-base leading-relaxed text-[color:var(--ink-muted)] md:text-lg lg:mx-0">
              {t(locale, 'enterLead')}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <CtaButton href="#lista-espera-entrar">
                <EnvelopeSimple weight="bold" className="h-4 w-4" aria-hidden />
                {t(locale, 'enterCtaWaitlist')}
              </CtaButton>
              <CtaButton href={p || '/'} variant="secondary">
                {t(locale, 'enterCtaHome')}
              </CtaButton>
            </div>
          </HeroMotion>

          <HeroMotion className="lg:col-span-7">
            <BentoSurface decor={false} className="relative aspect-video">
              <ProductDemoVideo locale={locale} className="absolute inset-0" />
            </BentoSurface>
          </HeroMotion>
        </div>
      </section>

      <section className="bg-[color:var(--bg-sunken)]">
        <div className="mx-auto max-w-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-[color:var(--ink)] md:text-4xl">
              {t(locale, 'enterHowTitle')}
            </h2>
            <p className="mx-auto mt-4 max-w-[50ch] text-base leading-relaxed text-[color:var(--ink-muted)]">
              {t(locale, 'enterHowBody')}
            </p>
          </div>

          <ol className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-3">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="list-none">
                  <BentoCard
                    visualSize="icon"
                    visual={
                      <BentoIconDisk>
                        <Icon weight="bold" className="h-6 w-6" aria-hidden />
                      </BentoIconDisk>
                    }
                    title={step.title}
                    description={step.body}
                  />
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="bg-[color:var(--bg)]">
        <div className="mx-auto max-w-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
          <BentoSurface className="grid gap-8 px-6 py-10 sm:px-10 lg:grid-cols-12 lg:items-center lg:gap-10">
            <div className="relative text-center lg:col-span-5 lg:text-left">
              <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--bento-ink)] md:text-3xl">
                {t(locale, 'enterWhyTitle')}
              </h2>
              <p className="mx-auto mt-4 max-w-[44ch] text-base leading-relaxed text-[color:var(--bento-ink-muted)] lg:mx-0">
                {t(locale, 'enterWhyBody')}
              </p>
            </div>
            <ul className="relative space-y-4 lg:col-span-7">
              {[t(locale, 'enterWhy1'), t(locale, 'enterWhy2'), t(locale, 'enterWhy3')].map(
                (item) => (
                  <li
                    key={item}
                    className="flex gap-3 text-left text-sm leading-relaxed text-[color:var(--bento-ink)] md:text-base"
                  >
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400"
                      aria-hidden
                    />
                    {item}
                  </li>
                ),
              )}
            </ul>
          </BentoSurface>
        </div>
      </section>

      <section id="lista-espera-entrar" className="bg-[color:var(--bg-sunken)]">
        <div className="mx-auto max-w-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <BentoSurface className="mx-auto flex max-w-2xl flex-col items-center px-6 py-10 text-center sm:px-10 sm:py-12">
            <h2 className="relative max-w-[18ch] text-3xl font-semibold tracking-tight text-[color:var(--bento-ink)] md:text-4xl">
              {t(locale, 'enterWaitlistTitle')}
            </h2>
            <p className="relative mt-4 max-w-[46ch] text-base leading-relaxed text-[color:var(--bento-ink-muted)] md:text-lg">
              {t(locale, 'enterWaitlistBody')}
            </p>
            <div className="relative w-full">
              <WaitlistForm locale={locale} tone="bento" />
            </div>
          </BentoSurface>
        </div>
      </section>
    </div>
  );
}
