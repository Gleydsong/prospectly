import * as cheerio from 'cheerio';

export const MAX_LANDING_HTML_BYTES = 400_000;

const ALLOWED_TAGS = new Set([
  'html',
  'head',
  'body',
  'meta',
  'title',
  'style',
  'main',
  'header',
  'footer',
  'nav',
  'section',
  'article',
  'aside',
  'div',
  'span',
  'h1',
  'h2',
  'h3',
  'h4',
  'p',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'figure',
  'figcaption',
  'button',
  'form',
  'input',
  'textarea',
  'label',
  'strong',
  'em',
  'br',
  'hr',
  'blockquote',
  'picture',
  'source',
  'details',
  'summary',
]);

const GLOBAL_ATTRS = new Set(['class', 'id', 'style', 'aria-label', 'role']);

const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel', 'aria-label', 'class', 'id']),
  img: new Set(['src', 'alt', 'width', 'height', 'loading', 'class', 'id']),
  source: new Set(['srcset', 'type', 'media']),
  input: new Set(['type', 'name', 'placeholder', 'required', 'aria-label', 'class', 'id', 'value']),
  textarea: new Set(['name', 'placeholder', 'required', 'rows', 'aria-label', 'class', 'id']),
  label: new Set(['for', 'class', 'id']),
  form: new Set(['action', 'method', 'class', 'id', 'aria-label']),
  button: new Set(['type', 'class', 'id', 'aria-label']),
  meta: new Set(['charset', 'name', 'content', 'viewport']),
  style: new Set([]),
};

function isSafeHref(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return false;
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return true;
  if (/^#/.test(trimmed)) return true;
  return false;
}

function isSafeSrc(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return false;
  return /^https:/i.test(trimmed);
}

export function sanitizeLandingHtml(raw: string): string {
  const $ = cheerio.load(raw, { xml: false });

  $('*').each((_, element) => {
    if (element.type !== 'tag') return;
    const tag = element.tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(tag)) {
      $(element).remove();
      return;
    }

    const allowed = TAG_ATTRS[tag] ?? GLOBAL_ATTRS;
    const attribs = { ...element.attribs };
    for (const name of Object.keys(attribs)) {
      const lower = name.toLowerCase();
      if (lower.startsWith('on')) {
        $(element).removeAttr(name);
        continue;
      }
      if (!allowed.has(lower) && !GLOBAL_ATTRS.has(lower)) {
        $(element).removeAttr(name);
        continue;
      }
      if (lower === 'href' && !isSafeHref(attribs[name] ?? '')) {
        $(element).removeAttr(name);
        continue;
      }
      if (lower === 'src' && !isSafeSrc(attribs[name] ?? '')) {
        $(element).removeAttr(name);
        continue;
      }
      if (lower === 'action') {
        // Never allow form posts to arbitrary endpoints (phishing / data exfil).
        // The public page host captures submissions via postMessage bridge.
        $(element).removeAttr(name);
        continue;
      }
    }

    if (tag === 'a' && ($(element).attr('target') || '') === '_blank') {
      $(element).attr('rel', 'noopener noreferrer');
    }
    if (tag === 'img') {
      if (!$(element).attr('alt')) $(element).attr('alt', '');
      if (!$(element).attr('loading')) $(element).attr('loading', 'lazy');
    }
  });

  // Remove leftover script/iframe/object if any slipped through parsing quirks
  $('script, iframe, object, embed, link').remove();

  const cleaned = $.root().html()?.trim() ?? '';
  if (Buffer.byteLength(cleaned, 'utf8') > MAX_LANDING_HTML_BYTES) {
    throw new Error(`Landing HTML exceeds ${MAX_LANDING_HTML_BYTES} bytes after sanitization`);
  }
  return cleaned;
}

export function assertPublishableLandingHtml(html: string, businessName?: string): void {
  if (!html || html.length < 80) {
    throw new Error('Landing HTML is empty or too short');
  }
  const lower = html.toLowerCase();
  const hasHeading =
    lower.includes('<h1') ||
    (businessName ? lower.includes(businessName.trim().toLowerCase()) : false);
  if (!hasHeading) {
    throw new Error('Landing HTML must include an h1 or the business name');
  }
  const hasCta =
    lower.includes('<a ') ||
    lower.includes('<button') ||
    lower.includes('<form') ||
    lower.includes('wa.me');
  if (!hasCta) {
    throw new Error('Landing HTML must include at least one CTA (link, button or form)');
  }
}
