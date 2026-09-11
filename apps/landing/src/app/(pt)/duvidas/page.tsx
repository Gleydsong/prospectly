import type { Metadata } from 'next';
import { LandingV2SectionPage } from '@/components/landing-v2';
import { faqPageJsonLd } from '@/lib/faq-content';
import { canonicalFaqPath } from '@/lib/faq-routes';

const locale = 'pt' as const;

export const metadata: Metadata = {
  title: 'Dúvidas frequentes | Prospectly',
  description: 'Respostas diretas sobre busca, dados, créditos e o fluxo do Prospectly.',
  alternates: { canonical: canonicalFaqPath(locale) },
};

export default function QuestionsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageJsonLd(locale)).replace(/</g, '\\u003c') }}
      />
      <LandingV2SectionPage locale={locale} section="faq" />
    </>
  );
}
