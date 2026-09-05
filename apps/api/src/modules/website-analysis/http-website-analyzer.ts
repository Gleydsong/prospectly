import type {
  SeoSignals,
  WebsiteAnalysisContext,
  WebsiteAnalysisResult,
  WebsiteAnalyzer,
} from '@prospectly/shared-types';

import {
  alternateHostname,
  looksLikeSitemap,
  parseSeoSignals,
  robotsBlocksAll,
  robotsDeclaresSitemap,
} from './seo-signals';
import {
  WEBSITE_ANALYSIS_AUX_MAX_BODY_BYTES,
  WEBSITE_ANALYSIS_AUX_TIMEOUT_MS,
  WEBSITE_ANALYSIS_MAX_BODY_BYTES,
  WEBSITE_ANALYSIS_MAX_REDIRECTS,
  WEBSITE_ANALYSIS_TIMEOUT_MS,
  WEBSITE_ANALYSIS_USER_AGENT,
} from './website-analysis.constants';
import { assertSafePublicUrl, fetchWithPinnedDns, SsrfBlockedError } from './ssrf';

const REDIRECT_STATUSES = [301, 302, 303, 307, 308];

function extractMeta(html: string, name: string): string | undefined {
  const patterns = [
    new RegExp(
      `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`,
      'i',
    ),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

function extractProperty(html: string, property: string): string | undefined {
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
      'i',
    ),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

export function parseHtmlSignals(html: string, finalUrl: string): Omit<
  WebsiteAnalysisResult,
  | 'url'
  | 'accessible'
  | 'httpStatus'
  | 'https'
  | 'sslValid'
  | 'redirectsToHttps'
  | 'responseTimeMs'
  | 'error'
  | 'hasSitemap'
  | 'hasRobotsTxt'
  | 'framework'
  | 'seo'
> {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch?.[1]?.trim() || undefined;
  const metaDescription = extractMeta(html, 'description');
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const hasContactForm =
    /<form[\s>]/i.test(html) &&
    (/type=["']email["']/i.test(html) || /name=["'][^"']*(email|message|contact)[^"']*["']/i.test(html));
  const hasPhone =
    /tel:/i.test(html) ||
    /\+?\d[\d\s().-]{8,}\d/.test(html);
  const hasEmail = /mailto:/i.test(html) || /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(html);
  const hasSocialLinks =
    /facebook\.com|instagram\.com|linkedin\.com|twitter\.com|x\.com|youtube\.com/i.test(html);
  const hasWhatsapp = /wa\.me|api\.whatsapp\.com|whatsapp/i.test(html);
  const hasBooking =
    /agendar|agendamento|reserve|reservation|booking|marcar\s+(consulta|hor[aá]rio)/i.test(html) ||
    /calendly\.com|doctoralia\.com|trinks\.com|booksy\.com|simplybook\.me/i.test(html);
  const hasPrivacyPolicy = /privacidade|privacy|lgpd|gdpr/i.test(html);
  const hasFavicon = /rel=["'][^"']*icon[^"']*["']/i.test(html);
  const hasOpenGraph = Boolean(extractProperty(html, 'og:title') || extractProperty(html, 'og:type'));
  const hasStructuredData =
    /application\/ld\+json/i.test(html) || /itemscope/i.test(html);

  let cms: string | undefined;
  if (/wp-content|wordpress/i.test(html)) cms = 'WordPress';
  else if (/shopify/i.test(html)) cms = 'Shopify';
  else if (/wix\.com/i.test(html)) cms = 'Wix';

  let analytics: string | undefined;
  if (/gtag\/js|google-analytics|googletagmanager/i.test(html)) analytics = 'Google Analytics';
  else if (/hotjar/i.test(html)) analytics = 'Hotjar';

  const issues: WebsiteAnalysisResult['issues'] = [];
  if (!hasViewport) {
    issues.push({
      code: 'NOT_RESPONSIVE',
      severity: 'WARNING',
      message: 'Missing viewport meta tag (likely not mobile-friendly)',
    });
  }
  if (!metaDescription) {
    issues.push({
      code: 'NO_META_DESCRIPTION',
      severity: 'INFO',
      message: 'Missing meta description',
    });
  }
  if (!hasContactForm) {
    issues.push({
      code: 'NO_CONTACT_FORM',
      severity: 'INFO',
      message: 'No obvious contact form detected',
    });
  }

  void finalUrl;

  return {
    title,
    metaDescription,
    hasViewport,
    hasContactForm,
    hasPhone,
    hasEmail,
    hasSocialLinks,
    hasWhatsapp,
    hasBooking,
    hasPrivacyPolicy,
    hasFavicon,
    hasOpenGraph,
    hasStructuredData,
    cms,
    analytics,
    technologies: [cms, analytics].filter(Boolean) as string[],
    issues,
  };
}

type LimitedBodyStream = {
  getReader: () => {
    read: () => Promise<{ done: boolean; value?: Uint8Array }>;
    cancel: () => Promise<void> | void;
  };
  cancel?: () => Promise<void> | void;
};

type LimitedBodyResponse = {
  body?: LimitedBodyStream | null;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

/**
 * Reads at most `maxBodyBytes` from a fetch Response, canceling the stream once
 * the cap is hit so a malicious/huge HTML payload cannot OOM the worker.
 */
export async function readBodyWithLimit(
  response: LimitedBodyResponse,
  maxBodyBytes: number,
): Promise<Buffer> {
  if (maxBodyBytes <= 0) {
    if (response.body?.cancel) {
      try {
        await response.body.cancel();
      } catch {
        // ignore cancel errors
      }
    }
    return Buffer.alloc(0);
  }

  if (response.body) {
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value?.byteLength) continue;

        const remaining = maxBodyBytes - total;
        if (remaining <= 0) {
          break;
        }
        if (value.byteLength > remaining) {
          chunks.push(Buffer.from(value.subarray(0, remaining)));
          total += remaining;
          break;
        }
        chunks.push(Buffer.from(value));
        total += value.byteLength;
      }
    } finally {
      try {
        await reader.cancel();
      } catch {
        // ignore cancel errors
      }
    }
    return total === 0 ? Buffer.alloc(0) : Buffer.concat(chunks, total);
  }

  // Fallback for test doubles / odd runtimes without a stream body.
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.byteLength > maxBodyBytes ? buffer.subarray(0, maxBodyBytes) : buffer;
}

type FetchedPage = { response: Response; finalUrl: string };

type AuxSignals = Pick<WebsiteAnalysisResult, 'hasRobotsTxt' | 'hasSitemap'> &
  Pick<SeoSignals, 'robotsBlocksAll' | 'alternateHostRedirects'>;

export class HttpWebsiteAnalyzer implements WebsiteAnalyzer {
  constructor(
    private readonly options: {
      timeoutMs?: number;
      maxBodyBytes?: number;
      maxRedirects?: number;
      auxTimeoutMs?: number;
      fetchImpl?: typeof fetch;
    } = {},
  ) {}

  async analyze(url: string, context?: WebsiteAnalysisContext): Promise<WebsiteAnalysisResult> {
    const timeoutMs = this.options.timeoutMs ?? WEBSITE_ANALYSIS_TIMEOUT_MS;
    const maxBodyBytes = this.options.maxBodyBytes ?? WEBSITE_ANALYSIS_MAX_BODY_BYTES;
    const maxRedirects = this.options.maxRedirects ?? WEBSITE_ANALYSIS_MAX_REDIRECTS;

    let currentUrl: string;
    try {
      const safe = await assertSafePublicUrl(url);
      currentUrl = safe.url.toString();
    } catch (error) {
      return {
        url,
        accessible: false,
        https: url.startsWith('https:'),
        issues: [
          {
            code: 'SSRF_BLOCKED',
            severity: 'CRITICAL',
            message: error instanceof Error ? error.message : 'URL blocked',
          },
        ],
        error: error instanceof Error ? error.message : 'URL blocked',
      };
    }

    const started = Date.now();

    try {
      const { response, finalUrl } = await this.fetchFollowingRedirects(currentUrl, {
        deadline: started + timeoutMs,
        maxRedirects,
      });
      currentUrl = finalUrl;

      const responseTimeMs = Date.now() - started;
      const https = finalUrl.startsWith('https:');
      const contentType = response.headers.get('content-type') ?? '';
      let html = '';
      if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
        const buffer = await readBodyWithLimit(response, maxBodyBytes);
        html = buffer.toString('utf8');
      }

      const parsed = html ? parseHtmlSignals(html, finalUrl) : undefined;
      const signals = parsed ?? { issues: [] as WebsiteAnalysisResult['issues'] };

      const issues = [...signals.issues];
      if (!https) {
        issues.unshift({
          code: 'NO_HTTPS',
          severity: 'WARNING',
          message: 'Website is not served over HTTPS',
        });
      }
      if (responseTimeMs >= 3000) {
        issues.push({
          code: 'SLOW',
          severity: 'WARNING',
          message: `Slow response (${responseTimeMs} ms)`,
        });
      }

      let seo: SeoSignals | undefined;
      let framework: string | undefined;
      let aux: AuxSignals = {};
      if (html && parsed) {
        const extraction = parseSeoSignals(html, finalUrl, context, {
          title: parsed.title,
          metaDescription: parsed.metaDescription,
        });
        framework = extraction.framework;
        aux = await this.collectAuxSignals(finalUrl);
        seo = {
          ...extraction.seo,
          robotsBlocksAll: aux.robotsBlocksAll,
          alternateHostRedirects: aux.alternateHostRedirects,
        };
      }

      return {
        url: finalUrl,
        accessible: response.ok,
        httpStatus: response.status,
        https,
        sslValid: https ? true : false,
        redirectsToHttps: url.startsWith('http:') && https,
        responseTimeMs,
        ...signals,
        framework,
        hasRobotsTxt: aux.hasRobotsTxt,
        hasSitemap: aux.hasSitemap,
        seo,
        issues,
      };
    } catch (error) {
      return {
        url: currentUrl,
        accessible: false,
        https: currentUrl.startsWith('https:'),
        responseTimeMs: Date.now() - started,
        issues: [
          {
            code: 'FETCH_FAILED',
            severity: 'CRITICAL',
            message: error instanceof Error ? error.message : 'Fetch failed',
          },
        ],
        error: error instanceof Error ? error.message : 'Fetch failed',
      };
    }
  }

  /**
   * Single request through the SSRF guard (URL validated + DNS pinned), with a
   * hard deadline. `redirect: 'manual'` — callers decide whether to follow.
   */
  private async request(url: string, deadline: number): Promise<{ response: Response; url: string }> {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) throw new Error('Website analysis deadline exceeded');

    const safe = await assertSafePublicUrl(url);
    const safeUrl = safe.url.toString();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remainingMs);
    const requestInit = {
      method: 'GET',
      redirect: 'manual' as const,
      signal: controller.signal,
      headers: {
        'User-Agent': WEBSITE_ANALYSIS_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
    };
    try {
      // Default path pins DNS at connect time so a rebinding A record
      // cannot slip past assertSafePublicUrl between resolve and fetch.
      // Injected fetchImpl is for tests only — it cannot pin DNS.
      const response = this.options.fetchImpl
        ? await this.options.fetchImpl(safeUrl, requestInit)
        : await fetchWithPinnedDns(safeUrl, safe.addresses, requestInit);
      return { response, url: safeUrl };
    } finally {
      clearTimeout(timer);
    }
  }

  private async fetchFollowingRedirects(
    startUrl: string,
    options: { deadline: number; maxRedirects: number },
  ): Promise<FetchedPage> {
    let currentUrl = startUrl;
    let redirects = 0;
    const visited = new Set<string>();

    for (;;) {
      if (visited.has(currentUrl)) {
        throw new SsrfBlockedError('Redirect loop detected');
      }
      visited.add(currentUrl);

      const { response, url } = await this.request(currentUrl, options.deadline);
      currentUrl = url;

      if (REDIRECT_STATUSES.includes(response.status) && redirects < options.maxRedirects) {
        const location = response.headers.get('location');
        if (!location) return { response, finalUrl: currentUrl };
        currentUrl = new URL(location, currentUrl).toString();
        redirects += 1;
        continue;
      }
      return { response, finalUrl: currentUrl };
    }
  }

  /**
   * robots.txt, sitemap.xml and www/non-www redirect checks. Run in parallel
   * with their own short budget; any failure yields `undefined` (unknown), never an error.
   */
  private async collectAuxSignals(finalUrl: string): Promise<AuxSignals> {
    const deadline = Date.now() + (this.options.auxTimeoutMs ?? WEBSITE_ANALYSIS_AUX_TIMEOUT_MS);
    const origin = new URL(finalUrl);

    const [robots, sitemap, alternate] = await Promise.all([
      this.fetchSmallText(`${origin.origin}/robots.txt`, deadline),
      this.fetchSmallText(`${origin.origin}/sitemap.xml`, deadline),
      this.checkAlternateHostRedirect(origin, deadline),
    ]);

    const robotsBody = robots?.ok && robots.body.trim().length > 0 ? robots.body : undefined;
    const hasRobotsTxt = robots === undefined ? undefined : robotsBody !== undefined;

    const sitemapFromFile = sitemap === undefined ? undefined : sitemap.ok && looksLikeSitemap(sitemap.body);
    const sitemapFromRobots = robotsBody ? robotsDeclaresSitemap(robotsBody) : false;
    let hasSitemap: boolean | undefined;
    if (sitemapFromRobots) hasSitemap = true;
    else if (sitemapFromFile !== undefined) hasSitemap = sitemapFromFile;

    let blocksAll: boolean | undefined;
    if (robotsBody) blocksAll = robotsBlocksAll(robotsBody);
    else if (hasRobotsTxt === false) blocksAll = false;

    return {
      hasRobotsTxt,
      hasSitemap,
      robotsBlocksAll: blocksAll,
      alternateHostRedirects: alternate,
    };
  }

  private async fetchSmallText(
    url: string,
    deadline: number,
  ): Promise<{ ok: boolean; body: string } | undefined> {
    try {
      const { response } = await this.fetchFollowingRedirects(url, { deadline, maxRedirects: 3 });
      if (!response.ok) {
        await readBodyWithLimit(response, 0);
        return { ok: false, body: '' };
      }
      const buffer = await readBodyWithLimit(response, WEBSITE_ANALYSIS_AUX_MAX_BODY_BYTES);
      return { ok: true, body: buffer.toString('utf8') };
    } catch {
      return undefined;
    }
  }

  private async checkAlternateHostRedirect(finalUrl: URL, deadline: number): Promise<boolean | undefined> {
    const alternate = alternateHostname(finalUrl.hostname);
    if (!alternate) return undefined;
    const target = new URL(finalUrl.toString());
    target.hostname = alternate;
    target.pathname = '/';
    target.search = '';
    try {
      const { response } = await this.request(target.toString(), deadline);
      await readBodyWithLimit(response, 0);
      if (!REDIRECT_STATUSES.includes(response.status)) return false;
      const location = response.headers.get('location');
      if (!location) return false;
      return new URL(location, target).hostname.toLowerCase() === finalUrl.hostname.toLowerCase();
    } catch {
      return undefined;
    }
  }
}
