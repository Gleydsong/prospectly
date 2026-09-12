import type { Metadata } from 'next';
import { LandingHtmlDocument, landingDocumentMetadata } from '@/app/landing-html-document';
import { CookieBanner } from '@/components/cookie-banner';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import { landingOpenGraph } from '@/lib/landing-og';

const sharedMetadata = landingDocumentMetadata();

export const metadata: Metadata = {
  ...sharedMetadata,
  title: {
    default: 'Prospectly | Find companies to prospect in Brazil',
    template: '%s | Prospectly',
  },
  description:
    'Build segmented lists of Brazilian companies for B2B prospecting. More clarity, less manual work.',
  openGraph: landingOpenGraph({
    ...sharedMetadata.openGraph,
    type: 'website',
    locale: 'en_US',
    siteName: 'Prospectly',
  }),
};

export default function EnLayout({ children }: { children: React.ReactNode }) {
  return (
    <LandingHtmlDocument lang="en">
      <SiteHeader locale="en" />
      <main>{children}</main>
      <SiteFooter locale="en" />
      <CookieBanner locale="en" />
    </LandingHtmlDocument>
  );
}
