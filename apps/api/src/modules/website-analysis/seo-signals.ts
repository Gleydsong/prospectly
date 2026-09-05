import type { SeoImageSignals, SeoRenderingMode, SeoSignals, WebsiteAnalysisContext } from '@prospectly/shared-types';

/** Below this many visible characters a JS-driven page is treated as a CSR shell. */
export const CSR_SHELL_TEXT_THRESHOLD = 200;

export interface HtmlSeoExtraction {
  seo: SeoSignals;
  framework?: string;
}

function attr(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i'));
  if (!match) return undefined;
  return (match[1] ?? match[2] ?? match[3] ?? '').trim();
}

function hasAttr(tag: string, name: string): boolean {
  return new RegExp(`\\s${name}(?=[\\s>=/])`, 'i').test(tag);
}

function extractProperty(html: string, property: string): string | undefined {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Text a crawler would see without executing JS: strips head, scripts, styles and tags. */
export function extractVisibleText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<head[\s>][\s\S]*?<\/head>/gi, ' ')
    .replace(/<(script|style|noscript|template|svg)[\s>][\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectFramework(html: string): string | undefined {
  if (/\/_next\/|__NEXT_DATA__|id=["']__next["']/i.test(html)) return 'Next.js';
  if (/\/_nuxt\/|__NUXT__|id=["']__nuxt["']/i.test(html)) return 'Nuxt';
  if (/___gatsby/i.test(html)) return 'Gatsby';
  if (/\sng-version=/i.test(html)) return 'Angular';
  if (/\sdata-v-[0-9a-f]{6,}/i.test(html) || /vue(\.runtime)?(\.min)?\.js/i.test(html)) return 'Vue';
  if (/data-reactroot|\/static\/js\/main\.[0-9a-f]+\.js|react(-dom)?(\.production)?(\.min)?\.js/i.test(html)) {
    return 'React';
  }
  return undefined;
}

const EMPTY_MOUNT_RE =
  /<div[^>]+id=["'](root|app|__next|__nuxt|___gatsby|q-app|main|application)["'][^>]*>\s*(<noscript>[\s\S]*?<\/noscript>\s*)?<\/div>/i;
const BUNDLE_SCRIPT_RE =
  /<script[^>]+src=["'][^"']*(\/assets\/[^"']*\.js|\/static\/js\/|\/_next\/static|\/_nuxt\/|bundle[^"']*\.js|chunk[^"']*\.js|main\.[0-9a-f]{6,}\.js)/i;

export function detectRenderingMode(
  html: string,
  visibleTextLength: number,
  framework: string | undefined,
): SeoRenderingMode {
  if (!html.trim()) return 'UNKNOWN';
  const emptyMount = EMPTY_MOUNT_RE.test(html);
  const hasBundle = BUNDLE_SCRIPT_RE.test(html);
  if (visibleTextLength < CSR_SHELL_TEXT_THRESHOLD && (emptyMount || hasBundle)) return 'CSR';
  if (framework || hasBundle) return 'SSR';
  return 'STATIC';
}

export function extractJsonLdTypes(html: string): string[] {
  const types = new Set<string>();
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  const collect = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(collect);
      return;
    }
    const record = node as Record<string, unknown>;
    const type = record['@type'];
    if (typeof type === 'string') types.add(type);
    else if (Array.isArray(type)) type.forEach((t) => typeof t === 'string' && types.add(t));
    if (record['@graph']) collect(record['@graph']);
  };
  for (const block of blocks) {
    const raw = block[1]?.trim();
    if (!raw) continue;
    try {
      collect(JSON.parse(raw));
    } catch {
      // malformed JSON-LD: ignore this block
    }
  }
  return [...types];
}

export function extractImageSignals(html: string): SeoImageSignals {
  const signals: SeoImageSignals = { total: 0, missingDimensions: 0, modernFormat: 0, missingAlt: 0 };
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    signals.total += 1;
    if (!attr(tag, 'width') || !attr(tag, 'height')) signals.missingDimensions += 1;
    if (!hasAttr(tag, 'alt')) signals.missingAlt += 1;
    const src = `${attr(tag, 'src') ?? ''} ${attr(tag, 'srcset') ?? ''}`;
    if (/\.(webp|avif)(\?|\s|,|$)/i.test(src)) signals.modernFormat += 1;
  }
  const modernSources = html.match(/<source\b[^>]+type=["']image\/(webp|avif)["']/gi);
  if (modernSources) signals.modernFormat += modernSources.length;
  return signals;
}

function registrableHost(hostname: string): string {
  return hostname.replace(/^www\./i, '').toLowerCase();
}

export function extractThirdPartyScriptHosts(html: string, finalUrl: string, limit = 20): string[] {
  const base = registrableHost(new URL(finalUrl).hostname);
  const hosts = new Set<string>();
  for (const match of html.matchAll(/<script\b[^>]+src=["']([^"']+)["']/gi)) {
    const src = match[1];
    if (!src) continue;
    let host: string;
    try {
      host = new URL(src, finalUrl).hostname.toLowerCase();
    } catch {
      continue;
    }
    if (!host || host === base || host.endsWith(`.${base}`)) continue;
    hosts.add(host);
    if (hosts.size >= limit) break;
  }
  return [...hosts];
}

export function countRenderBlockingScripts(html: string): number {
  const head = html.match(/<head[\s>][\s\S]*?<\/head>/i)?.[0];
  if (!head) return 0;
  let count = 0;
  for (const match of head.matchAll(/<script\b[^>]*>/gi)) {
    const tag = match[0];
    if (!attr(tag, 'src')) continue;
    if (hasAttr(tag, 'async') || hasAttr(tag, 'defer')) continue;
    if (/type=["']module["']/i.test(tag)) continue;
    count += 1;
  }
  return count;
}

const CEP_RE = /\b\d{5}-\d{3}\b|\bCEP\s*:?\s*\d{5}-?\d{3}\b/i;
const STREET_RE =
  /\b(rua|r\.|avenida|av\.|alameda|al\.|travessa|tv\.|rodovia|rod\.|estrada|praca|pca\.|largo)\s+[a-z0-9\s.'-]{3,60}?,?\s*(n[oº°.]?\s*)?\d{1,5}\b/i;

export function detectAddress(visibleText: string): boolean {
  const normalized = normalizeText(visibleText);
  return CEP_RE.test(normalized) || STREET_RE.test(normalized);
}

export function parseSeoSignals(
  html: string,
  finalUrl: string,
  context?: WebsiteAnalysisContext,
  base?: { title?: string; metaDescription?: string },
): HtmlSeoExtraction {
  const visibleText = extractVisibleText(html);
  const framework = detectFramework(html);
  const renderingMode = detectRenderingMode(html, visibleText.length, framework);

  const canonicalTag = html.match(/<link\b[^>]+rel=["']canonical["'][^>]*>/i)?.[0];
  const canonicalUrl = canonicalTag ? attr(canonicalTag, 'href') || undefined : undefined;

  const robotsMeta = html.match(/<meta\b[^>]+name=["']robots["'][^>]*>/i)?.[0];
  const noindex = robotsMeta ? /noindex/i.test(attr(robotsMeta, 'content') ?? '') : false;

  const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;

  const city = context?.city?.trim();
  const mentionsCity = city ? normalizeText(visibleText).includes(normalizeText(city)) : undefined;

  const seo: SeoSignals = {
    renderingMode,
    visibleTextLength: visibleText.length,
    noindex,
    canonicalUrl,
    h1Count,
    titleLength: base?.title ? base.title.length : undefined,
    metaDescriptionLength: base?.metaDescription ? base.metaDescription.length : undefined,
    ogTitle: extractProperty(html, 'og:title'),
    ogImage: extractProperty(html, 'og:image'),
    jsonLdTypes: extractJsonLdTypes(html),
    hasMicrodata: /\sitemscope[\s>=]/i.test(html),
    images: extractImageSignals(html),
    thirdPartyScriptHosts: extractThirdPartyScriptHosts(html, finalUrl),
    renderBlockingScripts: countRenderBlockingScripts(html),
    hasAddress: detectAddress(visibleText),
    mentionsCity,
  };

  return { seo, framework };
}

/** `true` when a `User-agent: *` group contains a bare `Disallow: /`. */
export function robotsBlocksAll(robotsTxt: string): boolean {
  let inWildcardGroup = false;
  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const [key, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    const field = key?.trim().toLowerCase();
    if (field === 'user-agent') {
      inWildcardGroup = value === '*';
      continue;
    }
    if (inWildcardGroup && field === 'disallow' && value === '/') return true;
  }
  return false;
}

export function robotsDeclaresSitemap(robotsTxt: string): boolean {
  return /^\s*sitemap\s*:/im.test(robotsTxt);
}

export function looksLikeSitemap(body: string): boolean {
  return /<(urlset|sitemapindex)[\s>]/i.test(body);
}

/** `www.example.com` ⇄ `example.com`; `undefined` for IPs / single-label hosts. */
export function alternateHostname(hostname: string): string | undefined {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.includes(':')) return undefined;
  const labels = hostname.split('.');
  if (labels.length < 2) return undefined;
  return /^www\./i.test(hostname) ? hostname.replace(/^www\./i, '') : `www.${hostname}`;
}
