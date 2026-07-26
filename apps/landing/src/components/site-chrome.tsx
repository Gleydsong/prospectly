'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { List, X } from '@phosphor-icons/react';
import { BrandLogo } from '@/components/brand-logo';
import { prefix, t, type Locale } from '@/lib/i18n';
import { appLoginUrl, appRegisterUrl } from '@/lib/pricing';

export function SiteHeader({ locale }: { locale: Locale }) {
  const p = prefix(locale);
  const defaultCurrency = locale === 'pt' ? 'BRL' : 'EUR';
  const [menuOpen, setMenuOpen] = useState(false);

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
    <header className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-[color:var(--bg)]/90 backdrop-blur-md">
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
          <Link
            href={p || '/'}
            className="focus-ring rounded-control px-3 py-2 text-[color:var(--ink-muted)] transition-colors hover:text-[color:var(--ink)]"
          >
            {t(locale, 'navHome')}
          </Link>
          <Link
            href={`${p}/faq`}
            className="focus-ring rounded-control px-3 py-2 text-[color:var(--ink-muted)] transition-colors hover:text-[color:var(--ink)]"
          >
            {t(locale, 'navFaq')}
          </Link>
          <Link
            href={`${p}/pricing`}
            className="focus-ring rounded-control px-3 py-2 text-[color:var(--ink-muted)] transition-colors hover:text-[color:var(--ink)]"
          >
            {t(locale, 'navPricing')}
          </Link>
          <a
            href={appLoginUrl()}
            className="focus-ring rounded-control px-3 py-2 text-[color:var(--ink-muted)] transition-colors hover:text-[color:var(--ink)]"
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

        <div className="flex items-center gap-2 md:hidden">
          <a
            href={appRegisterUrl('monthly', defaultCurrency)}
            className="focus-ring rounded-control bg-accent px-3 py-2 text-sm font-medium text-white dark:text-accent-ink"
          >
            {t(locale, 'navCta')}
          </a>
          <button
            type="button"
            className="focus-ring inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-[color:var(--ink)]"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X weight="bold" className="h-5 w-5" /> : <List weight="bold" className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div
          id="mobile-nav"
          className="border-t border-[color:var(--border)] bg-[color:var(--bg)] md:hidden"
        >
          <nav className="mx-auto flex max-w-shell flex-col gap-1 px-4 py-3 text-sm sm:px-6">
            <Link
              href={p || '/'}
              onClick={close}
              className="focus-ring rounded-control px-3 py-3 text-[color:var(--ink)]"
            >
              {t(locale, 'navHome')}
            </Link>
            <Link
              href={`${p}/faq`}
              onClick={close}
              className="focus-ring rounded-control px-3 py-3 text-[color:var(--ink)]"
            >
              {t(locale, 'navFaq')}
            </Link>
            <Link
              href={`${p}/pricing`}
              onClick={close}
              className="focus-ring rounded-control px-3 py-3 text-[color:var(--ink)]"
            >
              {t(locale, 'navPricing')}
            </Link>
            <a
              href={appLoginUrl()}
              onClick={close}
              className="focus-ring rounded-control px-3 py-3 text-[color:var(--ink)]"
            >
              {t(locale, 'navLogin')}
            </a>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

export function SiteFooter({ locale }: { locale: Locale }) {
  const p = prefix(locale);

  return (
    <footer className="mt-16 border-t border-[color:var(--border)]">
      <div className="mx-auto flex max-w-shell flex-col gap-6 px-4 py-10 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        <div>
          <BrandLogo locale={locale} />
          <p className="mt-2 max-w-sm text-sm text-[color:var(--ink-muted)]">
            {t(locale, 'footerTagline')}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[color:var(--ink-muted)]">
          <Link className="focus-ring hover:text-[color:var(--ink)]" href={`${p}/faq`}>
            {t(locale, 'footerFaq')}
          </Link>
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
