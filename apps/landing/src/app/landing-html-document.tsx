import type { Metadata } from 'next';
import { JetBrains_Mono, Outfit } from 'next/font/google';
import type { ReactNode } from 'react';

import type { HtmlLang } from '@/lib/document-locale';
import { resolveLandingOrigin } from '@/lib/landing-origin';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

const landingUrl = resolveLandingOrigin();

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'Prospectly',
      url: landingUrl,
      email: 'hello@prospectly.dev',
      logo: `${landingUrl}/brand/prospectly-mark.png`,
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Prospectly',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: landingUrl,
      description:
        'Ferramenta de prospecção B2B para encontrar empresas e montar listas segmentadas no Brasil.',
      offers: [
        {
          '@type': 'Offer',
          price: 14.99,
          priceCurrency: 'BRL',
          name: '2.000 créditos',
        },
        {
          '@type': 'Offer',
          price: 23.99,
          priceCurrency: 'BRL',
          name: '5.000 créditos',
        },
        {
          '@type': 'Offer',
          price: 49.99,
          priceCurrency: 'BRL',
          name: 'Ilimitado mensal',
        },
      ],
    },
  ],
};

export function landingDocumentMetadata(): Pick<Metadata, 'metadataBase' | 'icons' | 'twitter'> {
  return {
    metadataBase: new URL(resolveLandingOrigin()),
    icons: {
      icon: [{ url: '/brand/prospectly-mark-v2.svg', type: 'image/svg+xml' }],
      apple: [{ url: '/brand/prospectly-mark-v2.svg', type: 'image/svg+xml' }],
    },
    twitter: {
      card: 'summary_large_image',
    },
  };
}

export function LandingHtmlDocument({ lang, children }: { lang: HtmlLang; children: ReactNode }) {
  return (
    <html lang={lang} className={`${outfit.variable} ${jetbrains.variable}`}>
      <body className="font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
        {children}
      </body>
    </html>
  );
}
