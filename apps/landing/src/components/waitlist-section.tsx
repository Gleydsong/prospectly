import { Reveal } from '@/components/motion';
import { WaitlistForm } from '@/components/waitlist-form';
import { t, type Locale } from '@/lib/i18n';

export function WaitlistSection({ locale }: { locale: Locale }) {
  return (
    <section id="lista-espera" className="hero-wash border-y border-[color:var(--border)]">
      <div className="mx-auto max-w-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <Reveal className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h2 className="max-w-[20ch] text-3xl font-semibold tracking-tight text-[color:var(--ink)] md:text-4xl">
            {t(locale, 'waitlistTitle')}
          </h2>
          <p className="mt-5 max-w-[48ch] text-base leading-relaxed text-[color:var(--ink-muted)] md:text-lg">
            {t(locale, 'waitlistBody')}
          </p>
          <WaitlistForm locale={locale} />
        </Reveal>
      </div>
    </section>
  );
}
