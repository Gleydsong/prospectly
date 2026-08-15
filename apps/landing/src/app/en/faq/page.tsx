import type { Metadata } from 'next';
import { FaqPageView } from '@/components/faq-section';
import { getFaqItems } from '@/lib/faq-content';

export const metadata: Metadata = {
  title: 'FAQ - Search, plans, and privacy questions',
  description:
    'Answers about Prospectly: no-website filter, OpenStreetMap, Google Places, credits and unlimited plan, privacy, and how to start with 3 free searches.',
};

export default function FaqPageEn() {
  const locale = 'en' as const;
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }}
      />
      <FaqPageView locale={locale} />
    </>
  );
}
