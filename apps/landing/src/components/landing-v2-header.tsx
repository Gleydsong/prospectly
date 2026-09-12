'use client';

import Link from 'next/link';
import { ArrowRight, List, X } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { V2Brand } from '@/components/landing-v2-brand';
import { canonicalFaqPath } from '@/lib/faq-routes';
import type { Locale } from '@/lib/i18n';
import { appOnboardingUrl } from '@/lib/pricing';

export function V2Header({ locale, page = 'home' }: { locale: Locale; page?: 'home' | 'how' | 'section' }) {
  const [open, setOpen] = useState(false);
  const onboardingUrl = appOnboardingUrl();
  const howUrl = '/como-funciona';
  const benefitsUrl = '/beneficios';
  const audienceUrl = '/para-quem-e';
  const faqUrl = canonicalFaqPath(locale);

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
    <header className="landing-v2-header" data-page={page}>
      <div className="landing-v2-shell landing-v2-header-inner">
        <Link href="/" className="landing-v2-brand-link" onClick={close}>
          <V2Brand />
        </Link>
        <nav className="landing-v2-desktop-nav" aria-label="Navegação principal">
          <Link href={howUrl} aria-current={page === 'how' ? 'page' : undefined}>
            Como funciona
          </Link>
          <a href={benefitsUrl}>Benefícios</a>
          <a href={audienceUrl}>Para quem é</a>
          <a href={faqUrl}>Dúvidas frequentes</a>
        </nav>
        <div className="landing-v2-header-actions">
          <a href={onboardingUrl} className="landing-v2-dark-button landing-v2-header-cta">
            Começar agora <ArrowRight weight="bold" aria-hidden />
          </a>
          <button
            type="button"
            className="landing-v2-menu-button"
            aria-expanded={open}
            aria-controls="landing-v2-mobile-nav"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X weight="bold" aria-hidden /> : <List weight="bold" aria-hidden />}
          </button>
        </div>
      </div>
      {open ? (
        <nav id="landing-v2-mobile-nav" className="landing-v2-mobile-nav" aria-label="Navegação móvel">
          <Link href={howUrl} onClick={close}>
            Como funciona
          </Link>
          <a href={benefitsUrl} onClick={close}>
            Benefícios
          </a>
          <a href={audienceUrl} onClick={close}>
            Para quem é
          </a>
          <a href={faqUrl} onClick={close}>
            Dúvidas frequentes
          </a>
        </nav>
      ) : null}
    </header>
  );
}
