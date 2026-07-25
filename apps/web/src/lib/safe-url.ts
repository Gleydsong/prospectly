const STRIPE_HOST = /^(?:[a-z0-9-]+\.)*stripe\.com$/i;

/** Only allow https redirects to Stripe-owned hosts. */
export function assignStripeRedirect(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid Stripe redirect URL');
  }
  if (parsed.protocol !== 'https:' || !STRIPE_HOST.test(parsed.hostname)) {
    throw new Error('Invalid Stripe redirect URL');
  }
  window.location.assign(parsed.href);
}

/** Only allow same-origin relative paths (blocks open redirects). */
export function resolveInternalRedirect(from: unknown, fallback = '/'): string {
  if (typeof from !== 'string') return fallback;
  if (!from.startsWith('/') || from.startsWith('//') || from.includes('\\')) {
    return fallback;
  }
  return from;
}

/** Safe http(s) href for user-supplied websites; rejects javascript:/data: etc. */
export function sanitizeExternalUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(href);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.href;
  } catch {
    return null;
  }
}
