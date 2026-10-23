'use client';

import Link from 'next/link';
import { ArrowRight, List, X } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { V2Brand } from '@/components/landing-v2-brand';
import { canonicalFaqPath } from '@/lib/faq-routes';
import { t, type Locale } from '@/lib/i18n';
import { appOnboardingUrl, enterExplainerUrl } from '@/lib/pricing';

export function V2Header({
  locale = 'pt',
  page = 'home',
}: {
  locale: Locale;
  page?: 'home' | 'how' | 'section';
}) {
  const [open, setOpen] = useState(false);
  const isEn = locale === 'en';
  const onboardingUrl = appOnboardingUrl();
  const loginUrl = enterExplainerUrl(locale);
  const productUrl = isEn ? '/en#por-que' : '/#por-que';
  const howUrl = isEn ? '/en#como-funciona' : '/como-funciona';
  const benefitsUrl = isEn ? '/en#por-que' : '/beneficios';
  const faqUrl = canonicalFaqPath(locale);
  const pricingUrl = isEn ? '/en/pricing' : '/pricing';
  const privacyUrl = isEn ? '/en/privacy' : '/privacy';

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = '';
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-40 w-full transition-all duration-200">
      {/* Desktop & Mobile Header Bar com Vidro Fosco */}
      <div className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4">
        <div className="flex items-center justify-between px-5 py-3 sm:py-3.5 rounded-full backdrop-blur-2xl bg-white/75 dark:bg-tinta/80 border border-white/80 dark:border-white/15 shadow-[0_8px_32px_rgba(11,18,32,0.06)]">
          {/* Logo Prospectly */}
          <Link href={isEn ? '/en' : '/'} className="flex items-center gap-2" onClick={close}>
            <V2Brand />
          </Link>

          {/* Navegação Desktop */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-grafite dark:text-zinc-300" aria-label={t(locale, 'navMainAriaLabel')}>
            <Link href={benefitsUrl} className="hover:text-azul-prospectly dark:hover:text-white transition-colors">
              {t(locale, 'navBenefits')}
            </Link>
            <Link href={howUrl} aria-current={page === 'how' ? 'page' : undefined} className="hover:text-azul-prospectly dark:hover:text-white transition-colors">
              {t(locale, 'navHowItWorks')}
            </Link>
            <Link href={pricingUrl} className="hover:text-azul-prospectly dark:hover:text-white transition-colors">
              {t(locale, 'navPricing')}
            </Link>
            <Link href={privacyUrl} className="hover:text-azul-prospectly dark:hover:text-white transition-colors">
              {t(locale, 'navLgpd')}
            </Link>
            <Link href={faqUrl} className="hover:text-azul-prospectly dark:hover:text-white transition-colors">
              {t(locale, 'navFaq')}
            </Link>
          </nav>

          {/* Ações: Entrar + Começar grátis (Desktop) */}
          <div className="flex items-center gap-4">
            <Link
              href={loginUrl}
              className="hidden sm:inline-flex text-sm font-medium text-grafite dark:text-zinc-300 hover:text-azul-prospectly dark:hover:text-white transition-colors"
            >
              {t(locale, 'navLogin')}
            </Link>

            <a
              href={onboardingUrl}
              className="hidden sm:inline-flex items-center justify-center gap-2 px-5 py-2 sm:py-2.5 rounded-full bg-tinta dark:bg-white text-white dark:text-tinta text-xs sm:text-sm font-semibold hover:bg-grafite dark:hover:bg-zinc-200 transition-all shadow-sm"
            >
              <span>{t(locale, 'navCtaStartFree')}</span>
              <ArrowRight weight="bold" className="w-3.5 h-3.5" aria-hidden />
            </a>

            {/* Botão de Menu Mobile */}
            <button
              type="button"
              className="md:hidden w-9 h-9 rounded-full flex items-center justify-center bg-tinta dark:bg-white/10 text-white hover:bg-grafite transition-colors"
              aria-expanded={open}
              aria-controls="landing-v2-mobile-nav"
              aria-label={open ? t(locale, 'navCloseMenu') : t(locale, 'navOpenMenu')}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X weight="bold" className="w-4 h-4" aria-hidden /> : <List weight="bold" className="w-4 h-4" aria-hidden />}
            </button>
          </div>
        </div>
      </div>

      {/* Navegação Mobile Overlay */}
      {open ? (
        <nav
          id="landing-v2-mobile-nav"
          className="md:hidden fixed inset-x-4 top-20 z-50 p-6 rounded-[24px] backdrop-blur-3xl bg-white/95 dark:bg-tinta/95 border border-white/80 dark:border-white/15 shadow-[0_20px_60px_rgba(11,18,32,0.25)] flex flex-col gap-4 animate-fade-rise"
          aria-label={t(locale, 'navMobileAriaLabel')}
        >
          <Link
            href={productUrl}
            onClick={close}
            className="text-base font-semibold text-tinta dark:text-white py-2 border-b border-linha/50 dark:border-white/10"
          >
            {t(locale, 'navProduct')}
          </Link>
          <Link
            href={howUrl}
            onClick={close}
            className="text-base font-semibold text-tinta dark:text-white py-2 border-b border-linha/50 dark:border-white/10"
          >
            {t(locale, 'navHowItWorks')}
          </Link>
          <Link
            href={pricingUrl}
            onClick={close}
            className="text-base font-semibold text-tinta dark:text-white py-2 border-b border-linha/50 dark:border-white/10"
          >
            {t(locale, 'navPricing')}
          </Link>
          <Link
            href={privacyUrl}
            onClick={close}
            className="text-base font-semibold text-tinta dark:text-white py-2 border-b border-linha/50 dark:border-white/10"
          >
            {t(locale, 'navLgpd')}
          </Link>
          <Link
            href={faqUrl}
            onClick={close}
            className="text-base font-semibold text-tinta dark:text-white py-2 border-b border-linha/50 dark:border-white/10"
          >
            {t(locale, 'navFaq')}
          </Link>

          <div className="pt-2 flex flex-col gap-3">
            <Link
              href={loginUrl}
              onClick={close}
              className="w-full py-3 rounded-full text-center border border-linha dark:border-white/20 font-semibold text-sm text-tinta dark:text-white"
            >
              {t(locale, 'navLogin')}
            </Link>
            <a
              href={onboardingUrl}
              onClick={close}
              className="w-full py-3 rounded-full text-center bg-azul-prospectly font-semibold text-sm text-white shadow-md"
            >
              {t(locale, 'navCtaStartFree')}
            </a>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
