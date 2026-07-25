import Link from 'next/link';
import { prefix, t, type Locale } from '@/lib/i18n';
import { appLoginUrl, appRegisterUrl } from '@/lib/pricing';

export function SiteHeader({ locale }: { locale: Locale }) {
  const p = prefix(locale);
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
      <Link href={p || '/'} className="text-xl font-semibold tracking-tight text-brand-900">
        {t(locale, 'brand')}
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        <Link href={`${p}/pricing`} className="text-slate-700 hover:text-brand-700">
          {t(locale, 'navPricing')}
        </Link>
        <a href={appLoginUrl()} className="text-slate-700 hover:text-brand-700">
          {t(locale, 'navLogin')}
        </a>
        <a
          href={appRegisterUrl('monthly', 'BRL')}
          className="rounded-md bg-brand-600 px-3 py-2 font-medium text-white hover:bg-brand-700"
        >
          {t(locale, 'navCta')}
        </a>
      </nav>
    </header>
  );
}

export function SiteFooter({ locale }: { locale: Locale }) {
  const p = prefix(locale);
  return (
    <footer className="mx-auto mt-24 w-full max-w-5xl border-t border-slate-200 px-6 py-10 text-sm text-slate-600">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p>© {new Date().getFullYear()} Prospectly</p>
        <div className="flex gap-4">
          <Link href={`${p}/privacy`}>{t(locale, 'footerPrivacy')}</Link>
          <Link href={`${p}/terms`}>{t(locale, 'footerTerms')}</Link>
          <Link href={`${p}/cookies`}>{t(locale, 'footerCookies')}</Link>
          <Link href={locale === 'pt' ? '/en' : '/'}>{locale === 'pt' ? 'EN' : 'PT'}</Link>
        </div>
      </div>
    </footer>
  );
}
