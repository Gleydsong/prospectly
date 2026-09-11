import type { Metadata } from 'next';
import { FaqPageView } from '@/components/faq-section';
import { faqPageJsonLd } from '@/lib/faq-content';
import { canonicalFaqPath } from '@/lib/faq-routes';

const locale = 'en' as const;

export const metadata: Metadata = {
  title: 'FAQ - Search, plans, and privacy questions',
  description:
    'Answers about Prospectly: no-website filter, OpenStreetMap, Google Places, credits and unlimited plan, privacy, and how to start with 3 free searches.',
  alternates: { canonical: canonicalFaqPath(locale) },
};

export default function FaqPageEn() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageJsonLd(locale)).replace(/</g, '\\u003c') }}
      />
      <FaqPageView locale={locale} />
    </>
  );
}