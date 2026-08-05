'use client';

import { useEffect, useState } from 'react';
import { CtaButton } from '@/components/ui/cta-button';
import { t, type Locale } from '@/lib/i18n';

const KEY = 'prospectly_cookie_consent';

export function CookieBanner({ locale }: { locale: Locale }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(KEY)) setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[color:var(--border)] bg-[color:var(--bg-raised)]/95 p-4 shadow-soft backdrop-blur-md">
      <div className="mx-auto flex max-w-shell flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-[color:var(--ink)]">{t(locale, 'cookieTitle')}</p>
          <p className="mt-1 text-sm text-[color:var(--ink-muted)]">{t(locale, 'cookieBody')}</p>
        </div>
        <CtaButton
          type="button"
          size="md"
          className="shrink-0"
          onClick={() => {
            localStorage.setItem(KEY, 'essential');
            setVisible(false);
          }}
        >
          {t(locale, 'cookieAccept')}
        </CtaButton>
      </div>
    </div>
  );
}
