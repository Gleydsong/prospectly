import type { Metadata } from 'next';
import { FaqPageView } from '@/components/faq-section';
import { getFaqItems } from '@/lib/faq-content';

export const metadata: Metadata = {
  title: 'FAQ - Dúvidas sobre busca, planos e privacidade',
  description:
    'Respostas sobre Prospectly: filtro sem website, OpenStreetMap, Google Places, créditos e plano ilimitado, LGPD e como começar com 3 buscas grátis.',
};

export default function FaqPage() {
  const locale = 'pt' as const;
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
