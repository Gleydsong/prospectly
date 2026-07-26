import type { Metadata } from 'next';
import { JetBrains_Mono, Outfit } from 'next/font/google';
import { DISPLAY_PRICES } from '@/lib/pricing';
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
    icon: [{ url: '/brand/prospectly-mark.png', type: 'image/png' }],
    apple: [{ url: '/brand/prospectly-mark.png', type: 'image/png' }],
  },
  title: {
    default: 'Prospectly - Prospecção de leads locais para agências',
    template: '%s | Prospectly',
  },
  description:
    'Encontre empresas sem site com OpenStreetMap e Google Places. SaaS de prospecção para agências digitais e freelancers no Brasil e Europa.',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Prospectly',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Prospectly',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: [
    {
      '@type': 'Offer',
      price: DISPLAY_PRICES.monthly.BRL.amount,
      priceCurrency: 'BRL',
      name: 'Starter mensal',
    },
    {
      '@type': 'Offer',
      price: DISPLAY_PRICES.lifetime.BRL.amount,
      priceCurrency: 'BRL',
      name: 'Starter vitalício',
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${outfit.variable} ${jetbrains.variable}`}>
      <body className="font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
