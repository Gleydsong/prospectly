import Image from 'next/image';
import { MagnifyingGlass, Table, Wrench } from '@phosphor-icons/react/dist/ssr';
import { AudienceSegments } from '@/components/audience-segments';
import { ConversionBand } from '@/components/conversion-band';
import { DifferentialsSection } from '@/components/differentials-section';
import { FaqSection } from '@/components/faq-section';
import { FinalCtaSection } from '@/components/final-cta-section';
import { LeadCaptureGuide } from '@/components/lead-capture-guide';
import { Reveal } from '@/components/motion';
import { ProductDemoVideo } from '@/components/product-demo-video';
import { TrustStrip } from '@/components/trust-strip';
import { WaitlistSection } from '@/components/waitlist-section';
import { getHomeFaqItems, t, type Locale } from '@/lib/i18n';

const PROBLEM_CARDS = [
  { title: 'problemCard1Title', body: 'problemCard1Body', Icon: MagnifyingGlass },
  { title: 'problemCard2Title', body: 'problemCard2Body', Icon: Table },
  { title: 'problemCard3Title', body: 'problemCard3Body', Icon: Wrench },
] as const;

export function HomeLanding({ locale }: { locale: Locale }) {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: getHomeFaqItems(locale).map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <ConversionBand locale={locale} />

      <section className="mx-auto max-w-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-20" aria-labelledby="problem-heading">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2
            id="problem-heading"
            className="text-3xl font-semibold tracking-tight text-[color:var(--ink)] md:text-4xl"
          >
            {t(locale, 'problemTitle')}
          </h2>
          <p className="mx-auto mt-5 max-w-[60ch] text-base leading-relaxed text-[color:var(--ink-muted)] md:text-lg">
            {t(locale, 'problemBody')}
          </p>
        </Reveal>
        <ul className="mt-10 grid gap-4 sm:grid-cols-3">
          {PROBLEM_CARDS.map(({ title, body, Icon }) => (
            <li key={title} className="surface-raised rounded-control p-5 text-left">
              <Icon weight="duotone" className="h-6 w-6 text-accent" aria-hidden />
              <h3 className="mt-3 text-base font-semibold text-[color:var(--ink)]">{t(locale, title)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-muted)]">{t(locale, body)}</p>
            </li>
          ))}
        </ul>
        <div className="relative mt-10 aspect-[21/9] overflow-hidden rounded-control border border-[color:var(--border)] bg-[color:var(--bg-sunken)]">
          <Image
            src="/images/local-business-prospecting-premium.jpg"
            alt={
              locale === 'pt'
                ? 'Fachada de pequeno comércio em rua urbana brasileira'
                : 'Small business storefront on a Brazilian urban street'
            }
            fill
            className="object-cover"
            sizes="(max-width: 1400px) 100vw, 1400px"
          />
        </div>
      </section>

      <LeadCaptureGuide locale={locale} />

      <section className="bg-[color:var(--bg)]" aria-labelledby="filter-heading">
        <div className="mx-auto grid max-w-shell items-center gap-8 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:px-8 lg:py-20">
          <Reveal className="mx-auto flex max-w-xl flex-col items-center text-center lg:col-span-5 lg:mx-0 lg:max-w-none lg:items-start lg:text-left">
            <h2
              id="filter-heading"
              className="max-w-[20ch] text-3xl font-semibold tracking-tight text-[color:var(--ink)] md:text-4xl"
            >
              {t(locale, 'filterTitle')}
            </h2>
            <p className="mt-5 max-w-[50ch] text-base leading-relaxed text-[color:var(--ink-muted)]">
              {t(locale, 'filterBody')}
            </p>
            <div className="mt-8 inline-flex items-center gap-2 rounded-control border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-4 py-3 text-sm font-medium text-[color:var(--ink)]">
              <MagnifyingGlass weight="bold" className="h-4 w-4 text-accent" aria-hidden />
              {locale === 'pt' ? 'Filtro sem website reportado' : 'No-website-reported filter'}
            </div>
          </Reveal>
          <Reveal
            className="relative aspect-video overflow-hidden rounded-control border border-[color:var(--border)] bg-[color:var(--bg-sunken)] shadow-soft lg:col-span-7"
            delay={0.06}
          >
            <ProductDemoVideo locale={locale} className="absolute inset-0" />
          </Reveal>
        </div>
      </section>

      <AudienceSegments locale={locale} />
      <DifferentialsSection locale={locale} />
      <TrustStrip locale={locale} />
      <WaitlistSection locale={locale} />
      <FaqSection locale={locale} />
      <FinalCtaSection locale={locale} />
    </>
  );
}
