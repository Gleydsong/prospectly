import type { Metadata } from 'next';
import { JetBrains_Mono, Outfit } from 'next/font/google';
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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_LANDING_URL ?? 'http://localhost:3001'),
  icons: {
    icon: [{ url: '/brand/prospectly-mark-v2.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/brand/prospectly-mark-v2.svg', type: 'image/svg+xml' }],
  },
  title: {
    default: 'Prospectly | Encontre empresas para prospectar no Brasil',
    template: '%s | Prospectly',
  },
  description:
    'Crie listas segmentadas de empresas brasileiras para sua prospecção B2B. Encontre oportunidades com mais clareza e menos trabalho manual.',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Prospectly',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL ?? 'http://localhost:3001';

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
          price: 9.99,
          priceCurrency: 'BRL',
          name: '2.000 créditos',
        },
        {
          '@type': 'Offer',
          price: 19.99,
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${outfit.variable} ${jetbrains.variable}`}>
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
