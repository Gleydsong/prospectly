'use client';

import { usePathname } from 'next/navigation';
import { CookieBanner } from '@/components/cookie-banner';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import type { Locale } from '@/lib/i18n';

/** Marketing pages that already ship their own header/footer (Landing V2). */
const SELF_CHROME_PATHS = new Set([
  '/',
  '/como-funciona',
  '/beneficios',
  '/para-quem-e',
  '/duvidas',
  '/v2',
  '/v2/como-funciona',
  '/v2/beneficios',
  '/v2/para-quem-e',
  '/v2/duvidas',
]);

function usesSelfChrome(pathname: string | null): boolean {
  if (!pathname) return false;
  return SELF_CHROME_PATHS.has(pathname);
}

export function PtSiteChrome({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (usesSelfChrome(pathname)) {
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
