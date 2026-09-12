import type { Metadata } from 'next';
import { CtaButton } from '@/components/ui/cta-button';
import { HOME_LANGUAGE_ALTERNATES } from '@/lib/document-locale';
import { landingOpenGraph } from '@/lib/landing-og';
import { t } from '@/lib/i18n';
import { enterExplainerUrl } from '@/lib/pricing';

const title = 'Prospectly | Find companies to prospect in Brazil';
const description = t('en', 'heroSubtitle');

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: {
    canonical: '/en',
    languages: HOME_LANGUAGE_ALTERNATES,
  },
  openGraph: landingOpenGraph({
    title,
    description,
    locale: 'en_US',
  }),
};

export default function EnHomePage() {
  return (
    <section className="landing-v2 landing-light-page hero-wash mx-auto max-w-shell px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <p className="text-center text-xs font-semibold tracking-wide text-accent">{t('en', 'heroEyebrow')}</p>
      <h1 className="mt-4 text-balance text-center text-3xl font-semibold tracking-tight text-[color:var(--ink)] md:text-4xl lg:text-5xl">
        {t('en', 'heroLead')}
      </h1>
      <p className="mx-auto mt-5 max-w-[46ch] text-center text-base leading-relaxed text-[color:var(--ink-muted)] md:text-lg">
        {description}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <CtaButton href={enterExplainerUrl('en')}>{t('en', 'heroPrimary')}</CtaButton>
        <CtaButton href={enterExplainerUrl('en')} variant="secondary">
          {t('en', 'heroSecondary')}
        </CtaButton>
      </div>
    </section>
  );
}
