import type { Metadata } from 'next';
import { CookieBanner } from '@/components/cookie-banner';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';

export const metadata: Metadata = {
  title: {
    default: 'Prospectly | Find companies to prospect in Brazil',
    template: '%s | Prospectly',
  },
  description:
    'Build segmented lists of Brazilian companies for B2B prospecting. More clarity, less manual work.',
  openGraph: {
    locale: 'en_US',
  },
};

export default function EnLayout({ children }: { children: React.ReactNode }) {
  return (
    <div lang="en">
      <SiteHeader locale="en" />
      <main>{children}</main>
      <SiteFooter locale="en" />
      <CookieBanner locale="en" />
    </div>
  );
}
