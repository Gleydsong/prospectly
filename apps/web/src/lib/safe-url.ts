const ABACATE_HOST = /^(?:[a-z0-9-]+\.)*abacatepay\.com$/i;
const ASAAS_HOST = /^(?:[a-z0-9-]+\.)*asaas\.com$/i;

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

/** Only allow https redirects to AbacatePay-owned hosts. */
export function assignAbacateRedirect(url: string): void {
  assignHttpsHostRedirect(url, ABACATE_HOST, 'AbacatePay');
}

/** Route checkout redirect by provider. */
export function assignCheckoutRedirect(url: string, provider: 'ABACATE' | 'ASAAS'): void {
  if (provider === 'ASAAS') {
    assignHttpsHostRedirect(url, ASAAS_HOST, 'Asaas');
    return;
  }
  assignAbacateRedirect(url);
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

const AVATAR_DATA_URL = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\s]+$/i;

/** Avatar src: https URL or jpeg/png/webp data URL. */
export function sanitizeAvatarSrc(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (AVATAR_DATA_URL.test(trimmed)) {
    return trimmed.replace(/\s/g, '');
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return null;
    return parsed.href;
  } catch {
    return null;
  }
}

/** mailto: only for emails without query/fragment injection. */
export function sanitizeMailtoHref(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim();
  if (!trimmed || /[?#&<>"'\\\s]/.test(trimmed)) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return `mailto:${trimmed}`;
}

const PIX_PNG_PREFIX = 'data:image/png;base64,';

/** PIX QR: only png data URLs (or raw base64 that we prefix). */
export function sanitizePixQrSrc(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(PIX_PNG_PREFIX)) {
    const payload = trimmed.slice(PIX_PNG_PREFIX.length).replace(/\s/g, '');
    if (!payload || /[^A-Za-z0-9+/=]/.test(payload)) return null;
    return `${PIX_PNG_PREFIX}${payload}`;
  }
  if (trimmed.startsWith('data:')) return null;
  const payload = trimmed.replace(/\s/g, '');
  if (!payload || /[^A-Za-z0-9+/=]/.test(payload)) return null;
  return `${PIX_PNG_PREFIX}${payload}`;
}
