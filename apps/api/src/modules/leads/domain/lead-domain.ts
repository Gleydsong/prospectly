const SCHEME = /^https?:\/\//i;

export function normalizeLeadDomain(input?: string | null): string | null {
  const raw = input?.trim();
  if (!raw) return null;
  try {
    const host = new URL(SCHEME.test(raw) ? raw : `https://${raw}`).hostname;
    return host.replace(/^www\./i, '').toLowerCase() || null;
  } catch {
    return null;
  }
}
