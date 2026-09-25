import localFont from 'next/font/local';
import type { ReactNode } from 'react';

import type { HtmlLang } from '@/lib/document-locale';
import { resolveLandingOrigin } from '@/lib/landing-origin';
import './globals.css';

export { landingDocumentMetadata } from '@/lib/landing-og';

const outfit = localFont({
  src: [
    {
      path: '../../node_modules/@fontsource/outfit/files/outfit-latin-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../node_modules/@fontsource/outfit/files/outfit-latin-500-normal.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../node_modules/@fontsource/outfit/files/outfit-latin-600-normal.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../../node_modules/@fontsource/outfit/files/outfit-latin-700-normal.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-outfit',
  display: 'swap',
});

const jetbrains = localFont({
  src: [
    {
      path: '../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff2',
      weight: '600',
      style: 'normal',
    },
  ],
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
