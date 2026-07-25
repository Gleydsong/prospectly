import Image from 'next/image';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/ssr';
import { ConversionBand } from '@/components/conversion-band';
import { FaqSection } from '@/components/faq-section';
import { LeadCaptureGuide } from '@/components/lead-capture-guide';
import { Reveal } from '@/components/motion';
import { TrustStrip } from '@/components/trust-strip';
import { getFaqItems, t, type Locale } from '@/lib/i18n';

export function HomeLanding({ locale }: { locale: Locale }) {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: getFaqItems(locale).map((item) => ({
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

      <TrustStrip locale={locale} />

      <section className="mx-auto max-w-shell px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
          <Reveal className="relative aspect-[4/3] overflow-hidden rounded-control lg:col-span-6">
            <Image
              src="/images/no-website-shop.jpg"
              alt={
                locale === 'pt'
                  ? 'Vitrine de negócio local sem presença digital'
                  : 'Local storefront with little digital presence'
              }
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </Reveal>
          <Reveal className="lg:col-span-6" delay={0.08}>
            <h2 className="max-w-[16ch] text-3xl font-semibold tracking-tight text-[color:var(--ink)] md:text-4xl">
              {t(locale, 'problemTitle')}
            </h2>
            <p className="mt-5 max-w-[55ch] text-base leading-relaxed text-[color:var(--ink-muted)]">
              {t(locale, 'problemBody')}
            </p>
          </Reveal>
        </div>
      </section>

      <section className="bg-[color:var(--bg)]">
        <div className="mx-auto grid max-w-shell items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:gap-14 lg:px-8 lg:py-28">
          <Reveal className="lg:col-span-5">
            <h2 className="max-w-[18ch] text-3xl font-semibold tracking-tight text-[color:var(--ink)] md:text-4xl">
              {t(locale, 'filterTitle')}
            </h2>
            <p className="mt-5 max-w-[50ch] text-base leading-relaxed text-[color:var(--ink-muted)]">
              {t(locale, 'filterBody')}
            </p>
            <div className="mt-8 inline-flex items-center gap-2 rounded-control border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-4 py-3 text-sm font-medium text-[color:var(--ink)]">
              <MagnifyingGlass weight="bold" className="h-4 w-4 text-accent" aria-hidden />
              {locale === 'pt' ? 'Filtro sem website ativo' : 'No-website filter on'}
            </div>
          </Reveal>
          <Reveal className="relative aspect-[4/3] overflow-hidden rounded-control lg:col-span-7" delay={0.06}>
            <Image
              src="/images/workflow-desk.jpg"
              alt={
                locale === 'pt'
                  ? 'Mesa de trabalho com mapa de prospecção no notebook'
                  : 'Desk with a prospecting map open on a laptop'
              }
              fill
              sizes="(max-width: 1024px) 100vw, 58vw"
              className="object-cover"
            />
          </Reveal>
        </div>
      </section>

      <LeadCaptureGuide locale={locale} />

      <FaqSection locale={locale} />
    </>
  );
}
