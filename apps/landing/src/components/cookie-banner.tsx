'use client';

import { useEffect, useState } from 'react';
import { CtaButton } from '@/components/ui/cta-button';
import { t, type Locale } from '@/lib/i18n';

const KEY = 'prospectly_cookie_consent';
const CONSENT_VERSION = '2026-08-17';

type CookieConsent = {
  essential: true;
  analytics: false;
  version: string;
  ts: string;
};

function readConsent(): CookieConsent | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  if (raw === 'essential') {
    return { essential: true, analytics: false, version: CONSENT_VERSION, ts: new Date().toISOString() };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<CookieConsent>;
    if (parsed.essential === true) {
      return {
        essential: true,
        analytics: false,
        version: parsed.version ?? CONSENT_VERSION,
        ts: parsed.ts ?? new Date().toISOString(),
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function CookieBanner({ locale }: { locale: Locale }) {
  const [visible, setVisible] = useState(false);
  const cookiesHref = locale === 'en' ? '/en/cookies' : '/cookies';

  useEffect(() => {
    if (!readConsent()) setVisible(true);
  }, []);

  if (!visible) return null;

  const persist = () => {
    const value: CookieConsent = {
      essential: true,
      analytics: false,
      version: CONSENT_VERSION,
      ts: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(value));
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[color:var(--border)] bg-[color:var(--bg-raised)]/95 p-4 shadow-soft backdrop-blur-md">
      <div className="mx-auto flex max-w-shell flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-[color:var(--ink)]">{t(locale, 'cookieTitle')}</p>
          <p className="mt-1 text-sm text-[color:var(--ink-muted)]">{t(locale, 'cookieBody')}</p>
          <a
            href={cookiesHref}
            className="mt-2 inline-block text-sm underline underline-offset-2 text-[color:var(--ink-muted)]"
          >
            {t(locale, 'cookiePolicy')}
          </a>
        </div>
        <CtaButton type="button" size="md" className="shrink-0" onClick={persist}>
          {t(locale, 'cookieAccept')}
        </CtaButton>
      </div>
    </div>
  );
}
