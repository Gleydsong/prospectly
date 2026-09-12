export const COOKIE_CONSENT_KEY = 'prospectly_cookie_consent';
export const CONSENT_VERSION = '2026-08-17';

export type CookieConsent = {
  essential: true;
  analytics: false;
  version: string;
  ts: string;
};

export function serializeEssentialConsent(ts: string): string {
  const value: CookieConsent = {
    essential: true,
    analytics: false,
    version: CONSENT_VERSION,
    ts,
  };
  return JSON.stringify(value);
}

export function parseCookieConsent(raw: string | null): CookieConsent | null {
  if (!raw) return null;
  if (raw === 'essential') {
    return {
      essential: true,
      analytics: false,
      version: CONSENT_VERSION,
      ts: new Date().toISOString(),
    };
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

export function writeEssentialConsent(
  storage: Pick<Storage, 'setItem'> = localStorage,
  now = () => new Date().toISOString(),
): CookieConsent {
  const raw = serializeEssentialConsent(now());
  storage.setItem(COOKIE_CONSENT_KEY, raw);
  return JSON.parse(raw) as CookieConsent;
}
