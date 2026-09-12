'use client';

import { usePathname } from 'next/navigation';
import { CookieBanner } from '@/components/cookie-banner';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import type { Locale } from '@/lib/i18n';

/** Legal/explainer pages that still use SiteHeader instead of Landing V2 chrome. */
const LEGACY_CHROME_PATHS = new Set([
  '/pricing',
  '/entrar',
  '/privacy',
  '/terms',
  '/cookies',
  '/lista-de-empresas',
  '/prospeccao-para-consultorias',
  '/prospeccao-para-agencias',
  '/prospeccao-b2b',
]);

function usesLegacyChrome(pathname: string | null): boolean {
  return pathname != null && LEGACY_CHROME_PATHS.has(pathname);
}

export function PtSiteChrome({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (!usesLegacyChrome(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <SiteHeader locale={locale} />
      <main>{children}</main>
      <SiteFooter locale={locale} />
      <CookieBanner locale={locale} />
    </>
  );
}
