'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { List, X } from '@phosphor-icons/react';
import { BrandLogo } from '@/components/brand-logo';
import { CtaButton } from '@/components/ui/cta-button';
import { prefix, t, type Locale } from '@/lib/i18n';
import { enterExplainerUrl } from '@/lib/pricing';

const LIGHT_THEME_PATHS = new Set([
  '/',
  '/faq',
  '/pricing',
  '/entrar',
  '/en',
  '/en/faq',
  '/en/pricing',
  '/en/enter',
]);

export function SiteHeader({ locale }: { locale: Locale }) {
  const p = prefix(locale);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const isLightThemePage = pathname ? LIGHT_THEME_PATHS.has(pathname) : false;
  const isEnterPage = pathname === enterExplainerUrl(locale);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const close = () => setMenuOpen(false);

  return (
    <header
      className={[
        'sticky top-0 z-40 border-b border-[color:var(--border)] bg-[color:var(--bg)]/90 backdrop-blur-md',
        isLightThemePage ? 'site-chrome-light' : '',
        isEnterPage ? 'site-chrome-enter' : '',
      ].join(' ')}
    >
      <div className="mx-auto flex h-16 max-w-shell items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href={p || '/'}
          className="focus-ring rounded-control"
          onClick={close}
          aria-label={t(locale, 'brand')}
        >
          <BrandLogo locale={locale} priority />
        </Link>

        <nav className="hidden items-center gap-1 text-sm md:flex sm:gap-2">
          <CtaButton href={p || '/'} variant="ghost" size="sm" className="font-medium">
            {t(locale, 'navHome')}
          </CtaButton>
          <CtaButton href={`${p}/faq`} variant="ghost" size="sm" className="font-medium">
            {t(locale, 'navFaq')}
          </CtaButton>
          <CtaButton href={`${p}/pricing`} variant="ghost" size="sm" className="font-medium">
            {t(locale, 'navPricing')}
          </CtaButton>
          <CtaButton
            href={enterExplainerUrl(locale)}
            variant="ghost"
            size="sm"
            className="font-medium"
          >
            {t(locale, 'navLogin')}
          </CtaButton>
          <CtaButton href={enterExplainerUrl(locale)} variant="glass" size="sm" className="ml-1 font-medium">
            {t(locale, 'navCta')}
          </CtaButton>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <CtaButton href={enterExplainerUrl(locale)} variant="glass" size="sm" className="font-medium">
            {t(locale, 'navCta')}
          </CtaButton>
          <CtaButton
            type="button"
            variant="secondary"
            size="icon"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X weight="bold" className="h-5 w-5" /> : <List weight="bold" className="h-5 w-5" />}
          </CtaButton>
        </div>
      </div>

      {menuOpen ? (
        <div
          id="mobile-nav"
          className="border-t border-[color:var(--border)] bg-[color:var(--bg)] md:hidden"
        >
          <nav className="mx-auto flex max-w-shell flex-col gap-1 px-4 py-3 text-sm sm:px-6">
            <CtaButton
              href={p || '/'}
              variant="ghost"
              size="md"
              className="w-full justify-start font-medium"
              onClick={close}
            >
              {t(locale, 'navHome')}
            </CtaButton>
            <CtaButton
              href={`${p}/faq`}
              variant="ghost"
              size="md"
              className="w-full justify-start font-medium"
              onClick={close}
            >
              {t(locale, 'navFaq')}
            </CtaButton>
            <CtaButton
              href={`${p}/pricing`}
              variant="ghost"
              size="md"
              className="w-full justify-start font-medium"
              onClick={close}
            >
              {t(locale, 'navPricing')}
            </CtaButton>
            <CtaButton
              href={enterExplainerUrl(locale)}
              variant="ghost"
              size="md"
              className="w-full justify-start font-medium"
              onClick={close}
            >
              {t(locale, 'navLogin')}
            </CtaButton>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

export function SiteFooter({ locale }: { locale: Locale }) {
  const p = prefix(locale);
  const pathname = usePathname();
  const isLightThemePage = pathname ? LIGHT_THEME_PATHS.has(pathname) : false;
  const isEnterPage = pathname === enterExplainerUrl(locale);

  return (
    <footer className={['mt-16 border-t border-[color:var(--border)]', isLightThemePage ? 'site-chrome-light' : '', isEnterPage ? 'site-chrome-enter' : ''].join(' ')}>
      <div className="mx-auto flex max-w-shell flex-col items-center gap-6 px-4 py-10 text-center sm:px-6 lg:px-8">
        <div className="flex flex-col items-center">
          <BrandLogo locale={locale} />
          <p className="mt-2 max-w-sm text-sm text-[color:var(--ink-muted)]">
            {t(locale, 'footerTagline')}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <CtaButton href={`${p}/faq`} variant="ghost" size="sm" className="font-medium">
            {t(locale, 'footerFaq')}
          </CtaButton>
          <CtaButton href={`${p}/privacy`} variant="ghost" size="sm" className="font-medium">
            {t(locale, 'footerPrivacy')}
          </CtaButton>
          <CtaButton href={`${p}/terms`} variant="ghost" size="sm" className="font-medium">
            {t(locale, 'footerTerms')}
          </CtaButton>
          <CtaButton href={`${p}/cookies`} variant="ghost" size="sm" className="font-medium">
            {t(locale, 'footerCookies')}
          </CtaButton>
          <CtaButton
            href={locale === 'pt' ? '/en' : '/'}
            variant="secondary"
            size="sm"
            className="font-medium"
          >
            {locale === 'pt' ? 'EN' : 'PT'}
          </CtaButton>
        </div>
      </div>
      <div className="border-t border-[color:var(--border)]">
        <p className="mx-auto max-w-shell px-4 py-4 text-center text-xs text-[color:var(--ink-muted)] sm:px-6 lg:px-8">
          © {new Date().getFullYear()} Prospectly
        </p>
      </div>
    </footer>
  );
}
