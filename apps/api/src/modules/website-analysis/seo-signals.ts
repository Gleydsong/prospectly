import type { SeoImageSignals, SeoRenderingMode, SeoSignals, WebsiteAnalysisContext } from '@prospectly/shared-types';

/** Below this many visible characters a JS-driven page is treated as a CSR shell. */
export const CSR_SHELL_TEXT_THRESHOLD = 200;

export interface HtmlSeoExtraction {
  seo: SeoSignals;
  framework?: string;
}

/** Max chars scanned inside a single tag. Bounds every tag regex so hostile HTML stays linear. */
const MAX_TAG_LENGTH = 2048;

function attr(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i'));
  if (!match) return undefined;
  return (match[1] ?? match[2] ?? match[3] ?? '').trim();
}

function hasAttr(tag: string, name: string): boolean {
  return new RegExp(`\\s${name}(?=[\\s>=/])`, 'i').test(tag);
}

function isNameBoundary(char: string | undefined): boolean {
  return char === undefined || char === ' ' || char === '/' || char === '>' || char === '\n' || char === '\t' || char === '\r';
}

/** Linear scan for opening tags `<name ...>` (void elements: no closer lookup). */
export function extractTags(html: string, name: string): string[] {
  const lower = html.toLowerCase();
  const open = `<${name}`;
  const tags: string[] = [];
  let cursor = 0;
  for (;;) {
    const start = lower.indexOf(open, cursor);
    if (start === -1) break;
    const afterName = start + open.length;
    if (!isNameBoundary(lower[afterName])) {
      cursor = afterName;
      continue;
    }
    const tagEnd = lower.indexOf('>', afterName);
    if (tagEnd === -1) break;
    if (tagEnd - start <= MAX_TAG_LENGTH) tags.push(html.slice(start, tagEnd + 1));
    cursor = tagEnd + 1;
  }
  return tags;
}

function extractProperty(html: string, property: string): string | undefined {
  const needle = property.toLowerCase();
  for (const tag of extractTags(html, 'meta')) {
    if (attr(tag, 'property')?.toLowerCase() !== needle) continue;
    const content = attr(tag, 'content');
    if (content) return content;
  }
  return undefined;
}

interface HtmlElement {
  /** Opening tag, e.g. `<script src="x">`. */
  tag: string;
  /** Raw inner HTML up to the closing tag (empty when unclosed/self-closing). */
  inner: string;
}

/**
 * Linear scan for `<name ...>inner</name>` elements using indexOf — no
 * backtracking regardless of how many unclosed openers hostile HTML contains.
 */
export function extractElements(html: string, name: string): HtmlElement[] {
  const lower = html.toLowerCase();
  const open = `<${name}`;
  const close = `</${name}`;
  const elements: HtmlElement[] = [];
  let cursor = 0;
  let noMoreClosers = false;
  for (;;) {
    const start = lower.indexOf(open, cursor);
    if (start === -1) break;
    const afterName = start + open.length;
    if (!isNameBoundary(lower[afterName])) {
      cursor = afterName;
      continue;
    }
    const tagEnd = lower.indexOf('>', afterName);
    if (tagEnd === -1) break;
    if (tagEnd - start > MAX_TAG_LENGTH) {
      cursor = tagEnd + 1;
      continue;
    }
    const tag = html.slice(start, tagEnd + 1);
    const closeStart = noMoreClosers ? -1 : lower.indexOf(close, tagEnd + 1);
    if (closeStart === -1) {
      noMoreClosers = true;
      elements.push({ tag, inner: '' });
      cursor = tagEnd + 1;
      continue;
    }
    const closeEnd = lower.indexOf('>', closeStart);
    elements.push({ tag, inner: html.slice(tagEnd + 1, closeStart) });
    cursor = closeEnd === -1 ? closeStart + close.length : closeEnd + 1;
  }
  return elements;
}

/** Removes `<name ...>...</name>` blocks (and unclosed openers to EOF) in linear time. */
function stripElements(html: string, name: string): string {
  const lower = html.toLowerCase();
  const open = `<${name}`;
  const close = `</${name}`;
  let out = '';
  let cursor = 0;
  for (;;) {
    const start = lower.indexOf(open, cursor);
    if (start === -1) break;
    if (!isNameBoundary(lower[start + open.length])) {
      out += html.slice(cursor, start + open.length);
      cursor = start + open.length;
      continue;
    }
    out += html.slice(cursor, start);
    const closeStart = lower.indexOf(close, start);
    if (closeStart === -1) return `${out} `;
    const closeEnd = lower.indexOf('>', closeStart);
    cursor = closeEnd === -1 ? html.length : closeEnd + 1;
    out += ' ';
  }
  return out + html.slice(cursor);
}

function stripComments(html: string): string {
  let out = '';
  let cursor = 0;
  for (;;) {
    const start = html.indexOf('<!--', cursor);
    if (start === -1) break;
    out += html.slice(cursor, start);
    const end = html.indexOf('-->', start + 4);
    if (end === -1) return `${out} `;
    cursor = end + 3;
    out += ' ';
  }
  return out + html.slice(cursor);
}

/** Removes every `<...>` tag (max MAX_TAG_LENGTH chars) in linear time; stray `<` is kept as text. */
function stripTags(html: string): string {
  let out = '';
  let cursor = 0;
  for (;;) {
    const start = html.indexOf('<', cursor);
    if (start === -1) break;
    const end = html.indexOf('>', start + 1);
    if (end === -1) break;
    if (end - start > MAX_TAG_LENGTH) {
      out += html.slice(cursor, start + 1);
      cursor = start + 1;
      continue;
    }
    out += `${html.slice(cursor, start)} `;
    cursor = end + 1;
  }
  return out + html.slice(cursor);
}

function headSection(html: string): string | undefined {
  return extractElements(html, 'head')[0]?.inner;
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Text a crawler would see without executing JS: strips head, scripts, styles and tags. */
export function extractVisibleText(html: string): string {
  let text = stripComments(html);
  for (const name of ['head', 'script', 'style', 'noscript', 'template', 'svg']) {
    text = stripElements(text, name);
  }
  return stripTags(text)
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

const MOUNT_IDS = new Set(['root', 'app', '__next', '__nuxt', '___gatsby', 'q-app', 'main', 'application']);
const MOUNT_ELEMENTS = ['div', 'main', 'app-root', 'app'];
const BUNDLE_SRC_RE =
  /(\/assets\/[^"']*\.js|\/static\/js\/|\/_next\/static|\/_nuxt\/|bundle[^"']*\.js|chunk[^"']*\.js|main\.[0-9a-f]{6,}\.js)/i;

/** `<div id="root"></div>` / `<app-root></app-root>`: a JS mount point with no server-rendered children. */
export function hasEmptyMount(html: string): boolean {
  for (const name of MOUNT_ELEMENTS) {
    for (const element of extractElements(html, name)) {
      const id = attr(element.tag, 'id')?.toLowerCase();
      const isMountElement = name === 'app-root' || (id !== undefined && MOUNT_IDS.has(id));
      if (!isMountElement) continue;
      const inner = stripElements(stripComments(element.inner), 'noscript').trim();
      if (inner === '') return true;
    }
  }
  return false;
}

function hasBundleScript(html: string): boolean {
  return extractElements(html, 'script').some((el) => BUNDLE_SRC_RE.test(attr(el.tag, 'src') ?? ''));
}

export function detectRenderingMode(
  html: string,
  visibleTextLength: number,
  framework: string | undefined,
): SeoRenderingMode {
  if (!html.trim()) return 'UNKNOWN';
  if (visibleTextLength < CSR_SHELL_TEXT_THRESHOLD && hasEmptyMount(html)) return 'CSR';
  if (framework || hasBundleScript(html)) return 'SSR';
  return 'STATIC';
}

export function extractJsonLdTypes(html: string): string[] {
  const types = new Set<string>();
  const blocks = extractElements(html, 'script').filter(
    (el) => attr(el.tag, 'type')?.toLowerCase() === 'application/ld+json',
  );
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
    const raw = block.inner.trim();
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
  for (const tag of extractTags(html, 'img')) {
    signals.total += 1;
    if (!attr(tag, 'width') || !attr(tag, 'height')) signals.missingDimensions += 1;
    if (!hasAttr(tag, 'alt')) signals.missingAlt += 1;
    const src = `${attr(tag, 'src') ?? ''} ${attr(tag, 'srcset') ?? ''}`;
    if (/\.(webp|avif)(\?|\s|,|$)/i.test(src)) signals.modernFormat += 1;
  }
  for (const tag of extractTags(html, 'source')) {
    if (/^image\/(webp|avif)$/i.test(attr(tag, 'type') ?? '')) signals.modernFormat += 1;
  }
  return signals;
}

function registrableHost(hostname: string): string {
  return hostname.replace(/^www\./i, '').toLowerCase();
}

export function extractThirdPartyScriptHosts(html: string, finalUrl: string, limit = 20): string[] {
  const base = registrableHost(new URL(finalUrl).hostname);
  const hosts = new Set<string>();
  for (const element of extractElements(html, 'script')) {
    const src = attr(element.tag, 'src');
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
  const head = headSection(html);
  if (!head) return 0;
  let count = 0;
  for (const { tag } of extractElements(head, 'script')) {
    if (!attr(tag, 'src')) continue;
    if (hasAttr(tag, 'async') || hasAttr(tag, 'defer')) continue;
    if (attr(tag, 'type')?.toLowerCase() === 'module') continue;
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

  let canonicalUrl: string | undefined;
  for (const tag of extractTags(html, 'link')) {
    if (attr(tag, 'rel')?.toLowerCase() === 'canonical') {
      canonicalUrl = attr(tag, 'href') || undefined;
      break;
    }
  }

  let noindex = false;
  for (const tag of extractTags(html, 'meta')) {
    if (attr(tag, 'name')?.toLowerCase() === 'robots' && /noindex/i.test(attr(tag, 'content') ?? '')) {
      noindex = true;
      break;
    }
  }

  const h1Count = extractElements(html, 'h1').length;

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
