'use client';

import { useEffect, useState } from 'react';
import { t, type Locale } from '@/lib/i18n';

const KEY = 'prospectly_cookie_consent';

export function CookieBanner({ locale }: { locale: Locale }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem(KEY)) setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-slate-900">{t(locale, 'cookieTitle')}</p>
          <p className="text-sm text-slate-600">{t(locale, 'cookieBody')}</p>
        </div>
        <button
          type="button"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          onClick={() => {
            localStorage.setItem(KEY, 'essential');
            setVisible(false);
          }}
        >
          {t(locale, 'cookieAccept')}
        </button>
      </div>
    </div>
  );
}
