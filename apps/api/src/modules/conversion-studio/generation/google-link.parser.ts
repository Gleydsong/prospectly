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
const MAX_SHORT_LINK_REDIRECTS = 4;

export function isAllowedGoogleMapsUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    if (url.username || url.password) return false;
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

/**
 * Expand Google short links without following redirects to non-Google / private hosts.
 * Uses redirect:manual so each hop can be allowlisted (SSRF-safe).
 */
export async function expandGoogleShortLink(
  rawUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  if (!isAllowedGoogleMapsUrl(rawUrl)) {
    throw new Error('URL must be a Google Maps / Business link');
  }

  const host = new URL(rawUrl).hostname.toLowerCase();
  if (!['maps.app.goo.gl', 'goo.gl', 'g.page'].includes(host)) {
    return rawUrl;
  }

  let currentUrl = rawUrl.trim();
  const visited = new Set<string>();

  for (let hop = 0; hop <= MAX_SHORT_LINK_REDIRECTS; hop++) {
    if (visited.has(currentUrl)) {
      throw new Error('Google short link redirect loop');
    }
    visited.add(currentUrl);

    if (!isAllowedGoogleMapsUrl(currentUrl)) {
      throw new Error('Google short link redirected outside allowlisted hosts');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetchImpl(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'user-agent': 'Prospectly/1.0' },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw new Error('Google short link redirect missing Location');
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      // Final non-redirect response — prefer response.url when present, else last hop.
      const finalUrl = response.url || currentUrl;
      if (!isAllowedGoogleMapsUrl(finalUrl)) {
        throw new Error('Google short link resolved outside allowlisted hosts');
      }
      return finalUrl;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error('Too many redirects expanding Google short link');
}
