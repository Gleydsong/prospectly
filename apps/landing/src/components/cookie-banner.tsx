'use client';

import { useEffect, useRef, useState } from 'react';

import { CtaButton } from '@/components/ui/cta-button';
import {
  COOKIE_CONSENT_KEY,
  parseCookieConsent,
  writeEssentialConsent,
} from '@/lib/cookie-consent';
import { t, type Locale } from '@/lib/i18n';

export function CookieBanner({ locale }: { locale: Locale }) {
  const [visible, setVisible] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cookiesHref = locale === 'en' ? '/en/cookies' : '/cookies';

  useEffect(() => {
    if (!parseCookieConsent(localStorage.getItem(COOKIE_CONSENT_KEY))) {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !visible) return;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('[data-cookie-accept]')?.focus();
  }, [visible]);

  if (!visible) return null;

  const persist = () => {
    writeEssentialConsent();
    dialogRef.current?.close();
    setVisible(false);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="cookie-banner-title"
      aria-modal="true"
      className="cookie-banner-dialog"
      onCancel={(event) => {
        event.preventDefault();
        persist();
      }}
    >
      <div className="mx-auto flex max-w-shell flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p id="cookie-banner-title" className="font-medium text-[color:var(--ink)]">
            {t(locale, 'cookieTitle')}
          </p>
          <p className="mt-1 text-sm text-[color:var(--ink-muted)]">{t(locale, 'cookieBody')}</p>
          <a
            href={cookiesHref}
            className="mt-2 inline-block text-sm underline underline-offset-2 text-[color:var(--ink-muted)]"
          >
            {t(locale, 'cookiePolicy')}
          </a>
        </div>
        <CtaButton
          type="button"
          size="md"
          className="shrink-0"
          data-cookie-accept
          onClick={persist}
        >
          {t(locale, 'cookieAccept')}
        </CtaButton>
      </div>
    </dialog>
  );
}
