import type { Metadata } from 'next';
import { CookieBanner } from '@/components/cookie-banner';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';

export const metadata: Metadata = {
  title: {
    default: 'Prospectly - Local lead prospecting for agencies',
    template: '%s | Prospectly',
  },
  description:
    'Find businesses without a website using OpenStreetMap and Google Places. Prospecting SaaS for digital agencies and freelancers.',
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
