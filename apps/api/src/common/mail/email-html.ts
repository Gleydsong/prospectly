const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').split('\0').join('').trim();
}

export function assertSafeRecipient(to: string): string {
  const normalized = sanitizeHeaderValue(to).toLowerCase();
  if (!EMAIL_PATTERN.test(normalized) || normalized.length > 254) {
    throw new Error('Invalid email recipient');
  }
  return normalized;
}

export function isSafeHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function publicOrigin(rawUrl: string | undefined, fallback: string): string {
  const candidate = (rawUrl ?? '').trim() || fallback;
  try {
    const origin = new URL(candidate).origin;
    if (/localhost|127\.0\.0\.1/i.test(origin)) {
      return fallback.replace(/\/$/, '');
    }
    return origin;
  } catch {
    return fallback.replace(/\/$/, '');
  }
}
