import { useEffect } from 'react';

import { setAppLocale } from '@/i18n';
import { isAppLocale } from '@/lib/locale';
import { useAuthStore } from '@/stores/auth.store';

/** Keeps i18n in sync with the authenticated user's persisted locale. */
export function LocaleSync() {
  const locale = useAuthStore((state) => state.user?.locale);

  useEffect(() => {
    if (locale && isAppLocale(locale)) {
      void setAppLocale(locale);
    }
  }, [locale]);

  return null;
}
