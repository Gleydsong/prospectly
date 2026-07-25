import Link from 'next/link';
import { prefix, t, type Locale } from '@/lib/i18n';
import { appLoginUrl, appRegisterUrl } from '@/lib/pricing';

export function SiteHeader({ locale }: { locale: Locale }) {
  const p = prefix(locale);
  const defaultCurrency = locale === 'pt' ? 'BRL' : 'EUR';

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-[color:var(--bg)]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-shell items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href={p || '/'}
          className="focus-ring text-lg font-semibold tracking-tight text-[color:var(--ink)]"
        >
          {t(locale, 'brand')}
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-2">
          <Link
            href={`${p}/pricing`}
            className="focus-ring rounded-control px-3 py-2 text-[color:var(--ink-muted)] transition-colors hover:text-[color:var(--ink)]"
          >
            {t(locale, 'navPricing')}
          </Link>
          <a
            href={appLoginUrl()}
            className="focus-ring hidden rounded-control px-3 py-2 text-[color:var(--ink-muted)] transition-colors hover:text-[color:var(--ink)] sm:inline"
          >
            {t(locale, 'navLogin')}
          </a>
          <a
            href={appRegisterUrl('monthly', defaultCurrency)}
            className="focus-ring ml-1 rounded-control bg-accent px-3.5 py-2 font-medium text-white transition-transform hover:bg-accent-hover active:scale-[0.98] dark:text-accent-ink"
          >
            {t(locale, 'navCta')}
          </a>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({ locale }: { locale: Locale }) {
  const p = prefix(locale);

  return (
    <footer className="mt-24 border-t border-[color:var(--border)]">
      <div className="mx-auto flex max-w-shell flex-col gap-6 px-4 py-12 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        <div>
          <p className="text-lg font-semibold tracking-tight">{t(locale, 'brand')}</p>
          <p className="mt-2 max-w-sm text-sm text-[color:var(--ink-muted)]">
            {t(locale, 'footerTagline')}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[color:var(--ink-muted)]">
          <Link className="focus-ring hover:text-[color:var(--ink)]" href={`${p}/privacy`}>
            {t(locale, 'footerPrivacy')}
          </Link>
          <Link className="focus-ring hover:text-[color:var(--ink)]" href={`${p}/terms`}>
            {t(locale, 'footerTerms')}
          </Link>
          <Link className="focus-ring hover:text-[color:var(--ink)]" href={`${p}/cookies`}>
            {t(locale, 'footerCookies')}
          </Link>
          <Link className="focus-ring hover:text-[color:var(--ink)]" href={locale === 'pt' ? '/en' : '/'}>
            {locale === 'pt' ? 'EN' : 'PT'}
          </Link>
        </div>
      </div>
      <div className="border-t border-[color:var(--border)]">
        <p className="mx-auto max-w-shell px-4 py-4 text-xs text-[color:var(--ink-muted)] sm:px-6 lg:px-8">
          © {new Date().getFullYear()} Prospectly
        </p>
      </div>
    </footer>
  );
}
