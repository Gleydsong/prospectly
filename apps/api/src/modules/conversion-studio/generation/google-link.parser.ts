export type ParsedGoogleMapsLink = {
  rawUrl: string;
  placeId?: string;
  query?: string;
  placeName?: string;
  latitude?: number;
  longitude?: number;
};

const PLACE_ID_RE = /(?:place_id|ftid)=([A-Za-z0-9_-]+)/i;
const CHIJ_RE = /\b(ChIJ[A-Za-z0-9_-]+)\b/;
const PLACE_PATH_RE = /\/maps\/place\/([^/@]+)/i;
const AT_COORDS_RE = /@(-?\d+\.?\d*),(-?\d+\.?\d*)/;
const Q_RE = /[?&](?:q|query)=([^&]+)/i;

export function isAllowedGoogleMapsUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    return (
      host === 'maps.google.com' ||
      host.endsWith('.google.com') ||
      host === 'maps.app.goo.gl' ||
      host === 'goo.gl' ||
      host === 'g.page'
    );
  } catch {
    return false;
  }
}

export function parseGoogleMapsLink(raw: string): ParsedGoogleMapsLink {
  const trimmed = raw.trim();
  if (!isAllowedGoogleMapsUrl(trimmed)) {
    throw new Error('URL must be a Google Maps / Business link');
  }

  const url = new URL(trimmed);
  const href = url.href;
  const placeId =
    PLACE_ID_RE.exec(href)?.[1] ??
    CHIJ_RE.exec(href)?.[1] ??
    undefined;

  const placePath = PLACE_PATH_RE.exec(url.pathname)?.[1];
  const placeName = placePath
    ? decodeURIComponent(placePath.replace(/\+/g, ' ')).replace(/!.*$/, '').trim()
    : undefined;

  const qMatch = Q_RE.exec(href)?.[1];
  const query = qMatch
    ? decodeURIComponent(qMatch.replace(/\+/g, ' ')).trim()
    : placeName;

  const coords = AT_COORDS_RE.exec(href);
  const latitude = coords ? Number(coords[1]) : undefined;
  const longitude = coords ? Number(coords[2]) : undefined;

  return {
    rawUrl: trimmed,
    placeId,
    query: query || undefined,
    placeName: placeName || undefined,
    latitude: Number.isFinite(latitude) ? latitude : undefined,
    longitude: Number.isFinite(longitude) ? longitude : undefined,
  };
}

export async function expandGoogleShortLink(
  rawUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const host = new URL(rawUrl).hostname.toLowerCase();
  if (!['maps.app.goo.gl', 'goo.gl', 'g.page'].includes(host)) {
    return rawUrl;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetchImpl(rawUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'Prospectly/1.0' },
    });
    return response.url || rawUrl;
  } finally {
    clearTimeout(timer);
  }
}
