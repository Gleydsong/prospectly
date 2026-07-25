const STRIPE_HOST = /^(?:[a-z0-9-]+\.)*stripe\.com$/i;
const ABACATE_HOST = /^(?:[a-z0-9-]+\.)*abacatepay\.com$/i;

function assignHttpsHostRedirect(url: string, hostPattern: RegExp, label: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid ${label} redirect URL`);
  }
  if (parsed.protocol !== 'https:' || !hostPattern.test(parsed.hostname)) {
    throw new Error(`Invalid ${label} redirect URL`);
  }
  window.location.assign(parsed.href);
}

/** Only allow https redirects to Stripe-owned hosts. */
export function assignStripeRedirect(url: string): void {
  assignHttpsHostRedirect(url, STRIPE_HOST, 'Stripe');
}

/** Only allow https redirects to AbacatePay-owned hosts. */
export function assignAbacateRedirect(url: string): void {
  assignHttpsHostRedirect(url, ABACATE_HOST, 'AbacatePay');
}

/** Route checkout redirect by provider. */
export function assignCheckoutRedirect(url: string, provider: 'STRIPE' | 'ABACATE'): void {
  if (provider === 'ABACATE') {
    assignAbacateRedirect(url);
    return;
  }
  assignStripeRedirect(url);
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
