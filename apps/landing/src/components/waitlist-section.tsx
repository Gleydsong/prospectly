import { Reveal } from '@/components/motion';
import { WaitlistForm } from '@/components/waitlist-form';
import { BentoSurface } from '@/components/ui/bento-card';
import { t, type Locale } from '@/lib/i18n';

export function WaitlistSection({ locale }: { locale: Locale }) {
  return (
    <section id="lista-espera" className="bg-[color:var(--bg-sunken)]">
      <div className="mx-auto max-w-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <Reveal>
          <BentoSurface className="mx-auto max-w-2xl px-6 py-10 text-center sm:px-10 sm:py-12">
            <h2 className="relative mx-auto max-w-[20ch] text-3xl font-semibold tracking-tight text-[color:var(--bento-ink)] md:text-4xl">
              {t(locale, 'waitlistTitle')}
            </h2>
            <p className="relative mx-auto mt-5 max-w-[48ch] text-base leading-relaxed text-[color:var(--bento-ink-muted)] md:text-lg">
              {t(locale, 'waitlistBody')}
            </p>
            <div className="relative flex justify-center">
              <WaitlistForm locale={locale} tone="bento" />
            </div>
          </BentoSurface>
        </Reveal>
      </div>
    </section>
  );
}
