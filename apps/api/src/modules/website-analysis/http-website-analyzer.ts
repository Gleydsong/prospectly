import type { WebsiteAnalysisResult, WebsiteAnalyzer } from '@prospectly/shared-types';

import {
  WEBSITE_ANALYSIS_MAX_BODY_BYTES,
  WEBSITE_ANALYSIS_MAX_REDIRECTS,
  WEBSITE_ANALYSIS_TIMEOUT_MS,
  WEBSITE_ANALYSIS_USER_AGENT,
} from './website-analysis.constants';
import { assertSafePublicUrl, fetchWithPinnedDns, SsrfBlockedError } from './ssrf';

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
  'url' | 'accessible' | 'httpStatus' | 'https' | 'sslValid' | 'redirectsToHttps' | 'responseTimeMs' | 'error'
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
    hasSitemap: undefined,
    hasRobotsTxt: undefined,
    hasFavicon,
    hasOpenGraph,
    hasStructuredData,
    cms,
    framework: undefined,
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

export class HttpWebsiteAnalyzer implements WebsiteAnalyzer {
  constructor(
    private readonly options: {
      timeoutMs?: number;
      maxBodyBytes?: number;
      maxRedirects?: number;
      fetchImpl?: typeof fetch;
    } = {},
  ) {}

  async analyze(url: string): Promise<WebsiteAnalysisResult> {
    const timeoutMs = this.options.timeoutMs ?? WEBSITE_ANALYSIS_TIMEOUT_MS;
    const maxBodyBytes = this.options.maxBodyBytes ?? WEBSITE_ANALYSIS_MAX_BODY_BYTES;
    const maxRedirects = this.options.maxRedirects ?? WEBSITE_ANALYSIS_MAX_REDIRECTS;
    const fetchImpl = this.options.fetchImpl ?? fetch;

    let currentUrl: string;
    let pinnedAddresses: string[];
    try {
      const safe = await assertSafePublicUrl(url);
      currentUrl = safe.url.toString();
      pinnedAddresses = safe.addresses;
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
    const deadline = started + timeoutMs;
    let redirects = 0;
    let response: Response | undefined;
    const visited = new Set<string>();
    const useInjectedFetch = Boolean(this.options.fetchImpl);

    try {
      while (redirects <= maxRedirects) {
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) throw new Error('Website analysis deadline exceeded');
        if (visited.has(currentUrl)) {
          throw new SsrfBlockedError('Redirect loop detected');
        }
        visited.add(currentUrl);
        const safe = await assertSafePublicUrl(currentUrl);
        currentUrl = safe.url.toString();
        pinnedAddresses = safe.addresses;

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
          response = useInjectedFetch
            ? await fetchImpl(currentUrl, requestInit)
            : await fetchWithPinnedDns(currentUrl, pinnedAddresses, requestInit);
        } finally {
          clearTimeout(timer);
        }

        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get('location');
          if (!location) break;
          currentUrl = new URL(location, currentUrl).toString();
          redirects += 1;
          continue;
        }
        break;
      }

      if (!response) {
        throw new Error('No response received');
      }

      const responseTimeMs = Date.now() - started;
      const finalUrl = currentUrl;
      const https = finalUrl.startsWith('https:');
      const contentType = response.headers.get('content-type') ?? '';
      let html = '';
      if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
        const buffer = await readBodyWithLimit(response, maxBodyBytes);
        html = buffer.toString('utf8');
      }

      const signals = html
        ? parseHtmlSignals(html, finalUrl)
        : {
            issues: [] as WebsiteAnalysisResult['issues'],
          };

      const issues = [...(signals.issues ?? [])];
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

      return {
        url: finalUrl,
        accessible: response.ok,
        httpStatus: response.status,
        https,
        sslValid: https ? true : false,
        redirectsToHttps: url.startsWith('http:') && https,
        responseTimeMs,
        ...signals,
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
}
