export function normalizeLeadWebsiteUrl(raw: string): string {
  const parsed = new URL(raw.trim());
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('invalid_url');
  }
  parsed.hash = '';
  const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
  return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}${parsed.search}`;
}
