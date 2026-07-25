import { CookieBanner } from '@/components/cookie-banner';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';

export default function PtLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader locale="pt" />
      <main>{children}</main>
      <SiteFooter locale="pt" />
      <CookieBanner locale="pt" />
    </>
  );
}
